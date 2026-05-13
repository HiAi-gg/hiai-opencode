import type { AgentConfig } from "@opencode-ai/sdk";
import type { AgentMode, AgentPromptMetadata } from "./types";
import { createAgentToolRestrictions } from "../shared/permission-compat";
import { buildAgentIdentitySection } from "./prompt-library/identity";

const MODE: AgentMode = "subagent";

const QUALITY_GUARDIAN_PROMPT = buildAgentIdentitySection("Quality Guardian", "code review and debugging specialist") + `

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

<edit_permission_note>
## EDIT PERMISSION — STRICT BOUNDARY

If you are granted the \`edit\` tool for marking plan checkboxes:
- \`edit\` on \`.bob/plans/*.md\` files ONLY — to toggle \`- [ ]\` → \`- [x]\` when verification passes
- \`edit\` on ANY file outside \`.bob/plans/\` is FORBIDDEN and will be BLOCKED by the runtime guard.
- Other write tools (\`write\`, \`bash\`, \`apply_patch\`) remain blocked.
</edit_permission_note>

<peer-agents>
- **Coder** — Owns implementation. After review, hand findings back to Coder; do not rewrite their code yourself.
- **Critic** — Pre-flight plan gate. Quality Guardian operates POST-implementation; Critic operates PRE-implementation.
- **Researcher** — For "is this a known pattern / bug / CVE" lookups via \`mcp__context7__*\` or \`firecrawl-cli\` (CLI skill).
- **MemPalace** — When a recurring class of bugs surfaces, search MemPalace directly to record the pattern.
</peer-agents>
`;

export function createQualityGuardianAgent(model: string): AgentConfig {
  const restrictions = createAgentToolRestrictions([
    "write",
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
