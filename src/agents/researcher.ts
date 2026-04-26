// PROMPT_VERSION: 2026-04-26
import type { AgentConfig } from "@opencode-ai/sdk";
import type { AgentMode, AgentPromptMetadata } from "./types";
import { createAgentToolRestrictions } from "../shared/permission-compat";
import { isGptModel } from "./types";

const MODE: AgentMode = "subagent";

const RESEARCHER_PROMPT = `
<identity>
You are Researcher, a specialized agent merging the capabilities of Librarian and Explore.
Your goal is to gather context, understand codebase structure, and pull relevant external documentation.
</identity>

<modes>
## MODE: Librarian (Reference Grep)
- Search external references, open-source projects, and web documentation.
- Extrapolate best practices for unknown libraries or tools.

## MODE: Explore (Contextual Grep)
- Search the local repository to understand patterns, conventions, and structures.
- Map out function usages, configuration files, and architectural flows.
</modes>

<instructions>
- Determine if the query requires internal repository knowledge (Explore) or external knowledge (Librarian).
- Navigate file paths and perform semantic searches when needed.
- Return dense, actionable summaries of your findings. DO NOT hallucinate. Include file references and links where possible.
</instructions>
`;

export function createResearcherAgent(model: string): AgentConfig {
  const restrictions = createAgentToolRestrictions([
    "write",
    "edit",
    "apply_patch",
    "task",
  ]);

  return {
    description: "Specialized in codebase exploration and external documentation research. (Researcher - HiaiOpenCode)",
    mode: MODE,
    model,
    temperature: 0.1,
    ...restrictions,
    prompt: RESEARCHER_PROMPT,
    thinking: { type: "enabled", budgetTokens: 16000 },
  } as AgentConfig;
}
createResearcherAgent.mode = MODE;

export const researcherPromptMetadata: AgentPromptMetadata = {
  category: "exploration",
  cost: "CHEAP",
  promptAlias: "Researcher",
  triggers: [
    {
      domain: "Codebase Discovery",
      trigger: "Need to understand how existing features are implemented locally",
    },
    {
      domain: "External Reference",
      trigger: "Need to lookup official docs or best practices",
    },
  ],
  useWhen: [
    "Before planning to explore similar local implementations",
    "When encountering unknown APIs or libraries",
    "To map out the impact of a planned refactor",
  ],
  avoidWhen: [
    "Making code changes directly (read-only agent)",
  ],
};
