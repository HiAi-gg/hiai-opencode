import os from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Config, Hooks, Plugin, PluginInput } from "@opencode-ai/plugin";
import {
  applyPromptOverride,
  createAllAgents,
  resolveAgentModel,
} from "./agents";
import { BUILD_PROMPT } from "./agents/build";
import { EXPLORE_PROMPT } from "./agents/explore";
import { GENERAL_PROMPT } from "./agents/general";
import { PLAN_PROMPT } from "./agents/plan";
import { getToolSetting, loadConfig } from "./config";
import { BackgroundManager } from "./features/background-manager/index";
import {
  createBobCompletionHook,
  setCompletionClient,
} from "./features/completion-controller";
import { createDreamDistillHook } from "./features/dream-distill";
import { getMcpConfig } from "./features/mcp/registry";
import { autoExportStaticMcp } from "./features/mcp/auto-export";
import { initShellEnv } from "./features/shell-env";
import { initTelemetry, shutdownTelemetry } from "./features/telemetry/index";
import {
  setWorkspaceAdapter,
  WorkspaceAdapter,
} from "./features/workspace-adapter";
import { combineHookSets, createHooks } from "./hooks/index";
import { createCircuitBreakerHook } from "./hooks/circuit-breaker";
import { createMemoryService } from "./memory/service";
import {
  applyAgentPermissions,
  getDefaultExternalDirectory,
} from "./permissions";
import { createAgentBrowserTools } from "./tools/agent-browser";
import {
  backgroundCancelTool,
  backgroundOutputTool,
  setBackgroundManager,
} from "./tools/background-task";
import {
  firecrawlMapTool,
  firecrawlScrapeTool,
  firecrawlSearchTool,
} from "./tools/firecrawl";
import {
  lspDiagnosticsTool,
  lspFindReferencesTool,
  lspGotoDefinitionTool,
  lspPrepareRenameTool,
  lspRenameTool,
  lspSymbolsTool,
} from "./tools/lsp";
import { setLspConfig } from "./tools/lsp/server-definitions";
import { createMemoryTool } from "./tools/memory-tool";
import {
  sessionInfoTool,
  sessionListTool,
  sessionReadTool,
  sessionSearchTool,
  setSessionClient,
} from "./tools/session-manager";
import { createSkillTool } from "./tools/skill";
import {
  hiai_worktree_create,
  hiai_worktree_list,
  hiai_worktree_remove,
  hiai_worktree_status,
} from "./tools/worktree";
import type { BobConfig, HookSet } from "./types";

const PLUGIN_NAME = "HiAiOpenCodePlugin";
const __dirname = dirname(fileURLToPath(import.meta.url));

