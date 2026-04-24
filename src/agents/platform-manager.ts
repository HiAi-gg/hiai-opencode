import type { AgentConfig } from "@opencode-ai/sdk";
import type { AgentMode, AgentPromptMetadata } from "./types";
import { createAgentToolRestrictions } from "../shared/permission-compat";
import { buildPlatformManagerPrompt } from "./prompt-library/platform";

const MODE: AgentMode = "subagent";

export function createPlatformManagerAgent(model: string): AgentConfig {
  const restrictions = createAgentToolRestrictions([
    "write",
    "edit",
    "apply_patch",
    "task",
  ]);

  return {
    description:
      "Unified platform management agent for session continuity, project initialization, and mindmodel orchestration. (Manager - HiaiOpenCode)",
    mode: MODE,
    model,
    temperature: 0.2,
    ...restrictions,
    prompt: buildPlatformManagerPrompt(),
    thinking: { type: "enabled", budgetTokens: 16000 },
  } as AgentConfig;
}
createPlatformManagerAgent.mode = MODE;

export const platformManagerPromptMetadata: AgentPromptMetadata = {
  category: "utility",
  cost: "CHEAP",
  promptAlias: "Manager",
  triggers: [
    {
      domain: "Session management",
      trigger: "Need to preserve session state or create continuity ledgers",
    },
    {
      domain: "Project setup",
      trigger: "Initializing new projects or generating architecture docs",
    },
    {
      domain: "Mindmodel",
      trigger: "Generating or updating project mindmodels",
    },
  ],
  useWhen: [
    "At beginning of session for project initialization",
    "At end of session for ledger creation",
    "When mindmodel update is requested",
    "For rapid codebase discovery during bootstrapping",
  ],
  avoidWhen: [
    "General coding tasks",
    "Complex architecture deliberation (use Strategist)",
  ],
};
