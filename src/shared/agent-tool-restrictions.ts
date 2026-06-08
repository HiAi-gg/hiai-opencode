import { getAgentConfigKey, stripInvisibleAgentCharacters } from "./agent-display-names"
import {
  canAgentDelegateTo,
  formatAgentDelegateTargets,
  type DelegatableAgentKey,
} from "./permission-compat"

/**
 * Agent tool restrictions for session.prompt calls.
 * OpenCode SDK's session.prompt `tools` parameter expects boolean values.
 * true = tool allowed, false = tool denied.
 */

const RESEARCHER_DENYLIST: Record<string, boolean> = {
  write: false,
  edit: false,
  task: false,
  call_hiai_agent: false,
}

const CANONICAL_AGENT_RESTRICTIONS: Record<string, Record<string, boolean>> = {
  researcher: RESEARCHER_DENYLIST,
  critic: {
    write: false,
    edit: false,
  },
  strategist: {
    write: false,
    edit: false,
    pty_spawn: false,
    interactive_bash: false,
    bash: false,
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
  vision: "multimodal",
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

/**
 * Result of a delegation permission check.
 *
 * `allowed` is the verdict; `reason` carries a human-readable explanation
 * suitable for surfacing to the model that initiated the `task()` call.
 */
export interface DelegationCheckResult {
  allowed: boolean
  reason?: string
}

/**
 * Validates that `callerAgent` is allowed to delegate to `targetAgent` via
 * the `task()` tool. This is the single source of truth for the
 * "can agent X spawn agent Y" check used by the delegation engine.
 *
 * Returns `{ allowed: true }` for unknown callers (backward compatibility —
 * custom / project-registered agents retain unrestricted delegation, matching
 * Claude Code's trust model).
 *
 * Returns `{ allowed: false, reason }` when the caller has an explicit
 * `delegate_to: []` entry (cannot delegate to anyone) or when the target
 * is not in the caller's allowlist. The reason string follows the format
 * required by the delegation spec:
 *
 *   "Agent {caller} cannot delegate to {target}. Allowed targets: {list}"
 */
export function checkCallerCanDelegateTo(
  callerAgent: string,
  targetAgent: string
): DelegationCheckResult {
  const caller = callerAgent.trim()
  const target = targetAgent.trim()

  if (!caller) {
    return { allowed: true }
  }

  if (!target) {
    return {
      allowed: false,
      reason: "Cannot delegate to an empty target agent name.",
    }
  }

  if (canAgentDelegateTo(caller, target)) {
    return { allowed: true }
  }

  return {
    allowed: false,
    reason: `Agent ${caller} cannot delegate to ${target}. Allowed targets: ${formatAgentDelegateTargets(caller)}`,
  }
}

/**
 * Convenience: returns true when the caller can delegate to the target.
 * Use `checkCallerCanDelegateTo` when you need the reason string.
 */
export function callerCanDelegateTo(
  callerAgent: string,
  targetAgent: string
): boolean {
  return checkCallerCanDelegateTo(callerAgent, targetAgent).allowed
}

/**
 * Re-export the delegation types so callers can import them from a single
 * location without reaching into `permission-compat` directly.
 */
export type { DelegatableAgentKey }
