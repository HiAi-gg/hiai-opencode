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
import { injectServerAuthIntoClient, log, logWarn, logError } from "./shared"
import { hydratePluginConfigWithPlatformDefaults } from "./shared/runtime-plugin-config"
import { detectExternalSkillPlugin, getSkillPluginConflictWarning } from "./shared/external-plugin-detector"
import { PLUGIN_NAME } from "./shared/plugin-identity"
import { autoExportStaticMcpJson } from "./shared/mcp-static-export"
import { warnIfListPluginEntry, warnMissingRequiredMcpEnv } from "./shared/startup-diagnostics"
import { lintModeAgentCapabilities } from "./plugin/startup-diagnostics"
import { startBackgroundCheck as startTmuxCheck } from "./tools/interactive-bash"
import { lspManager } from "./tools/lsp/client"

import { loadConfig } from "./config/loader"
import type { HiaiOpencodeConfig } from "./config/types"

import { createPlugin as createSubtask2Plugin } from "./internals/plugins/subtask2/core/plugin"
import { createBuiltinSkills } from "./features/builtin-skills"
import {
  materializeBuiltinSkills,
  materializePluginSkillDirectories,
} from "./features/builtin-skills/materialize"

let activePluginDispose: PluginDispose | null = null

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
    logWarn(getSkillPluginConflictWarning(skillPluginCheck.pluginName))
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
  lintModeAgentCapabilities()
  autoExportStaticMcpJson(ctx.directory, internalConfig)

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
  // The OpenCode plugin SDK exposes a strongly-typed `Hooks` shape, while
  // optional sub-plugins (subtask2, PTY) define an open-ended set of hook
  // names. `lookup` is a single chokepoint for the dynamic dispatch — every
  // other call site stays typed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lookup = (obj: unknown, key: string): ((...args: any[]) => any) | undefined =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (obj as Record<string, any> | undefined)?.[key]

  const subtask2Result = await createSubtask2Plugin(ctx)
  // Tool shape is enforced by the OpenCode SDK at registration time; we treat
  // ptyResult.tool as opaque here and let the SDK validate downstream.
  let ptyResult: { tool: Record<string, unknown>; event?: (input: unknown) => unknown } = { tool: {} as Record<string, unknown> }
  try {
    configureBundledBunPtyLibrary()
    const mod = await import("./internals/plugins/pty/plugin");
    ptyResult = (await mod.PTYPlugin(ctx)) as typeof ptyResult
  } catch (err) {
    logError("PTYPlugin failed to load:", err)
  }
  const combinedResult = {
    name: PLUGIN_NAME,
    ...pluginInterface,

    // Merge Tools
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tool: { ...pluginInterface.tool, ...(ptyResult.tool as any) },

    "command.execute.before": async (input: unknown, output: unknown) => {
      await lookup(pluginInterface, "command.execute.before")?.(input, output)
      await lookup(subtask2Result, "command.execute.before")?.(input, output)
    },

    "tool.execute.before": async (input: unknown, output: unknown) => {
      await lookup(pluginInterface, "tool.execute.before")?.(input, output)
      await lookup(subtask2Result, "tool.execute.before")?.(input, output)
    },

    "tool.execute.after": async (input: unknown, output: unknown) => {
      await lookup(pluginInterface, "tool.execute.after")?.(input, output)
      await lookup(subtask2Result, "tool.execute.after")?.(input, output)
    },

    "experimental.chat.messages.transform": async (input: unknown, output: unknown) => {
      await lookup(pluginInterface, "experimental.chat.messages.transform")?.(input, output)
      await lookup(subtask2Result, "experimental.chat.messages.transform")?.(input, output)
    },

    config: async (input: unknown) => {
      await lookup(pluginInterface, "config")?.(input)
      await lookup(subtask2Result, "config")?.(input)
    },

    event: async (input: unknown) => {
      await lookup(pluginInterface, "event")?.(input)
      await lookup(subtask2Result, "event")?.(input)
      await lookup(ptyResult, "event")?.(input)
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
