import type { Plugin } from "@opencode-ai/plugin"

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
import { detectExternalSkillPlugin, getSkillPluginConflictWarning } from "./shared/external-plugin-detector"
import { startBackgroundCheck as startTmuxCheck } from "./tools/interactive-bash"
import { lspManager } from "./tools/lsp/client"

import { loadConfig, resolveEnvVars } from "./config/loader"
import type { HiaiOpencodeConfig } from "./config/types"

import { createPlugin as createSubtask2Plugin } from "./internals/plugins/subtask2/core/plugin"
import WebsearchCitedPlugin, { 
  WebsearchCitedGooglePlugin, 
  WebsearchCitedOpenAIPlugin 
} from "./internals/plugins/websearch-cited/index"

let activePluginDispose: PluginDispose | null = null

const HiaiOpenCodePlugin: Plugin = async (ctx) => {
  log("[HiaiOpenCodePlugin] ENTRY - plugin loading", {
    directory: ctx.directory,
  })

  const skillPluginCheck = detectExternalSkillPlugin(ctx.directory)
  if (skillPluginCheck.detected && skillPluginCheck.pluginName) {
    console.warn(getSkillPluginConflictWarning(skillPluginCheck.pluginName))
  }

  injectServerAuthIntoClient(ctx.client)
  await activePluginDispose?.()

  const pluginConfig = loadPluginConfig(ctx.directory, ctx)
  const internalConfig: HiaiOpencodeConfig = loadConfig(ctx.directory)

  // Initialize model requirements from configuration
  const { initializeModelRequirements } = await import("./shared/model-requirements");
  initializeModelRequirements(internalConfig);

  const { initializeClaudeAliases } = await import("./features/claude-code-agent-loader/claude-model-mapper");
  initializeClaudeAliases(internalConfig.claudeModelAliases);

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
    const mod = await import("./internals/plugins/pty/plugin");
    ptyResult = await mod.PTYPlugin(ctx);
  } catch (err) {
    console.error("[hiai-opencode] PTYPlugin failed to load:", err);
  }
  const websearchResult = await WebsearchCitedPlugin(ctx)
  const websearchGoogleResult = await WebsearchCitedGooglePlugin(ctx)
  const websearchOpenAIResult = await WebsearchCitedOpenAIPlugin(ctx)

  const combinedResult = {
    name: "hiai-opencode",
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
        { type: "api" as const, label: "Google API key" },
        { type: "api" as const, label: "OpenAI API key" },
        { type: "api" as const, label: "OpenRouter API key" },
      ],
      loader: async (getAuth: any) => {
        const authData = await getAuth();
        const { registerGetAuth, GOOGLE_PROVIDER_ID, OPENAI_PROVIDER_ID, OPENROUTER_PROVIDER_ID } = await import("./internals/plugins/websearch-cited/index");

        // Helper to get key from config or authData
        const getKey = (label: string, configKey?: string) => {
          const fromAuth = authData[label];
          if (fromAuth) return fromAuth;
          if (configKey) return resolveEnvVars(configKey);
          return undefined;
        };

        const googleKey = getKey("Google API key", internalConfig.auth?.googleSearch);
        const openaiKey = getKey("OpenAI API key", internalConfig.auth?.openai);
        const openRouterKey = getKey("OpenRouter API key", internalConfig.auth?.openrouter);

        if (googleKey) registerGetAuth(GOOGLE_PROVIDER_ID, () => Promise.resolve(googleKey));
        if (openaiKey) registerGetAuth(OPENAI_PROVIDER_ID, () => Promise.resolve(openaiKey));
        if (openRouterKey) registerGetAuth(OPENROUTER_PROVIDER_ID, () => Promise.resolve(openRouterKey));

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
