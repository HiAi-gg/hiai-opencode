import type { AgentConfig } from "@opencode-ai/sdk";
import type { AgentMode, AgentPromptMetadata } from "../types";
import type {
  AvailableAgent,
  AvailableSkill,
  AvailableCategory,
} from "../dynamic-agent-prompt-builder";
import { categorizeTools } from "../dynamic-agent-prompt-builder";
import { buildDynamicBobPrompt } from "./core";

const MODE: AgentMode = "primary";

export const BOB_PROMPT_METADATA: AgentPromptMetadata = {
  category: "utility",
  cost: "EXPENSIVE",
  promptAlias: "Bob",
  promptVersion: "2026-04-26",
  triggers: [],
};

/**
 * Default Bob agent (Claude models).
 * Thinking config enabled, no reasoningEffort.
 */
export function createBobAgent(
  model: string,
  availableAgents?: AvailableAgent[],
  availableToolNames?: string[],
  availableSkills?: AvailableSkill[],
  availableCategories?: AvailableCategory[],
  useTaskSystem = false,
): AgentConfig {
  const tools = availableToolNames ? categorizeTools(availableToolNames) : [];
  const skills = availableSkills ?? [];
  const categories = availableCategories ?? [];
  const agents = availableAgents ?? [];

  const prompt = buildDynamicBobPrompt(
    model,
    agents,
    tools,
    skills,
    categories,
    useTaskSystem,
  );

  return {
    description:
      "Powerful AI orchestrator. Plans obsessively with todos, assesses search complexity before research, and delegates strategically via category+skills combinations. Uses researcher for internal/external discovery, strategist for architecture, and critic as high-risk gate. (Bob - HiaiOpenCode)",
    mode: MODE,
    model,
    maxTokens: 64000,
    prompt,
    color: "#00CED1",
    permission: {
      question: "allow",
      bash: "deny",
      edit: "deny",
      write: "deny",
      call_hiai_agent: "deny",
    } as AgentConfig["permission"],
    thinking: { type: "enabled", budgetTokens: 32000 },
  };
}
createBobAgent.mode = MODE;
