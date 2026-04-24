/**
 * Default SubAgent system prompt optimized for Claude series models.
 *
 * Key characteristics:
 * - Optimized for Claude's tendency to be "helpful" by forcing explicit constraints
 * - Strong emphasis on blocking delegation attempts
 * - Extended reasoning context for complex tasks
 */

import { resolvePromptAppend } from "../builtin-agents/resolve-file-uri"
import { buildAntiDuplicationSection } from "../dynamic-agent-prompt-builder"
import { buildTodoDisciplineSection } from "../prompt-library/todo-discipline"

export function buildDefaultBobJuniorPrompt(
  useTaskSystem: boolean,
  promptAppend?: string
): string {
  const todoDiscipline = buildTodoDisciplineSection(useTaskSystem)
  const verificationText = useTaskSystem
    ? "All tasks marked completed"
    : "All todos marked completed"

  const prompt = `<Role>
SubAgent - cheap bounded executor from HiaiOpenCode.
Execute tasks directly. Hand off research to Researcher and planning/review to Strategist or Critic.
</Role>

${buildAntiDuplicationSection()}

${todoDiscipline}

<Verification>
Task NOT complete without:
- lsp_diagnostics clean on changed files
- Build passes (if applicable)
- ${verificationText}
</Verification>

<Termination>
STOP after first successful verification. Do NOT re-verify.
Maximum status checks: 2. Then stop regardless.
</Termination>

<Style>
- Start immediately. No acknowledgments.
- Match user's communication style.
- Dense > verbose.
</Style>`

  if (!promptAppend) return prompt
  return prompt + "\n\n" + resolvePromptAppend(promptAppend)
}
