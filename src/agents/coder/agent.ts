import type { AgentConfig } from "@opencode-ai/sdk";
import type { AgentMode, AgentPromptMetadata } from "../types";
import { isGpt5_4Model, isGpt5_3CodexModel } from "../types";
import type {
  AvailableAgent,
  AvailableTool,
  AvailableSkill,
  AvailableCategory,
} from "../dynamic-agent-prompt-builder";
import { categorizeTools, buildAgentIdentitySection } from "../dynamic-agent-prompt-builder";
import { getGptApplyPatchPermission } from "../gpt-apply-patch-guard";

import { buildCoderPrompt as buildGptPrompt } from "./gpt";
import { buildCoderPrompt as buildGpt53CodexPrompt } from "./gpt-5-3-codex";
import { buildCoderPrompt as buildGpt54Prompt } from "./gpt-5-4";

const MODE: AgentMode = "primary";

export type CoderPromptSource = "gpt-5-4" | "gpt-5-3-codex" | "gpt";

export function getCoderPromptSource(
  model?: string,
): CoderPromptSource {
  if (model && isGpt5_4Model(model)) {
    return "gpt-5-4";
  }
  if (model && isGpt5_3CodexModel(model)) {
    return "gpt-5-3-codex";
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
    case "gpt-5-4":
      basePrompt = buildGpt54Prompt(
        agents,
        tools,
        skills,
        categories,
        useTaskSystem,
      );
      break;
    case "gpt-5-3-codex":
      basePrompt = buildGpt53CodexPrompt(
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
    "Autonomous deep worker for software engineering from HiaiOpenCode",
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
      "Autonomous Deep Worker - goal-oriented execution with GPT Codex. Explores thoroughly before acting, uses explore/librarian agents for comprehensive context, completes tasks end-to-end. Inspired by AmpCode deep mode. (Coder - HiaiOpenCode)",
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
    "Task requires deep exploration before implementation",
    "User wants autonomous end-to-end completion",
    "Complex multi-file changes needed",
  ],
  avoidWhen: [
    "Simple single-step tasks",
    "Tasks requiring user confirmation at each step",
    "When orchestration across multiple agents is needed (use Guard)",
  ],
  keyTrigger: "Complex implementation task requiring autonomous deep work",
};
