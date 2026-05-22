import type { AgentConfig } from "@opencode-ai/sdk";
import type { AgentMode } from "../types";
import { getGptApplyPatchPermission } from "../gpt-apply-patch-guard";
import type {
  AvailableAgent,
  AvailableSkill,
  AvailableCategory,
} from "../dynamic-agent-prompt-builder";
import { categorizeTools } from "../dynamic-agent-prompt-builder";
import { buildDynamicBobPrompt } from "./core";

const MODE: AgentMode = "primary";

/**
 * GPT-specific Bob overlay.
 * Uses reasoningEffort instead of thinking config.
 * Includes apply-patch permission for GPT models.
 */
export function createGptBobAgent(
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
      call_hiai_agent: "deny",
      ...getGptApplyPatchPermission(model),
    } as AgentConfig["permission"],
    reasoningEffort: "medium",
  };
}
createGptBobAgent.mode = MODE;
