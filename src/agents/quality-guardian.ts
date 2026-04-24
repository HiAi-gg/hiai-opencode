import type { AgentConfig } from "@opencode-ai/sdk";
import type { AgentMode, AgentPromptMetadata } from "./types";
import { createAgentToolRestrictions } from "../shared/permission-compat";
import { isGptModel } from "./types";

const MODE: AgentMode = "subagent";

const QUALITY_GUARDIAN_PROMPT = `
<identity>
You are Quality Guardian, a specialized agent merging the capabilities of Code-Reviewer and Systematic-Debugger.
Your primary role is to ensure code quality after implementation and investigate complex bugs.
</identity>

<modes>
## MODE: Code Review (Post-Implementation)
- Review code against requirements.
- Identify design flaws, anti-patterns, and security vulnerabilities.
- Provide actionable feedback.

## MODE: Structured Debugging (Bug Investigation)
- Systematically trace bugs from symptoms to root cause.
- Hypothesize potential causes and verify them using logs or execution traces.
- Propose robust fixes.
</modes>

<instructions>
- Always start by analyzing the context and identifying the current mode.
- Output clear, numbered steps or bullet points for your review findings or debugging steps.
- Make direct, concise recommendations.
- Avoid solving the problem directly if you just need to provide feedback, but if asked to fix, apply the fix carefully.
</instructions>
`;

export function createQualityGuardianAgent(model: string): AgentConfig {
  const restrictions = createAgentToolRestrictions([
    "write",
    "edit",
    "apply_patch",
    "task",
  ]);

  return {
    description: "Specialized in post-implementation code review and structured bug investigation. (Quality Guardian - HiaiOpenCode)",
    mode: MODE,
    model,
    temperature: 0.2,
    ...restrictions,
    prompt: QUALITY_GUARDIAN_PROMPT,
    thinking: { type: "enabled", budgetTokens: 16000 },
  } as AgentConfig;
}
createQualityGuardianAgent.mode = MODE;

export const qualityGuardianPromptMetadata: AgentPromptMetadata = {
  category: "advisor",
  cost: "CHEAP",
  promptAlias: "Quality Guardian",
  triggers: [
    {
      domain: "Code Review",
      trigger: "After major code completion or feature implementation",
    },
    {
      domain: "Debugging",
      trigger: "When facing a bug that requires systematic tracing and root cause analysis",
    },
  ],
  useWhen: [
    "Need a thorough review of newly written code",
    "Investigating a complex or persistent bug",
  ],
  avoidWhen: [
    "General feature planning (use Strategist)",
    "Simple code implementation (use Coder)",
  ],
};
