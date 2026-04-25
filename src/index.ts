import type { Plugin } from "@opencode-ai/plugin"
import { existsSync } from "node:fs"
import { join } from "node:path"

import type { HookName } from "./config"

import { createHooks } from "./create-hooks"
import { createManagers } from "./create-managers"
import { createRuntimeTmuxConfig, isTmuxIntegrationEnabled } from "./create-runtime-tmux-config"
import { createTools } from "./create-tools"
import { createPluginInterface } from "./plugin-interface"
import { createPluginDispose, type PluginDispose } from "./plugin-dispose"

import { loadPluginConfig } from "./plugin-config"
import { createModelCacheState } from "./plugin-state"
import { createFirstMessageVariantGate } from "./shared/first-message-variant"
import { injectServerAuthIntoClient, log } from "./shared"
import { hydratePluginConfigWithPlatformDefaults } from "./shared/runtime-plugin-config"
import { detectExternalSkillPlugin, getSkillPluginConflictWarning } from "./shared/external-plugin-detector"
import { PLUGIN_NAME } from "./shared/plugin-identity"
import { warnIfListPluginEntry, warnMissingRequiredMcpEnv } from "./shared/startup-diagnostics"
import { startBackgroundCheck as startTmuxCheck } from "./tools/interactive-bash"
import { lspManager } from "./tools/lsp/client"

import { loadConfig, resolveEnvVars } from "./config/loader"
import type { HiaiOpencodeConfig } from "./config/types"

import { createPlugin as createSubtask2Plugin } from "./internals/plugins/subtask2/core/plugin"
import WebsearchCitedPlugin, { 
  GOOGLE_PROVIDER_ID,
  OPENAI_PROVIDER_ID,
  OPENROUTER_PROVIDER_ID,
  WebsearchCitedGooglePlugin, 
  WebsearchCitedOpenAIPlugin 
} from "./internals/plugins/websearch-cited/index"
import type { WebsearchCitedFallback } from "./internals/plugins/websearch-cited/index"
import { createBuiltinSkills } from "./features/builtin-skills"
import {
  materializeBuiltinSkills,
  materializePluginSkillDirectories,
} from "./features/builtin-skills/materialize"

let activePluginDispose: PluginDispose | null = null

function createWebsearchFallback(config: HiaiOpencodeConfig): WebsearchCitedFallback | undefined {
  const model = config.agents?.researcher?.model?.trim()
  if (!model) {
    return undefined
  }

  if (model.startsWith("openrouter/")) {
    return {
      providerID: OPENROUTER_PROVIDER_ID,
      model: model.slice("openrouter/".length),
    }
  }

  if (model.startsWith("openai/")) {
    return {
      providerID: OPENAI_PROVIDER_ID,
      model: model.slice("openai/".length),
    }
  }

  if (model.startsWith("google/")) {
    return {
      providerID: GOOGLE_PROVIDER_ID,
      model: model.slice("google/".length),
    }
  }

  return {
    providerID: OPENROUTER_PROVIDER_ID,
    model,
  }
}

function configureBundledBunPtyLibrary(): void {
  if (process.env.BUN_PTY_LIB?.trim()) {
    return
  }

  const libraryName =
    process.platform === "win32"
      ? "rust_pty.dll"
      : process.platform === "darwin"
        ? process.arch === "arm64"
          ? "librust_pty_arm64.dylib"
          : "librust_pty.dylib"
        : process.arch === "arm64"
          ? "librust_pty_arm64.so"
          : "librust_pty.so"

  const candidates = [
    join(import.meta.dirname, "..", "node_modules", "bun-pty", "rust-pty", "target", "release", libraryName),
    join(import.meta.dirname, "..", "..", "bun-pty", "rust-pty", "target", "release", libraryName),
    join(import.meta.dirname, "..", "..", "..", "bun-pty", "rust-pty", "target", "release", libraryName),
  ]

  const resolved = candidates.find((candidate) => existsSync(candidate))
  if (resolved) {
    process.env.BUN_PTY_LIB = resolved
  }
}

