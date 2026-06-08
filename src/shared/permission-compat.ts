/**
 * Permission system utilities for OpenCode 1.1.1+.
 * This module only supports the new permission format.
 *
 * DELEGATION PERMISSION MODEL
 * ===========================
 *
 * Agents can delegate work to other agents via the `task()` tool. To prevent
 * agents from spawning arbitrary sub-agents, every agent declares a
 * `delegate_to` allowlist. When `task()` is invoked, the runtime checks
 * that the requested `subagent_type` is in the caller's `delegate_to` list.
 *
 * Resolution semantics (see `canAgentDelegateTo`):
 *   - If the caller has no entry in `AGENT_DELEGATION_MATRIX`, the call is
 *     ALLOWED. This preserves backward compatibility for custom / unknown
 *     agents (matches Claude Code's trust model for project-registered agents).
 *   - If the caller has an explicit `delegate_to: []` entry, the call is
 *     BLOCKED — the agent cannot delegate to anyone.
 *   - If the caller has a non-empty list, only those targets are allowed.
 *     Any target not in the list is blocked with an explanatory error.
 *
 * The `task` tool itself is still controlled by `permission.task`. If an
 * agent denies the `task` tool entirely, the delegation check never runs.
 * This matrix is consulted only when the `task` tool is otherwise allowed.
 *
 * NOTE: `delegate_to` controls `task()` only. The separate
 * `call_hiai_agent` invocation tool has its own per-agent allow/deny
 * permission and is not affected by this matrix.
 */

export type PermissionValue = "ask" | "allow" | "deny"

export interface PermissionFormat {
  permission: Record<string, PermissionValue>
}

/**
 * Canonical agent names that can appear in `delegate_to` lists.
 * All entries must be lower-case config keys (e.g., "coder", "researcher").
 */
export type DelegatableAgentKey =
  | "bob"
  | "manager"
  | "coder"
  | "strategist"
  | "critic"
  | "designer"
  | "researcher"
  | "writer"
  | "vision"
  | "sub"

/**
 * The delegation allowlist, keyed by the calling agent's canonical config key.
 *
 * - Value omitted (caller not in this map) → allow all targets (backward compat).
 * - Value is `[]` → block all targets (no delegation allowed).
 * - Value is non-empty → only listed targets are allowed.
 *
 * The order in each list is documentation only; lookups are case-insensitive
 * via `canAgentDelegateTo`.
 */
export const AGENT_DELEGATION_MATRIX: Partial<
  Record<DelegatableAgentKey, readonly DelegatableAgentKey[]>
> = {
  bob: [
    "coder",
    "manager",
    "strategist",
    "critic",
    "designer",
    "researcher",
    "writer",
    "vision",
    "sub",
  ],
  manager: [
    "coder",
    "strategist",
    "critic",
    "designer",
    "researcher",
    "writer",
    "vision",
    "sub",
  ],
  coder: ["designer", "researcher", "vision", "sub", "writer"],
  designer: ["coder", "researcher", "vision", "sub", "writer"],
  critic: ["researcher", "vision", "manager"],
  strategist: ["researcher", "manager", "critic", "writer"],
  writer: ["researcher"],
  researcher: ["vision"],
  vision: [],
  sub: [],
}

/**
 * Returns the delegate_to list for an agent.
 *
 * - Returns `undefined` when the agent is not in the matrix (caller is
 *   custom / unknown). This means "no restriction enforced" and is the
 *   backward-compatibility escape hatch.
 * - Returns `[]` for agents that explicitly cannot delegate.
 * - Returns the agent's allowlist otherwise.
 */
export function getAgentDelegateTargets(
  agentName: string
): readonly DelegatableAgentKey[] | undefined {
  const key = agentName.trim().toLowerCase()
  if (!key) return undefined
  return AGENT_DELEGATION_MATRIX[key as DelegatableAgentKey]
}

/**
 * Checks whether `callerAgent` is allowed to delegate to `targetAgent` via
 * the `task()` tool.
 *
 * - `callerAgent` not in the matrix → true (backward compat: no restriction).
 * - `targetAgent` is the same as `callerAgent` → false (self-delegation is
 *   blocked separately, but we are conservative here too).
 * - `targetAgent` not in caller's allowlist → false.
 *
 * This function is case-insensitive on both arguments and ignores the
 * `bob`, `manager`, etc. canonicalization performed elsewhere — it works on
 * whatever names the caller and resolver hand it.
 */
export function canAgentDelegateTo(
  callerAgent: string,
  targetAgent: string
): boolean {
  const allowed = getAgentDelegateTargets(callerAgent)
  if (allowed === undefined) {
    return true
  }
  if (allowed.length === 0) {
    return false
  }
  const targetKey = targetAgent.trim().toLowerCase()
  return allowed.some((candidate) => candidate === targetKey)
}

/**
 * Builds a human-readable description of the caller's delegation policy,
 * suitable for error messages. Returns "all agents" when the caller is not
 * in the matrix (backward compat) and the literal "no agents" when the
 * allowlist is empty.
 */
export function formatAgentDelegateTargets(
  callerAgent: string
): string {
  const allowed = getAgentDelegateTargets(callerAgent)
  if (allowed === undefined) return "all agents"
  if (allowed.length === 0) return "no agents"
  return allowed.join(", ")
}

/**
 * Creates tool restrictions that deny specified tools.
 */
export function createAgentToolRestrictions(
  denyTools: string[]
): PermissionFormat {
  return {
    permission: Object.fromEntries(
      denyTools.map((tool) => [tool, "deny" as const])
    ),
  }
}

/**
 * Creates tool restrictions that ONLY allow specified tools.
 * All other tools are denied by default using `*: deny` pattern.
 */
export function createAgentToolAllowlist(
  allowTools: string[]
): PermissionFormat {
  return {
    permission: {
      "*": "deny" as const,
      ...Object.fromEntries(
        allowTools.map((tool) => [tool, "allow" as const])
      ),
    },
  }
}

/**
 * Converts legacy tools format to permission format.
 * For migrating user configs from older versions.
 */
export function migrateToolsToPermission(
  tools: Record<string, boolean>
): Record<string, PermissionValue> {
  return Object.fromEntries(
    Object.entries(tools).map(([key, value]) => [
      key,
      value ? ("allow" as const) : ("deny" as const),
    ])
  )
}

/**
 * Migrates agent config from legacy tools format to permission format.
 * If config has `tools`, converts to `permission`.
 */
export function migrateAgentConfig(
  config: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...config }

  if (result.tools && typeof result.tools === "object") {
    const existingPermission =
      (result.permission as Record<string, PermissionValue>) || {}
    const migratedPermission = migrateToolsToPermission(
      result.tools as Record<string, boolean>
    )
    result.permission = { ...migratedPermission, ...existingPermission }
    delete result.tools
  }

  if (result.permission && typeof result.permission === "object") {
    const perm = { ...(result.permission as Record<string, PermissionValue>) }
    if ("delegate_task" in perm && !("task" in perm)) {
      perm["task"] = perm["delegate_task"]
      delete perm["delegate_task"]
      result.permission = perm
    }
  }

  return result
}
