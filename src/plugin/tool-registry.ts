import type { ToolDefinition } from "@opencode-ai/plugin"
import type { SkillLoadOptions } from "../tools/skill/types"

import type {
  AvailableCategory,
} from "../agents/dynamic-agent-prompt-builder"
import type { HiaiOpenCodeConfig } from "../config"
import type { McpServerConfig } from "../config/types"
import { isInteractiveBashEnabled } from "../create-runtime-tmux-config"
import type { PluginContext, ToolsRecord } from "./types"

import {
  builtinTools,
  createBackgroundTools,
  createCallHiaiAgent,
  createLookAt,
  createSkillMcpTool,
  createSkillTool,
  createGrepTools,
  createGlobTools,
  createAstGrepTools,
  createSessionManagerTools,
  createDelegateTask,
  discoverCommandsSync,
  interactive_bash,
  createTaskCreateTool,
  createTaskGetTool,
  createTaskList,
  createTaskUpdateTool,
  createHashlineEditTool,
  createAgentBrowserTool,
  createAgentBrowserIntegrationTool,
} from "../tools"
import { getMainSessionID } from "../features/claude-code-session-state"
import { filterDisabledTools } from "../shared/disabled-tools"
import { isTaskSystemEnabled, log } from "../shared"

import type { Managers } from "../create-managers"
import type { SkillContext } from "./skill-context"
import { normalizeToolArgSchemas } from "./normalize-tool-arg-schemas"

type ToolRegistryFactories = {
  builtinTools: typeof builtinTools
  createBackgroundTools: typeof createBackgroundTools
  createCallHiaiAgent: typeof createCallHiaiAgent
  createLookAt: typeof createLookAt
  createSkillMcpTool: typeof createSkillMcpTool
  createSkillTool: typeof createSkillTool
  createGrepTools: typeof createGrepTools
  createGlobTools: typeof createGlobTools
  createAstGrepTools: typeof createAstGrepTools
  createSessionManagerTools: typeof createSessionManagerTools
  createDelegateTask: typeof createDelegateTask
  discoverCommandsSync: typeof discoverCommandsSync
  interactive_bash: typeof interactive_bash
  createTaskCreateTool: typeof createTaskCreateTool
  createTaskGetTool: typeof createTaskGetTool
  createTaskList: typeof createTaskList
  createTaskUpdateTool: typeof createTaskUpdateTool
  createHashlineEditTool: typeof createHashlineEditTool
  createAgentBrowserTool: typeof createAgentBrowserTool
  createAgentBrowserIntegrationTool: typeof createAgentBrowserIntegrationTool
}

const defaultToolRegistryFactories: ToolRegistryFactories = {
  builtinTools,
  createBackgroundTools,
  createCallHiaiAgent,
  createLookAt,
  createSkillMcpTool,
  createSkillTool,
  createGrepTools,
  createGlobTools,
  createAstGrepTools,
  createSessionManagerTools,
  createDelegateTask,
  discoverCommandsSync,
  interactive_bash,
  createTaskCreateTool,
  createTaskGetTool,
  createTaskList,
  createTaskUpdateTool,
  createHashlineEditTool,
  createAgentBrowserTool,
  createAgentBrowserIntegrationTool,
}

export type ToolRegistryResult = {
  filteredTools: ToolsRecord
  taskSystemEnabled: boolean
}

const LOW_PRIORITY_TOOL_ORDER = [
  "session_list",
  "session_read",
  "session_search",
  "session_info",
  "interactive_bash",
  "look_at",
  "call_hiai_agent",
  "task_create",
  "task_get",
  "task_list",
  "task_update",
  "background_output",
  "background_cancel",
  "edit",
  "ast_grep_replace",
  "ast_grep_search",
  "glob",
  "grep",
  "skill_mcp",
  "skill",
  "task",
  "lsp_rename",
  "lsp_prepare_rename",
  "lsp_find_references",
  "lsp_goto_definition",
  "lsp_symbols",
  "lsp_diagnostics",
] as const

export function trimToolsToCap(filteredTools: ToolsRecord, maxTools: number): void {
  const toolNames = Object.keys(filteredTools)
  if (toolNames.length <= maxTools) return

  const removableToolNames = [
    ...LOW_PRIORITY_TOOL_ORDER.filter((toolName) => toolNames.includes(toolName)),
    ...toolNames
      .filter((toolName) => !LOW_PRIORITY_TOOL_ORDER.includes(toolName as (typeof LOW_PRIORITY_TOOL_ORDER)[number]))
      .sort(),
  ]

  let currentCount = toolNames.length
  let removed = 0

  for (const toolName of removableToolNames) {
    if (currentCount <= maxTools) break
    if (!filteredTools[toolName]) continue
    delete filteredTools[toolName]
    currentCount -= 1
    removed += 1
  }

  log(
    `[tool-registry] Trimmed ${removed} tools to satisfy max_tools=${maxTools}. Final plugin tool count=${currentCount}.`,
  )
}