const HiaiOpenCodePlugin: Plugin = async (ctx) => {
  log("[HiaiOpenCodePlugin] ENTRY - plugin loading", {
    directory: ctx.directory,
  })
  warnIfListPluginEntry(ctx.directory)

  const skillPluginCheck = detectExternalSkillPlugin(ctx.directory)
  if (skillPluginCheck.detected && skillPluginCheck.pluginName) {
    console.warn(getSkillPluginConflictWarning(skillPluginCheck.pluginName))
  }

  injectServerAuthIntoClient(ctx.client)
  await activePluginDispose?.()

  const internalConfig: HiaiOpencodeConfig = loadConfig(ctx.directory)
  const pluginConfig = hydratePluginConfigWithPlatformDefaults(
    loadPluginConfig(ctx.directory, ctx),
    internalConfig,
  )
  warnMissingRequiredMcpEnv({
    pluginConfig,
    platformConfig: internalConfig,
  })

  materializeBuiltinSkills(
    createBuiltinSkills({
      browserProvider: pluginConfig.browser_automation_engine?.provider ?? "playwright",
      disabledSkills: new Set(pluginConfig.disabled_skills ?? []),
    }),
  )
  materializePluginSkillDirectories(join(import.meta.dirname, ".."))

  // Initialize model requirements from configuration
  const { initializeModelRequirements } = await import("./shared/model-requirements");
  initializeModelRequirements(internalConfig);

  const { initializeModelHeuristics } = await import("./shared/model-capability-heuristics");
  initializeModelHeuristics(internalConfig);

  const tmuxIntegrationEnabled = isTmuxIntegrationEnabled(pluginConfig)
  if (tmuxIntegrationEnabled) {
    startTmuxCheck()
  }

  const disabledHooks = new Set(pluginConfig.disabled_hooks ?? [])
  const isHookEnabled = (hookName: HookName): boolean => !disabledHooks.has(hookName)
  const safeHookEnabled = pluginConfig.experimental?.safe_hook_creation ?? true

  const firstMessageVariantGate = createFirstMessageVariantGate()
  const tmuxConfig = createRuntimeTmuxConfig(pluginConfig)
  const modelCacheState = createModelCacheState()

  const managers = createManagers({
    ctx,
    pluginConfig,
    tmuxConfig,
    modelCacheState,
    backgroundNotificationHookEnabled: isHookEnabled("background-notification"),
  })

  const toolsResult = await createTools({
    ctx,
    pluginConfig,
    platformConfig: internalConfig,
    managers,
  })

  const hooks = createHooks({
    ctx,
    pluginConfig,
    modelCacheState,
    backgroundManager: managers.backgroundManager,
    isHookEnabled,
    safeHookEnabled,
    mergedSkills: toolsResult.mergedSkills,
    availableSkills: toolsResult.availableSkills,
  })

  const dispose = createPluginDispose({
    backgroundManager: managers.backgroundManager,
    skillMcpManager: managers.skillMcpManager,
    lspManager,
    disposeHooks: hooks.disposeHooks,
  })

  const pluginInterface = createPluginInterface({
    ctx,
    pluginConfig,
    firstMessageVariantGate,
    managers,
    hooks,
    tools: toolsResult.filteredTools,
  })

  // --- Internal Plugins Integration ---
  const subtask2Result = await createSubtask2Plugin(ctx)
  let ptyResult: any = { tool: {}, event: null };
  try {
    configureBundledBunPtyLibrary()
    const mod = await import("./internals/plugins/pty/plugin");
    ptyResult = await mod.PTYPlugin(ctx);
  } catch (err) {
    console.error("[hiai-opencode] PTYPlugin failed to load:", err);
  }
  const websearchResult = await WebsearchCitedPlugin(ctx, createWebsearchFallback(internalConfig))
  const websearchGoogleResult = await WebsearchCitedGooglePlugin(ctx)
  const websearchOpenAIResult = await WebsearchCitedOpenAIPlugin(ctx)

  const combinedResult = {
    name: PLUGIN_NAME,
    ...pluginInterface,

    // Merge Tools
    tool: {
      ...pluginInterface.tool,
      ...ptyResult.tool,
      ...websearchResult.tool,
    },

    // Chain hooks: command.execute.before
    "command.execute.before": async (input: any, output: any) => {
      await pluginInterface["command.execute.before"]?.(input, output);
      await (subtask2Result as any)["command.execute.before"]?.(input, output);
    },

    // Chain hooks: tool.execute.before
    "tool.execute.before": async (input: any, output: any) => {
      await (pluginInterface as any)["tool.execute.before"]?.(input, output);
      await (subtask2Result as any)["tool.execute.before"]?.(input, output);
    },

    // Chain hooks: tool.execute.after
    "tool.execute.after": async (input: any, output: any) => {
      await (pluginInterface as any)["tool.execute.after"]?.(input, output);
      await (subtask2Result as any)["tool.execute.after"]?.(input, output);
    },

    // Chain hooks: experimental.chat.messages.transform
    "experimental.chat.messages.transform": async (input: any, output: any) => {
      await (pluginInterface as any)["experimental.chat.messages.transform"]?.(input, output);
      await (subtask2Result as any)["experimental.chat.messages.transform"]?.(input, output);
    },

    // Merge Config
    config: async (input: any) => {
      await pluginInterface.config?.(input);
      await (subtask2Result as any).config?.(input);
      await (websearchResult as any).config?.(input);
    },

    // Merge Events
    event: async (input: any) => {
      await pluginInterface.event?.(input);
      await (subtask2Result as any).event?.(input);
      await (ptyResult as any).event?.(input);
    },

    // Auth (Consolidated)
    auth: {
      provider: "hiai-opencode",
      methods: [
        { type: "api" as const, label: "Google Search API key" },
      ],
      loader: async (getAuth: any) => {
        const authData = await getAuth();
        const { registerGetAuth, GOOGLE_PROVIDER_ID, OPENAI_PROVIDER_ID, OPENROUTER_PROVIDER_ID } = await import("./internals/plugins/websearch-cited/index");

        const getConfiguredKey = (configKey?: string) => {
          if (configKey) return resolveEnvVars(configKey);
          return undefined;
        };

        const googleKey = authData["Google Search API key"] || getConfiguredKey(internalConfig.auth?.googleSearch);
        const openaiKey = getConfiguredKey(internalConfig.auth?.openai);
        const openRouterKey = getConfiguredKey(internalConfig.auth?.openrouter);

        if (googleKey) registerGetAuth(GOOGLE_PROVIDER_ID, () => Promise.resolve({ type: "api", key: googleKey }));
        if (openaiKey) registerGetAuth(OPENAI_PROVIDER_ID, () => Promise.resolve({ type: "api", key: openaiKey }));
        if (openRouterKey) registerGetAuth(OPENROUTER_PROVIDER_ID, () => Promise.resolve({ type: "api", key: openRouterKey }));

        return {};
      },
    },

    "experimental.session.compacting": async (
      _input: { sessionID: string },
      output: { context: string[] },
    ): Promise<void> => {
      await hooks.compactionContextInjector?.capture(_input.sessionID)
      await hooks.compactionTodoPreserver?.capture(_input.sessionID)
      await hooks.claudeCodeHooks?.["experimental.session.compacting"]?.(
        _input,
        output,
      )
      if (hooks.compactionContextInjector) {
        output.context.push(hooks.compactionContextInjector.inject(_input.sessionID))
      }
    },
  }

  activePluginDispose = dispose

  return combinedResult
}

export const server: Plugin = HiaiOpenCodePlugin
export default server

export type {
  HiaiOpenCodeConfig,
  AgentName,
  AgentOverrideConfig,
  AgentOverrides,
  McpName,
  HookName,
  BuiltinCommandName,
} from "./config"

export type { ConfigLoadError } from "./shared/config-errors"
