import { AGENT_NAME_MAP } from "./migration/agent-names"

/**
 * Agent config keys to display names mapping.
 * Config keys are lowercase (e.g., "bob", "guard").
 * Display names include suffixes for UI/logs (e.g., "Bob - Ultraworker").
 *
 * IMPORTANT: Display names MUST NOT contain parentheses or other characters
 * that are invalid in HTTP header values per RFC 7230. OpenCode passes the
 * agent name in the `x-opencode-agent-name` header, and parentheses cause
 * header validation failures that prevent agents from appearing in the UI
 * type selector dropdown. Use ` - ` (space-dash-space) instead of `(...)`.
 */
export const AGENT_DISPLAY_NAMES: Record<string, string> = {
  "bob": "Bob - Ultraworker",
  "coder": "Coder - Deep Agent",
  "strategist": "Strategist - Plan Builder",
  "critic": "Critic - Plan Critic",
  "researcher": "Researcher - Codebase Explorer",
  "quality-guardian": "Quality Guardian - Verifier",
  "platform-manager": "Platform Manager - Utility",
  "guard": "Guard - Plan Executor",
  "sub": "SubAgent",
  "ui": "ui",
}

const AGENT_LIST_SORT_PREFIXES: Record<string, string> = {
  "bob": "\u200B",
  "coder": "\u200B\u200B",
  "strategist": "\u200B\u200B\u200B",
  "guard": "\u200B\u200B\u200B\u200B",
}

const INVISIBLE_AGENT_CHARACTERS_REGEX = /[\u200B\u200C\u200D\uFEFF]/g

export function stripInvisibleAgentCharacters(agentName: string): string {
  return agentName.replace(INVISIBLE_AGENT_CHARACTERS_REGEX, "")
}

export function stripAgentListSortPrefix(agentName: string): string {
  return stripInvisibleAgentCharacters(agentName)
}

export function getAgentRuntimeName(configKey: string): string {
  const canonicalKey = resolveKnownAgentConfigKey(configKey) ?? configKey
  const displayName = getAgentDisplayName(canonicalKey)
  const prefix = AGENT_LIST_SORT_PREFIXES[canonicalKey.toLowerCase()]

  return prefix ? `${prefix}${displayName}` : displayName
}

/**
 * Get display name for an agent config key.
 * Uses case-insensitive lookup for backward compatibility.
 * Returns original key if not found.
 */
export function getAgentDisplayName(configKey: string): string {
  const resolvedConfigKey = resolveKnownAgentConfigKey(configKey)
  if (resolvedConfigKey !== undefined) {
    const resolvedDisplayName = AGENT_DISPLAY_NAMES[resolvedConfigKey]
    if (resolvedDisplayName !== undefined) return resolvedDisplayName
  }

  // Try exact match first
  const exactMatch = AGENT_DISPLAY_NAMES[configKey]
  if (exactMatch !== undefined) return exactMatch
  
  // Fall back to case-insensitive search
  const lowerKey = configKey.toLowerCase()
  for (const [k, v] of Object.entries(AGENT_DISPLAY_NAMES)) {
    if (k.toLowerCase() === lowerKey) return v
  }
  
  // Unknown agent: return original key
  return configKey
}

/**
 * Runtime-facing agent name used for OpenCode list ordering.
 */
export function getAgentListDisplayName(configKey: string): string {
  return getAgentRuntimeName(configKey)
}

const REVERSE_DISPLAY_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(AGENT_DISPLAY_NAMES).map(([key, displayName]) => [displayName.toLowerCase(), key]),
)

// Legacy parenthesized display names for backward compatibility.
// Old configs/sessions may reference these names; resolve them to config keys.
const LEGACY_DISPLAY_NAMES: Record<string, string> = {
  "bob (ultraworker)": "bob",
  "coder (deep agent)": "coder",
  "strategist (plan builder)": "strategist",
  "guard (plan executor)": "guard",
  "pre-plan (plan consultant)": "strategist",
  "critic (plan critic)": "critic",
  "athena (council)": "strategist",
  "athena-junior (council)": "strategist",
  "researcher (codebase explorer)": "researcher",
  "quality guardian (verifier)": "quality-guardian",
  "platform manager (utility)": "platform-manager",
}

function resolveKnownAgentConfigKey(agentName: string): string | undefined {
  const lower = stripAgentListSortPrefix(agentName).trim().toLowerCase()
  if (!lower) return undefined

  const reversed = REVERSE_DISPLAY_NAMES[lower]
  if (reversed !== undefined) return reversed

  const legacy = LEGACY_DISPLAY_NAMES[lower]
  if (legacy !== undefined) return legacy

  const migrated = AGENT_NAME_MAP[lower]
  if (migrated !== undefined) return migrated

  if (AGENT_DISPLAY_NAMES[lower] !== undefined) return lower

  return undefined
}

/**
 * Resolve an agent name (display name or config key) to its lowercase config key.
 * "Guard - Plan Executor" -> "guard", "Guard (Plan Executor)" -> "guard", "guard" -> "guard"
 */
export function getAgentConfigKey(agentName: string): string {
  const lower = stripAgentListSortPrefix(agentName).trim().toLowerCase()
  return resolveKnownAgentConfigKey(agentName) ?? lower
}

/**
 * Normalize an agent name for prompt APIs.
 * - Known display names -> canonical display names
 * - Known config keys (any case) -> canonical display names
 * - Unknown/custom names -> preserved as-is (trimmed)
 */
export function normalizeAgentForPrompt(agentName: string | undefined): string | undefined {
  if (typeof agentName !== "string") {
    return undefined
  }

  const trimmed = stripAgentListSortPrefix(agentName).trim()
  if (!trimmed) {
    return undefined
  }

  const configKey = resolveKnownAgentConfigKey(trimmed)
  if (configKey !== undefined) {
    return AGENT_DISPLAY_NAMES[configKey] ?? trimmed
  }

  return trimmed
}

export function normalizeAgentForPromptKey(agentName: string | undefined): string | undefined {
  if (typeof agentName !== "string") {
    return undefined
  }

  const trimmed = stripAgentListSortPrefix(agentName).trim()
  if (!trimmed) {
    return undefined
  }

  return resolveKnownAgentConfigKey(trimmed) ?? trimmed
}