export function createToolRegistry(args: {
  ctx: PluginContext
  pluginConfig: HiaiOpenCodeConfig
  managers: Pick<Managers, "backgroundManager" | "tmuxSessionManager" | "skillMcpManager">
  skillContext: SkillContext
  availableCategories: AvailableCategory[]
  builtinMcp?: Record<string, McpServerConfig>
  interactiveBashEnabled?: boolean
  toolFactories?: Partial<ToolRegistryFactories>
}): ToolRegistryResult {
  const {
    ctx,
    pluginConfig,
    managers,
    skillContext,
    availableCategories,
    builtinMcp,
    interactiveBashEnabled = isInteractiveBashEnabled(),
    toolFactories,
  } = args
  const factories: ToolRegistryFactories = {
    ...defaultToolRegistryFactories,
    ...toolFactories,
  }
  const backgroundTools = factories.createBackgroundTools(managers.backgroundManager, ctx.client)
  const callHiaiAgent = factories.createCallHiaiAgent(
    ctx,
    managers.backgroundManager,
    pluginConfig.disabled_agents ?? [],
    pluginConfig.agents,
    pluginConfig.categories,
  )

  const isMultimodalLookerEnabled = !(pluginConfig.disabled_agents ?? []).some(
    (agent) => agent.toLowerCase() === "vision",
  )
  const lookAt = isMultimodalLookerEnabled ? factories.createLookAt(ctx) : null

  const delegateTask = factories.createDelegateTask({
    manager: managers.backgroundManager,
    client: ctx.client,
    directory: ctx.directory,
    userCategories: pluginConfig.categories,
    agentOverrides: pluginConfig.agents,
    gitMasterConfig: pluginConfig.git_master,
    bobJuniorModel: pluginConfig.agents?.["sub"]?.model,
    browserProvider: skillContext.browserProvider,
    disabledSkills: skillContext.disabledSkills,
    availableCategories,
    availableSkills: skillContext.availableSkills,
    bobAgentConfig: pluginConfig.bob_agent,
    syncPollTimeoutMs: pluginConfig.background_task?.syncPollTimeoutMs,
    onSyncSessionCreated: async (event) => {
      log("[index] onSyncSessionCreated callback", {
        sessionID: event.sessionID,
        parentID: event.parentID,
        title: event.title,
      })
      await managers.tmuxSessionManager.onSessionCreated({
        type: "session.created",
        properties: {
          info: {
            id: event.sessionID,
            parentID: event.parentID,
            title: event.title,
          },
        },
      })

    },
  })

  const getSessionIDForMcp = (): string | undefined => getMainSessionID()

  const skillMcpTool = factories.createSkillMcpTool({
    manager: managers.skillMcpManager,
    getLoadedSkills: () => skillContext.mergedSkills,
    getSessionID: getSessionIDForMcp,
    builtinMcp,
  })

  const commands = factories.discoverCommandsSync(ctx.directory, {
    pluginsEnabled: pluginConfig.claude_code?.plugins ?? true,
    enabledPluginsOverride: pluginConfig.claude_code?.plugins_override,
  })
  const skillTool = factories.createSkillTool({
    commands,
    skills: skillContext.mergedSkills,
    mcpManager: managers.skillMcpManager,
    getSessionID: getSessionIDForMcp,
    gitMasterConfig: pluginConfig.git_master,
    browserProvider: skillContext.browserProvider,
    nativeSkills: "skills" in ctx ? (ctx as { skills: SkillLoadOptions["nativeSkills"] }).skills : undefined,
  })

  const taskSystemEnabled = isTaskSystemEnabled(pluginConfig)
  const taskToolsRecord: Record<string, ToolDefinition> = taskSystemEnabled
    ? {
        task_create: factories.createTaskCreateTool(pluginConfig, ctx),
        task_get: factories.createTaskGetTool(pluginConfig),
        task_list: factories.createTaskList(pluginConfig),
        task_update: factories.createTaskUpdateTool(pluginConfig, ctx),
      }
    : {}

  const hashlineEnabled = pluginConfig.hashline_edit ?? false
  const hashlineToolsRecord: Record<string, ToolDefinition> = hashlineEnabled
    ? { edit: factories.createHashlineEditTool(ctx) }
    : {}

  const agentBrowserIntegrationTools: ToolDefinition[] = Array.from(factories.createAgentBrowserIntegrationTool())
  const agentBrowserTools: ToolDefinition[] = Array.from(factories.createAgentBrowserTool(ctx))

  const agentBrowserToolEntries: Record<string, ToolDefinition> = {}
  for (const t of agentBrowserIntegrationTools) {
    ;(agentBrowserToolEntries as any)[(t as any).name] = t
  }
  for (const t of agentBrowserTools) {
    ;(agentBrowserToolEntries as any)[(t as any).name] = t
  }

  const allTools: Record<string, ToolDefinition> = {
    ...factories.builtinTools,
    ...factories.createGrepTools(ctx),
    ...factories.createGlobTools(ctx),
    ...factories.createAstGrepTools(ctx),
    ...factories.createSessionManagerTools(ctx),
    ...backgroundTools,
    call_hiai_agent: callHiaiAgent,
    ...(lookAt ? { look_at: lookAt } : {}),
    task: delegateTask,
    skill_mcp: skillMcpTool,
    skill: skillTool,
    ...(interactiveBashEnabled ? { interactive_bash: factories.interactive_bash } : {}),
    ...taskToolsRecord,
    ...hashlineToolsRecord,
    ...agentBrowserToolEntries,
  }

  for (const toolDefinition of Object.values(allTools)) {
    normalizeToolArgSchemas(toolDefinition)
  }

  const filteredTools: ToolsRecord = filterDisabledTools(allTools, pluginConfig.disabled_tools)

  const maxTools = pluginConfig.experimental?.max_tools
  if (maxTools) {
    trimToolsToCap(filteredTools, maxTools)
  }

  return {
    filteredTools,
    taskSystemEnabled,
  }
}
