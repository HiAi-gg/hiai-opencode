import { getAgentConfigKey, stripInvisibleAgentCharacters } from "./agent-display-names"

/**
 * Agent tool restrictions for session.prompt calls.
 * OpenCode SDK's session.prompt `tools` parameter expects boolean values.
 * true = tool allowed, false = tool denied.
 */

const RESEARCHER_DENYLIST: Record<string, boolean> = {
  write: false,
  edit: false,
  task: false,
  call_omo_agent: false,
}

const CANONICAL_AGENT_RESTRICTIONS: Record<string, Record<string, boolean>> = {
  researcher: RESEARCHER_DENYLIST,
  critic: {
    write: false,
    edit: false,
    task: false,
  },
  multimodal: {
    read: true,
  },
  sub: {
    task: false,
  },
}

const LEGACY_AGENT_RESTRICTION_OVERRIDES: Record<string, Record<string, boolean>> = {
  ui: CANONICAL_AGENT_RESTRICTIONS.multimodal,
}

const LEGACY_AGENT_ALIAS_TO_CANONICAL: Record<string, string> = {
  ui: "multimodal",
  "plan-consultant": "critic",
}

function toNormalizedAgentKey(agentName: string): string {
  return stripInvisibleAgentCharacters(agentName).trim().toLowerCase()
}

function getRestrictionCandidates(agentName: string): string[] {
  const direct = toNormalizedAgentKey(agentName)
  const configKey = toNormalizedAgentKey(getAgentConfigKey(agentName))
  return direct === configKey ? [direct] : [direct, configKey]
}

function resolveRestrictions(agentName: string): Record<string, boolean> | undefined {
  const candidates = getRestrictionCandidates(agentName)

  for (const candidate of candidates) {
    const override = LEGACY_AGENT_RESTRICTION_OVERRIDES[candidate]
    if (override) {
      return override
    }
  }

  for (const candidate of candidates) {
    const canonicalKey = LEGACY_AGENT_ALIAS_TO_CANONICAL[candidate] ?? candidate
    const canonical = CANONICAL_AGENT_RESTRICTIONS[canonicalKey]
    if (canonical) {
      return canonical
    }
  }

  return undefined
}

export function getAgentToolRestrictions(agentName: string): Record<string, boolean> {
  // Custom/unknown agents get no restrictions (empty object), matching Claude Code's
  // trust model where project-registered agents retain full tool access including bash.
  return resolveRestrictions(agentName) ?? {}
}

export function hasAgentToolRestrictions(agentName: string): boolean {
  const restrictions = getAgentToolRestrictions(agentName)
  return Object.keys(restrictions).length > 0
}