export const BobPlugin: Plugin = async (input: PluginInput): Promise<Hooks> => {
  const config = loadConfig(input.directory);
  const agents = createAllAgents(config);
  const bobHooks = createHooks(config as BobConfig);
  const skillsDir = join(__dirname, "..", "skills");
  const memoryDataDir = join(os.homedir(), ".hiai-opencode", "data", "memory");
  const memoryDbPath = join(
    os.homedir(),
    ".hiai-opencode",
    "data",
    "hiai-memory.db",
  );

  // Init memory service
  const memoryService = createMemoryService({
    memoryRoot: memoryDataDir,
    dbPath: memoryDbPath,
    ccIndex: false,
    reconcileOnSearch: true,
    searchScoreFloor: config.completion ? 0.15 : 0.15,
  });

  // Init completion controller
  setCompletionClient(input.client);

  // Init session tools
  setSessionClient(input.client);

  // Init background manager
  const backgroundManager = new BackgroundManager(config.background_manager);
  setBackgroundManager(backgroundManager);
  backgroundManager.setClient(input.client);

  // Init workspace adapter (monorepo detection + project type detection)
  if (config.workspace?.enabled !== false) {
    const workspaceAdapter = new WorkspaceAdapter({
      cacheResults: config.workspace?.cache_results ?? true,
    });
    setWorkspaceAdapter(workspaceAdapter);
  }

  // Init LSP config
  if (config.lsp) setLspConfig(config.lsp);

  // Init telemetry
  if (config.telemetry?.enabled) {
    initTelemetry(config.telemetry);
  }

  // Init shell-env injection (project env vars → subprocesses)
  initShellEnv(config.shell_env, input.directory);

  const completionHooks =
    config.completion?.enabled !== false ? createBobCompletionHook(config) : {};

  // Init dream/distill auto-trigger
  const dreamDistillHooks = createDreamDistillHook(config, input.client);

  const hooks: Hooks = {};

  // ── Agent registration via config hook ──
  hooks.config = async (cfg: Config) => {
    try {
      // Auto-export a static .opencode/.mcp.json so hosts whose `opencode mcp
      // list` only reads static config can see hiai-managed servers. Controlled
      // by HIAI_OPENCODE_AUTO_EXPORT_MCP (if-missing | always | off). Best-effort.
      autoExportStaticMcp(config, input.directory);

      const agentCfg = ((cfg as Record<string, unknown>).agent ?? {}) as Record<
        string,
        Record<string, unknown>
      >;
      const c = cfg as Record<string, unknown>;
      let agentsDict = c.agent as Record<string, unknown>;
      agentsDict ??= {};
      c.agent = agentsDict;
      let mcpDict = c.mcp as Record<string, unknown> | undefined;

      // Upgrade native agents with our prompts/models
      const resolveModelForAgent = (agentKey: string): string | undefined => {
        return resolveAgentModel(agentKey, config as BobConfig);
      };

      // Helper: build default permissions for agent (read-only review agents get external_directory allow)
      const defaultPermsForAgent = (
        agentKey: string,
      ): Record<string, string> => {
        const perms: Record<string, string> = {};
        const ext = getDefaultExternalDirectory(agentKey);
        if (ext) perms.external_directory = ext;
        return perms;
      };

      // Upgrade explore — firecrawl + grep_app + context7 for deep codebase exploration
      {
        const existing = agentCfg.explore ?? {};
        const { permission, tools: restrictionTools } = applyAgentPermissions(
          config.agent_restrictions?.explore,
          {
            firecrawl_search: true,
            firecrawl_scrape: true,
            firecrawl_map: true,
          },
          defaultPermsForAgent("explore"),
        );
        agentsDict.explore = {
          ...existing,
          description:
            "Explore Agent — firecrawl + grep_app + context7 for deep codebase exploration",
          mode: "subagent",
          hidden: true,
          model: resolveModelForAgent("explore") ?? resolveModelForAgent("bob"),
          prompt: applyPromptOverride("explore", EXPLORE_PROMPT, config),
          temperature: getToolSetting("agent_temp_explore", 0.1),
          tools: restrictionTools,
          ...(Object.keys(permission).length > 0 ? { permission } : {}),
        };
      }

      // Upgrade plan → plan-level architect with thinking
      {
        const existing = agentCfg.plan ?? {};
        const { permission, tools } = applyAgentPermissions(
          config.agent_restrictions?.plan,
          {},
          defaultPermsForAgent("plan"),
        );
        agentsDict.plan = {
          ...existing,
          description:
            "Principal Architect — deep planning, architecture analysis, phased execution graphs",
          mode: "all",
          model: resolveModelForAgent("plan") ?? resolveModelForAgent("bob"),
          prompt: applyPromptOverride("plan", PLAN_PROMPT, config),
          temperature: getToolSetting("agent_temp_plan", 0.1),
          thinking: {
            type: "enabled",
            budgetTokens: getToolSetting("thinking_budget_plan", 16000),
          },
          ...(Object.keys(permission).length > 0 ? { permission } : {}),
          ...(Object.keys(tools).length > 0 ? { tools } : {}),
        };
      }

      // Upgrade build → build-level builder with verification gates
      {
        const existing = agentCfg.build ?? {};
        const { permission, tools } = applyAgentPermissions(
          config.agent_restrictions?.build,
          {},
          defaultPermsForAgent("build"),
        );
        agentsDict.build = {
          ...existing,
          description:
            "Senior Staff Engineer — implements from plans with mandatory verification gates",
          mode: "subagent",
          hidden: true,
          model: resolveModelForAgent("build") ?? resolveModelForAgent("bob"),
          prompt: applyPromptOverride("build", BUILD_PROMPT, config),
          temperature: getToolSetting("agent_temp_build", 0.2),
          thinking: {
            type: "enabled",
            budgetTokens: getToolSetting("thinking_budget_build", 16000),
          },
          ...(Object.keys(permission).length > 0 ? { permission } : {}),
          ...(Object.keys(tools).length > 0 ? { tools } : {}),
        };
      }

      // Upgrade general → general-level cheap executor
      {
        const existing = agentCfg.general ?? {};
        const { permission, tools } = applyAgentPermissions(
          config.agent_restrictions?.general,
          {},
          defaultPermsForAgent("general"),
        );
        agentsDict.general = {
          ...existing,
          description:
            "Cheap bounded executor — fast, simple tasks, fallback for failed agents",
          mode: "all",
          model:
            resolveModelForAgent("general") ?? resolveModelForAgent("manager"),
          prompt: applyPromptOverride("general", GENERAL_PROMPT, config),
          temperature: getToolSetting("agent_temp_general", 0.1),
          ...(Object.keys(permission).length > 0 ? { permission } : {}),
          ...(Object.keys(tools).length > 0 ? { tools } : {}),
        };
      }

      for (const agent of agents) {
        const name = agent.key;
        const existing = agentCfg[name] ?? {};

        const { permission, tools } = applyAgentPermissions(
          config.agent_restrictions?.[agent.key],
          {},
          defaultPermsForAgent(name),
        );

        agentsDict[name] = {
          ...existing,
          description: agent.config.description,
          mode: agent.config.mode,
          ...(agent.config.model ? { model: agent.config.model } : {}),
          prompt: agent.config.prompt,
          ...(agent.config.temperature !== undefined
            ? { temperature: agent.config.temperature }
            : {}),
          ...(agent.config.thinking ? { thinking: agent.config.thinking } : {}),
          ...(Object.keys(permission).length > 0 ? { permission } : {}),
          ...(Object.keys(tools).length > 0 ? { tools } : {}),
          ...(agent.config.hidden ? { hidden: true } : {}),
        };
      }

      // Validate and register MCP config
      if (Object.keys(config.mcp ?? {}).length > 0) {
        mcpDict ??= {};
        c.mcp = mcpDict;
        const validated = getMcpConfig(config.mcp ?? {}, config.auth);
        for (const [key, value] of Object.entries(validated)) {
          mcpDict[key] = value;
        }
        // Also pass through any user MCP configs not in the registry
        for (const [key, value] of Object.entries(config.mcp ?? {})) {
          if (value.enabled && !validated[key]) {
            mcpDict[key] = value;
          }
        }
      }

      if (config.dream)
        c.dream = {
          ...((c.dream ?? {}) as Record<string, unknown>),
          ...config.dream,
        };
      if (config.distill)
        c.distill = {
          ...((c.distill ?? {}) as Record<string, unknown>),
          ...config.distill,
        };
    } catch (e) {
      console.error("[HiAiOpenCodePlugin] config hook error:", e);
    }
  };

  // ── Behavioural hooks (combined using same chain-with-BlockingHookError pattern) ──
  {
    const combined = combineHookSets([
      bobHooks,
      completionHooks as HookSet,
      dreamDistillHooks as HookSet,
      // Circuit breaker: feeds tool calls into BackgroundManager so the
      // consecutive-identical and total-call limits can abort runaway sessions.
      createCircuitBreakerHook(config as BobConfig, backgroundManager),
    ]);
    const h = hooks as Record<string, unknown>;
    for (const key of Object.keys(combined)) {
      if (key === "dispose") continue; // dispose handled separately
      const fn = (combined as Record<string, unknown>)[key];
      if (fn) h[key] = fn;
    }
  }

  // ── Tools ──
  hooks.tool = {
    skill: createSkillTool(skillsDir),
    ...createAgentBrowserTools(),
    lsp_diagnostics: lspDiagnosticsTool,
    lsp_goto_definition: lspGotoDefinitionTool,
    lsp_find_references: lspFindReferencesTool,
    lsp_symbols: lspSymbolsTool,
    lsp_prepare_rename: lspPrepareRenameTool,
    lsp_rename: lspRenameTool,
    session_list: sessionListTool,
    session_read: sessionReadTool,
    session_search: sessionSearchTool,
    session_info: sessionInfoTool,
    background_output: backgroundOutputTool,
    background_cancel: backgroundCancelTool,
    hiai_memory_search: createMemoryTool(memoryService),
    hiai_worktree_create,
    hiai_worktree_remove,
    hiai_worktree_list,
    hiai_worktree_status,
    firecrawl_search: firecrawlSearchTool,
    firecrawl_scrape: firecrawlScrapeTool,
    firecrawl_map: firecrawlMapTool,
  };

  hooks.dispose = async () => {
    if (bobHooks.dispose) await bobHooks.dispose();
    await shutdownTelemetry();
    console.log(`[${PLUGIN_NAME}] disposed`);
  };

  console.log(
    `[${PLUGIN_NAME}] loaded: ${agents.length} agents, ${Object.keys(hooks.tool ?? {}).length} tools, hooks ready`,
  );

  return hooks;
};

const plugin = {
  id: "hiai-opencode",
  server: BobPlugin,
};

export default plugin;
