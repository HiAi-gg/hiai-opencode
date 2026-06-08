import { getUnifiedStrategistPrompt, type StrategistMode } from "../prompt-library/strategy"
export type { StrategistMode }

/**
 * Strategist system prompt — unified across all models.
 * "interview" mode is the full spec session; "planning" is the lean default.
 */
export const STRATEGIST_SYSTEM_PROMPT = getUnifiedStrategistPrompt("interview")

export const STRATEGIST_PERMISSION = {
  edit: "allow" as const,       // allowed ONLY for .bob/*.md (enforced by strategist-md-only hook)
  bash: "deny" as const,        // denied: Strategist is planning-only, no shell execution
  webfetch: "allow" as const,   // allowed: research/web content reading
  question: "allow" as const,   // allowed: user interviews
  task: "allow" as const,       // allowed: can delegate to researcher/manager/critic/writer per delegate_to
}

export type StrategistPromptSource = "default"

/**
 * Gets the Strategist prompt. Model parameter retained for API compat; ignored.
 */
export function getStrategistPrompt(
  _model?: string,
  disabledTools?: readonly string[],
  mode: StrategistMode = "planning",
): string {
  let prompt = getUnifiedStrategistPrompt(mode)
  if (disabledTools?.includes("question")) {
    prompt = stripQuestionToolReferences(prompt)
  }
  return prompt
}

function stripQuestionToolReferences(prompt: string): string {
  return prompt.replace(/```typescript\n\s*Question\(\{[\s\S]*?\}\)\s*\n```/g, "")
}
