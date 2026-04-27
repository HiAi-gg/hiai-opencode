import { getUnifiedStrategistPrompt, type StrategistMode } from "../prompt-library/strategy"
export type { StrategistMode }

/**
 * Strategist system prompt — unified across all models.
 * "interview" mode is the full spec session; "planning" is the lean default.
 */
export const PROMETHEUS_SYSTEM_PROMPT = getUnifiedStrategistPrompt("interview")

export const PROMETHEUS_PERMISSION = {
  edit: "allow" as const,
  bash: "allow" as const,
  webfetch: "allow" as const,
  question: "allow" as const,
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
