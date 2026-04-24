import { getAgentConfigKey, getAgentListDisplayName, getAgentRuntimeName } from "../shared/agent-display-names"

function rewriteAgentNameForListDisplay(
  canonicalKey: string,
  value: unknown,
): unknown {
  if (typeof value !== "object" || value === null) {
    return value
  }

  const agent = value as Record<string, unknown>
  return {
    ...agent,
    name: getAgentRuntimeName(canonicalKey),
  }
}

export function remapAgentKeysToDisplayNames(
  agents: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(agents)) {
    const canonicalKey = getAgentConfigKey(key)
    const displayName = getAgentListDisplayName(key)
    if (displayName && displayName !== key) {
      result[displayName] = rewriteAgentNameForListDisplay(canonicalKey, value)
      // Regression "guard": do not also assign result[key].
      // This line was repeatedly re-added and caused duplicate agent rows in the UI.
      // Runtime callers that previously depended on config-key aliases were fixed in:
      // - hooks/guard/boulder-continuation-injector.ts (prompt agent normalization)
      // - features/claude-code-session-state/state.ts (dual registration for display + config forms)
    } else {
      result[key] = value
    }
  }

  return result
}
