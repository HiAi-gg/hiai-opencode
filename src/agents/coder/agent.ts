import type { AgentConfig } from "@opencode-ai/sdk";
import type { AgentMode, AgentPromptMetadata } from "../types";
import { isGptProModel, isGptCodexModel } from "../types";
import type {
  AvailableAgent,
  AvailableTool,
  AvailableSkill,
  AvailableCategory,
} from "../dynamic-agent-prompt-builder";
import { categorizeTools, buildAgentIdentitySection } from "../dynamic-agent-prompt-builder";
import { getGptApplyPatchPermission } from "../gpt-apply-patch-guard";

import { buildCoderPrompt as buildGptPrompt } from "./gpt";
import { buildCoderPrompt as buildGptCodexPrompt } from "./gpt-codex";
import { buildCoderPrompt as buildGptProPrompt } from "./gpt-pro";

const MODE: AgentMode = "primary";

export type CoderPromptSource = "gpt-pro" | "gpt-codex" | "gpt";

export function getCoderPromptSource(
  model?: string,
): CoderPromptSource {
  if (model && isGptProModel(model)) {
    return "gpt-pro";
  }
  if (model && isGptCodexModel(model)) {
    return "gpt-codex";
  }
  return "gpt";
}

export interface CoderContext {
  model?: string;
  availableAgents?: AvailableAgent[];
  availableTools?: AvailableTool[];
  availableSkills?: AvailableSkill[];
  availableCategories?: AvailableCategory[];
  useTaskSystem?: boolean;
}

export function getCoderPrompt(
  model?: string,
  useTaskSystem = false,
): string {
  return buildDynamicCoderPrompt({ model, useTaskSystem });
}

function buildDynamicCoderPrompt(ctx?: CoderContext): string {
  const agents = ctx?.availableAgents ?? [];
  const tools = ctx?.availableTools ?? [];
  const skills = ctx?.availableSkills ?? [];
  const categories = ctx?.availableCategories ?? [];
  const useTaskSystem = ctx?.useTaskSystem ?? false;
  const model = ctx?.model;

  const source = getCoderPromptSource(model);

  let basePrompt: string;
  switch (source) {
    case "gpt-pro":
      basePrompt = buildGptProPrompt(
        agents,
        tools,
        skills,
        categories,
        useTaskSystem,
      );
      break;
    case "gpt-codex":
      basePrompt = buildGptCodexPrompt(
        agents,
        tools,
        skills,
        categories,
        useTaskSystem,
      );
      break;
    case "gpt":
    default:
      basePrompt = buildGptPrompt(
        agents,
        tools,
        skills,
        categories,
        useTaskSystem,
      );
      break;
  }

  const agentIdentity = buildAgentIdentitySection(
    "Coder",
    "High-depth executor for software engineering from HiaiOpenCode",
  );

  return `${agentIdentity}\n${basePrompt}`;
}

export function createCoderAgent(
  model: string,
  availableAgents?: AvailableAgent[],
  availableToolNames?: string[],
  availableSkills?: AvailableSkill[],
  availableCategories?: AvailableCategory[],
  useTaskSystem = false,
): AgentConfig {
  const tools = availableToolNames ? categorizeTools(availableToolNames) : [];

  const prompt = buildDynamicCoderPrompt({
    model,
    availableAgents,
    availableTools: tools,
    availableSkills,
    availableCategories,
    useTaskSystem,
  });

  return {
    description:
      "High-depth executor - autonomous software engineering work with `gpt-pro`, `gpt-codex`, or `gpt`. Uses researcher for context gathering, escalates architecture/review gates via strategist/critic, and preserves a strict split where bounded low-risk edits belong to sub. (Coder - HiaiOpenCode)",
    mode: MODE,
    model,
    maxTokens: 32000,
    prompt,
    color: "#D97706",
    permission: {
      question: "allow",
      call_omo_agent: "deny",
      ...getGptApplyPatchPermission(model),
    } as AgentConfig["permission"],
    reasoningEffort: "medium",
  };
}
createCoderAgent.mode = MODE;

export const coderPromptMetadata: AgentPromptMetadata = {
  category: "specialist",
  cost: "EXPENSIVE",
  promptAlias: "Coder",
  triggers: [
    {
      domain: "Autonomous deep work",
      trigger: "End-to-end task completion without premature stopping",
    },
    {
      domain: "Complex implementation",
      trigger: "Multi-step implementation requiring thorough exploration",
    },
  ],
  useWhen: [
    "Task requires deep research before implementation",
    "User wants autonomous end-to-end completion",
    "Complex multi-file or high-context changes needed",
  ],
  avoidWhen: [
    "Simple single-step tasks",
    "Bounded low-risk edits that fit the sub contour",
    "Tasks requiring user confirmation at each step",
    "When orchestration across multiple agents is needed (use Guard)",
  ],
  keyTrigger: "Complex implementation task requiring autonomous deep work",
};
