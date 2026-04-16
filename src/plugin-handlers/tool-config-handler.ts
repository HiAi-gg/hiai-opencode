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

  const librarian = agentByKey(params.agentResult, "librarian");
  if (librarian) {
    librarian.permission = { ...librarian.permission, "grep_app_*": "allow" };
  }
  const looker = agentByKey(params.agentResult, "ui");
  if (looker) {
    looker.permission = { ...looker.permission, task: "deny", look_at: "deny" };
  }
  const guard = agentByKey(params.agentResult, "guard");
  if (guard) {
    guard.permission = {
      ...guard.permission,
      task: "allow",
      call_omo_agent: "deny",
      "task_*": "allow",
      teammate: "allow",
      ...denyTodoTools,
    };
  }
  const bob = agentByKey(params.agentResult, "bob");
  if (bob) {
    bob.permission = {
      ...bob.permission,
      call_omo_agent: "deny",
      task: "allow",
      question: questionPermission,
      "task_*": "allow",
      teammate: "allow",
      ...denyTodoTools,
    };
  }
  const coder = agentByKey(params.agentResult, "coder");
  if (coder) {
    coder.permission = {
      ...coder.permission,
      call_omo_agent: "deny",
      task: "allow",
      question: questionPermission,
      ...denyTodoTools,
    };
  }
  const strategist = agentByKey(params.agentResult, "strategist");
  if (strategist) {
    strategist.permission = {
      ...strategist.permission,
      call_omo_agent: "deny",
      task: "allow",
      question: questionPermission,
      "task_*": "allow",
      teammate: "allow",
      ...denyTodoTools,
    };
  }
  const junior = agentByKey(params.agentResult, "sub");
  if (junior) {
    junior.permission = {
      ...junior.permission,
      task: "allow",
      "task_*": "allow",
      teammate: "allow",
      ...denyTodoTools,
    };
  }

  params.config.permission = {
    webfetch: "allow",
    external_directory: "allow",
    ...(params.config.permission as Record<string, unknown>),
    task: "deny",
  };
}
