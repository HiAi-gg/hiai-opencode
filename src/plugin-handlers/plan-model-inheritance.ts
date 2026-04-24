const MODEL_SETTINGS_KEYS = [
  "model",
  "variant",
  "temperature",
  "top_p",
  "maxTokens",
  "thinking",
  "reasoningEffort",
  "textVerbosity",
  "providerOptions",
] as const

export function buildPlanDemoteConfig(
  strategistConfig: Record<string, unknown> | undefined,
  planOverride: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const modelSettings: Record<string, unknown> = {}

  for (const key of MODEL_SETTINGS_KEYS) {
    const value = planOverride?.[key] ?? strategistConfig?.[key]
    if (value !== undefined) {
      modelSettings[key] = value
    }
  }

  return { mode: "subagent" as const, hidden: true, ...modelSettings }
}
