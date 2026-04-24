import { getGptStrategistPrompt } from "./gpt"
import { getGeminiStrategistPrompt } from "./gemini"
import { isGptModel, isGeminiModel } from "../types"

import { getUnifiedStrategistPrompt, type StrategistMode } from "../prompt-library/strategy"
export type { StrategistMode }

/**
 * Combined Strategist system prompt (Claude-optimized, default).
 * Uses "interview" mode for backward compat — full prompt with all sections.
 * For leaner planning calls, use getStrategistPrompt(model, tools, "planning").
 */
export const PROMETHEUS_SYSTEM_PROMPT = getUnifiedStrategistPrompt("interview")

export const PROMETHEUS_PERMISSION = {
  edit: "allow" as const,
  bash: "allow" as const,
  webfetch: "allow" as const,
  question: "allow" as const,
}

export type StrategistPromptSource = "default" | "gpt" | "gemini"

export function getStrategistPromptSource(model?: string): StrategistPromptSource {
  if (model && isGptModel(model)) {
    return "gpt"
  }
  if (model && isGeminiModel(model)) {
    return "gemini"
  }
  return "default"
}

/**
 * Gets the appropriate Strategist prompt based on model and mode.
 * Mode defaults to "planning" for lean default calls; pass "interview" for full spec sessions.
 */
export function getStrategistPrompt(
  model?: string,
  disabledTools?: readonly string[],
  mode: StrategistMode = "planning",
): string {
  const source = getStrategistPromptSource(model)
  const isQuestionDisabled = disabledTools?.includes("question") ?? false

  let prompt: string
  switch (source) {
    case "gpt":
      prompt = getGptStrategistPrompt()
      break
    case "gemini":
      prompt = getGeminiStrategistPrompt()
      break
    case "default":
    default:
      prompt = getUnifiedStrategistPrompt(mode)
  }

  if (isQuestionDisabled) {
    prompt = stripQuestionToolReferences(prompt)
  }

  return prompt
}

function stripQuestionToolReferences(prompt: string): string {
  return prompt.replace(/```typescript\n\s*Question\(\{[\s\S]*?\}\)\s*\n```/g, "")
}
