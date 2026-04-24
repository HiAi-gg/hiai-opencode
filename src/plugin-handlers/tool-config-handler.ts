import type { HiaiOpenCodeConfig } from "../config";
import { getAgentDisplayName, getAgentListDisplayName } from "../shared/agent-display-names";
import { isTaskSystemEnabled } from "../shared";

type AgentWithPermission = { permission?: Record<string, unknown> };

function getConfigQuestionPermission(): string | null {
  const configContent = process.env.OPENCODE_CONFIG_CONTENT;
  if (!configContent) return null;
  try {
    const parsed = JSON.parse(configContent);
    return parsed?.permission?.question ?? null;
  } catch {
    return null;
  }
}

function agentByKey(agentResult: Record<string, unknown>, key: string): AgentWithPermission | undefined {
  return (agentResult[getAgentListDisplayName(key)] ?? agentResult[getAgentDisplayName(key)] ?? agentResult[key]) as
    | AgentWithPermission
    | undefined;
}

function applyPermissionToAgentKeys(args: {
  agentResult: Record<string, unknown>;
  keys: string[];
  apply: (agent: AgentWithPermission) => void;
}): void {
  const seen = new Set<AgentWithPermission>();
  for (const key of args.keys) {
    const agent = agentByKey(args.agentResult, key);
    if (!agent || seen.has(agent)) {
      continue;
    }
    seen.add(agent);
    args.apply(agent);
  }
}

const RESEARCH_AGENT_KEYS = ["researcher"];
const MULTIMODAL_AGENT_KEYS = ["multimodal", "ui"];
const BOB_AGENT_KEYS = ["bob", "general", "build", "zoe"];
const STRATEGIST_AGENT_KEYS = ["strategist", "plan-consultant"];
const CRITIC_AGENT_KEYS = ["critic"];
const SUB_AGENT_KEYS = ["sub", "subagent"];

export function applyToolConfig(params: {
  config: Record<string, unknown>;
  pluginConfig: HiaiOpenCodeConfig;
  agentResult: Record<string, unknown>;
}): void {
  const taskSystemEnabled = isTaskSystemEnabled(params.pluginConfig)
  const denyTodoTools = taskSystemEnabled
    ? { todowrite: "deny", todoread: "deny" }
    : {}

  const existingPermission = params.config.permission as Record<string, unknown> | undefined;
  const skillDeniedByHost = existingPermission?.skill === "deny";

  params.config.tools = {
    ...(params.config.tools as Record<string, unknown>),
    "grep_app_*": false,
    LspHover: false,
    LspCodeActions: false,
    LspCodeActionResolve: false,
    "task_*": false,
    teammate: false,
    ...(taskSystemEnabled
      ? { todowrite: false, todoread: false }
      : {}),
    ...(skillDeniedByHost
      ? { skill: false, skill_mcp: false }
      : {}),
  };

  const isCliRunMode = process.env.OPENCODE_CLI_RUN_MODE === "true";
  const configQuestionPermission = getConfigQuestionPermission();
  const isQuestionDisabledByPlugin = params.pluginConfig.disabled_tools?.includes("question") ?? false;
  const questionPermission =
    isQuestionDisabledByPlugin ? "deny" :
    configQuestionPermission === "deny" ? "deny" :
    isCliRunMode ? "deny" :
    "allow";

  applyPermissionToAgentKeys({
    agentResult: params.agentResult,
    keys: RESEARCH_AGENT_KEYS,
    apply: (agent) => {
      agent.permission = { ...agent.permission, "grep_app_*": "allow" };
    },
  });

  applyPermissionToAgentKeys({
    agentResult: params.agentResult,
    keys: MULTIMODAL_AGENT_KEYS,
    apply: (agent) => {
      agent.permission = { ...agent.permission, task: "deny", look_at: "allow" };
    },
  });

  applyPermissionToAgentKeys({
    agentResult: params.agentResult,
    keys: ["guard"],
    apply: (agent) => {
      agent.permission = {
        ...agent.permission,
        task: "allow",
        call_omo_agent: "deny",
        "task_*": "allow",
        teammate: "allow",
        ...denyTodoTools,
      };
    },
  });

  applyPermissionToAgentKeys({
    agentResult: params.agentResult,
    keys: BOB_AGENT_KEYS,
    apply: (agent) => {
      agent.permission = {
        ...agent.permission,
        call_omo_agent: "deny",
        task: "allow",
        question: questionPermission,
        "task_*": "allow",
        teammate: "allow",
        ...denyTodoTools,
      };
    },
  });

  applyPermissionToAgentKeys({
    agentResult: params.agentResult,
    keys: ["coder"],
    apply: (agent) => {
      agent.permission = {
        ...agent.permission,
        call_omo_agent: "deny",
        task: "allow",
        question: questionPermission,
        ...denyTodoTools,
      };
    },
  });

  applyPermissionToAgentKeys({
    agentResult: params.agentResult,
    keys: STRATEGIST_AGENT_KEYS,
    apply: (agent) => {
      agent.permission = {
        ...agent.permission,
        call_omo_agent: "deny",
        task: "allow",
        question: questionPermission,
        "task_*": "allow",
        teammate: "allow",
        ...denyTodoTools,
      };
    },
  });

  applyPermissionToAgentKeys({
    agentResult: params.agentResult,
    keys: CRITIC_AGENT_KEYS,
    apply: (agent) => {
      agent.permission = {
        ...agent.permission,
        call_omo_agent: "deny",
      };
    },
  });

  applyPermissionToAgentKeys({
    agentResult: params.agentResult,
    keys: SUB_AGENT_KEYS,
    apply: (agent) => {
      agent.permission = {
        ...agent.permission,
        task: "allow",
        "task_*": "allow",
        teammate: "allow",
        ...denyTodoTools,
      };
    },
  });

  params.config.permission = {
    webfetch: "allow",
    external_directory: "allow",
    ...(params.config.permission as Record<string, unknown>),
    task: "deny",
  };
}
