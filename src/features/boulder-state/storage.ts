/**
 * Boulder State Storage
 *
 * Handles reading/writing boulder.json for active plan tracking.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, renameSync, unlinkSync, copyFileSync } from "node:fs"
import { join, basename } from "node:path"
import { execFileSync, execSync } from "node:child_process"
import type { BoulderState, PlanProgress, TaskSessionState } from "./types"
import { BOULDER_DIR, BOULDER_FILE, STRATEGIST_PLANS_DIR, BOULDER_REGISTRY_DIR, LEGACY_BOULDER_FILE, NOTEPAD_DIR } from "./constants"

const RESERVED_KEYS = new Set(["__proto__", "prototype", "constructor"])

export function validatePlanName(planName: string): void {
  if (!planName || planName.includes("..") || planName.includes("/") || planName.includes("\\")) {
    throw new Error(`Invalid plan name: ${planName}`)
  }
}

export function getBoulderFilePath(directory: string): string {
  return join(directory, BOULDER_DIR, BOULDER_FILE)
}

/**
 * Read boulder state — v2 compatible
 *
 * v2 behavior:
 * 1. Check if registry exists and has entries
 * 2. If exactly ONE plan exists, return that plan's state (single-plan mode)
 * 3. If ZERO plans exist, check for legacy boulder.json (migration needed)
 * 4. If MULTIPLE plans exist, return null (caller must use registry functions)
 *
 * @param directory - Root directory (where .bob/ lives)
 * @returns BoulderState | null
 *
 * @deprecated For multi-plan scenarios, use readBoulderForPlan() directly
 */
export function readBoulderState(directory: string): BoulderState | null {
  const registryDir = getRegistryDir(directory)

  // Check registry first (v2 behavior)
  if (existsSync(registryDir)) {
    const plans = getActivePlans(directory)

    if (plans.length === 1) {
      // Single plan mode — return that plan's state
      return readBoulderForPlan(directory, plans[0])
    }

    if (plans.length > 1) {
      // Multi-plan mode — caller must use registry functions
      return null
    }

    // Registry exists but empty — fall through to legacy check
  }

  // Check for legacy boulder.json (v1 format — triggers migration on next write)
  const legacyPath = join(directory, BOULDER_DIR, LEGACY_BOULDER_FILE)
  if (existsSync(legacyPath)) {
    try {
      const content = readFileSync(legacyPath, "utf-8")
      const parsed = JSON.parse(content)
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return null
      }
      // Normalize legacy state
      if (!Array.isArray(parsed.session_ids)) {
        parsed.session_ids = []
      }
      if (!parsed.session_origins || typeof parsed.session_origins !== "object" || Array.isArray(parsed.session_origins)) {
        parsed.session_origins = {}
      }
      if (parsed.session_ids.length === 1) {
        const soleSessionId = parsed.session_ids[0]
        if (
          typeof soleSessionId === "string"
          && parsed.session_origins[soleSessionId] !== "appended"
          && parsed.session_origins[soleSessionId] !== "direct"
        ) {
          parsed.session_origins[soleSessionId] = "direct"
        }
      }
      if (!parsed.task_sessions || typeof parsed.task_sessions !== "object" || Array.isArray(parsed.task_sessions)) {
        parsed.task_sessions = {}
      }
      return parsed as BoulderState
    } catch {
      return null
    }
  }

  return null
}

/**
 * Write boulder state — v2 compatible
 *
 * v2 behavior:
 * 1. Ensure registry exists (triggers migration if legacy boulder.json found)
 * 2. Write to registry using state.plan_name
 * 3. If legacy boulder.json exists, migrate it
 *
 * @param directory - Root directory (where .bob/ lives)
 * @param state - BoulderState to write
 * @returns true on success, false on failure
 *
 * @deprecated For multi-plan scenarios, use writeBoulderForPlan() directly
 */
export function writeBoulderState(directory: string, state: BoulderState): boolean {
  // Ensure registry exists (triggers migration if legacy boulder.json found)
  ensureRegistryExists(directory)

  // Write to registry using plan_name
  if (!state.plan_name) {
    return false // Can't write without plan name
  }

  return writeBoulderForPlan(directory, state.plan_name, state)
}

export function appendSessionId(
  directory: string,
  sessionId: string,
  origin: "direct" | "appended" = "direct",
): BoulderState | null {
  const state = readBoulderState(directory)
  if (!state) return null

  if (!state.session_origins || typeof state.session_origins !== "object" || Array.isArray(state.session_origins)) {
    state.session_origins = {}
  }

  if (!state.session_ids?.includes(sessionId)) {
    if (!Array.isArray(state.session_ids)) {
      state.session_ids = []
    }
    const originalSessionIds = [...state.session_ids]
    const originalSessionOrigins = { ...state.session_origins }
    state.session_ids.push(sessionId)
    state.session_origins[sessionId] = origin
    if (writeBoulderState(directory, state)) {
      return state
    }
    state.session_ids = originalSessionIds
    state.session_origins = originalSessionOrigins
    return null
  }

  if (!state.session_origins[sessionId]) {
    state.session_origins[sessionId] = origin
    if (!writeBoulderState(directory, state)) {
      return null
    }
  }

  return state
}

export function clearBoulderState(directory: string): boolean {
  const filePath = getBoulderFilePath(directory)

  try {
    if (existsSync(filePath)) {
      const { unlinkSync } = require("node:fs")
      unlinkSync(filePath)
    }
    return true
  } catch {
    return false
  }
}

export function getTaskSessionState(directory: string, taskKey: string): TaskSessionState | null {
  const state = readBoulderState(directory)
  if (!state?.task_sessions) {
    return null
  }

  return state.task_sessions[taskKey] ?? null
}

export function upsertTaskSessionState(
  directory: string,
  input: {
    taskKey: string
    taskLabel: string
    taskTitle: string
    sessionId: string
    agent?: string
    category?: string
  },
): BoulderState | null {
  const state = readBoulderState(directory)
  if (!state) {
    return null
  }

  if (RESERVED_KEYS.has(input.taskKey)) {
    return null
  }

  const taskSessions = state.task_sessions ?? {}
  taskSessions[input.taskKey] = {
    task_key: input.taskKey,
    task_label: input.taskLabel,
    task_title: input.taskTitle,
    session_id: input.sessionId,
    ...(input.agent !== undefined ? { agent: input.agent } : {}),
    ...(input.category !== undefined ? { category: input.category } : {}),
    updated_at: new Date().toISOString(),
  }

  state.task_sessions = taskSessions
  if (writeBoulderState(directory, state)) {
    return state
  }

  return null
}

/**
 * Find Strategist plan files for this project.
 * Strategist stores plans at: {project}/.bob/plans/{name}.md
 */
export function findStrategistPlans(directory: string): string[] {
  const plansDir = join(directory, STRATEGIST_PLANS_DIR)

  if (!existsSync(plansDir)) {
    return []
  }

  try {
    const files = readdirSync(plansDir)
    return files
      .filter((f) => f.endsWith(".md"))
      .map((f) => join(plansDir, f))
      .sort((a, b) => {
        // Sort by modification time, newest first
        const aStat = require("node:fs").statSync(a)
        const bStat = require("node:fs").statSync(b)
        return bStat.mtimeMs - aStat.mtimeMs
      })
  } catch {
    return []
  }
}

const TODO_HEADING_PATTERN = /^##\s+TODOs\b/i
const FINAL_VERIFICATION_HEADING_PATTERN = /^##\s+Final Verification Wave\b/i
const SECOND_LEVEL_HEADING_PATTERN = /^##\s+/
const UNCHECKED_CHECKBOX_PATTERN = /^(\s*)[-*]\s*\[\s*\]\s*(.+)$/
const CHECKED_CHECKBOX_PATTERN = /^(\s*)[-*]\s*\[[xX]\]\s*(.+)$/
const TODO_TASK_PATTERN = /^\d+\.\s+/
const FINAL_WAVE_TASK_PATTERN = /^F\d+\.\s+/i

type ProgressSection = "todo" | "final-wave" | "other"

/**
 * Parse a plan file and count checkbox progress.
 *
 * Only top-level (zero-indent) checkboxes under `## TODOs` and
 * `## Final Verification Wave` sections are counted. The checkbox
 * body must carry a valid task label (`N.` for TODOs, `FN.` for
 * Final Verification Wave). Nested acceptance-criteria checkboxes
 * and checkboxes in other sections are intentionally ignored so
 * that progress tracking stays aligned with `readCurrentTopLevelTask`.
 */
export function getPlanProgress(planPath: string): PlanProgress {
  if (!existsSync(planPath)) {
    return { total: 0, completed: 0, isComplete: true }
  }

  try {
    const content = readFileSync(planPath, "utf-8")
    const lines = content.split(/\r?\n/)

    // Check if the plan has structured sections (## TODOs / ## Final Verification Wave)
    const hasStructuredSections = lines.some(
      (line) => TODO_HEADING_PATTERN.test(line) || FINAL_VERIFICATION_HEADING_PATTERN.test(line),
    )

    if (hasStructuredSections) {
      // Structured plan: only count top-level checkboxes with numbered labels
      // under ## TODOs and ## Final Verification Wave sections
      return getStructuredPlanProgress(lines)
    }

    // Simple plan: count all top-level checkboxes anywhere
    return getSimplePlanProgress(content)
  } catch {
    return { total: 0, completed: 0, isComplete: true }
  }
}

function getStructuredPlanProgress(lines: string[]): PlanProgress {
  let section: ProgressSection = "other"
  let total = 0
  let completed = 0

  for (const line of lines) {
    if (SECOND_LEVEL_HEADING_PATTERN.test(line)) {
      section = TODO_HEADING_PATTERN.test(line)
        ? "todo"
        : FINAL_VERIFICATION_HEADING_PATTERN.test(line)
          ? "final-wave"
          : "other"
      continue
    }

    if (section !== "todo" && section !== "final-wave") {
      continue
    }

    const checkedMatch = line.match(CHECKED_CHECKBOX_PATTERN)
    const uncheckedMatch = checkedMatch ? null : line.match(UNCHECKED_CHECKBOX_PATTERN)
    const match = checkedMatch ?? uncheckedMatch
    if (!match) {
      continue
    }

    if (match[1].length > 0) {
      continue
    }

    const taskBody = match[2].trim()
    const labelPattern = section === "todo" ? TODO_TASK_PATTERN : FINAL_WAVE_TASK_PATTERN
    if (!labelPattern.test(taskBody)) {
      continue
    }

    total++
    if (checkedMatch) {
      completed++
    }
  }

  return {
    total,
    completed,
    isComplete: total > 0 && completed === total,
  }
}

function getSimplePlanProgress(content: string): PlanProgress {
  const uncheckedMatches = content.match(/^[-*]\s*\[\s*\]/gm) || []
  const checkedMatches = content.match(/^[-*]\s*\[[xX]\]/gm) || []

  const total = uncheckedMatches.length + checkedMatches.length
  const completed = checkedMatches.length

  return {
    total,
    completed,
    isComplete: total > 0 && completed === total,
  }
}

/**
 * Extract plan name from file path.
 */
export function getPlanName(planPath: string): string {
  return basename(planPath, ".md")
}

/**
 * Create a new boulder state for a plan.
 */
export function createBoulderState(
  planPath: string,
  sessionId: string,
  agent?: string,
  worktreePath?: string,
): BoulderState {
  return {
    active_plan: planPath,
    started_at: new Date().toISOString(),
    session_ids: [sessionId],
    session_origins: {
      [sessionId]: "direct",
    },
    plan_name: getPlanName(planPath),
    ...(agent !== undefined ? { agent } : {}),
    ...(worktreePath !== undefined ? { worktree_path: worktreePath } : {}),
  }
}

// =============================================================================
// Registry Storage Operations (Phase 2)
// =============================================================================

/**
 * Get the boulder registry directory path
 * @returns `{directory}/.bob/boulder-registry`
 */
export function getRegistryDir(directory: string): string {
  return join(directory, BOULDER_REGISTRY_DIR)
}

/**
 * Read boulder state for a specific plan from registry
 * @returns BoulderState | null if not found or invalid
 */
export function readBoulderForPlan(directory: string, planName: string): BoulderState | null {
  validatePlanName(planName)
  const registryDir = getRegistryDir(directory)
  const planPath = join(registryDir, `${planName}.json`)

  if (!existsSync(planPath)) {
    return null
  }

  try {
    const content = readFileSync(planPath, "utf-8")
    return JSON.parse(content) as BoulderState
  } catch {
    return null
  }
}

/**
 * Write boulder state for a specific plan atomically
 * Pattern: write to .tmp file, then rename (atomic on POSIX)
 * @returns true on success, false on failure
 */
export function writeBoulderForPlan(
  directory: string,
  planName: string,
  state: BoulderState,
): boolean {
  validatePlanName(planName)
  const registryDir = getRegistryDir(directory)
  const planPath = join(registryDir, `${planName}.json`)
  const tmpPath = `${planPath}.tmp`

  try {
    // Ensure registry dir exists
    if (!existsSync(registryDir)) {
      mkdirSync(registryDir, { recursive: true })
    }

    // Atomic write: write to .tmp, then rename
    writeFileSync(tmpPath, JSON.stringify(state, null, 2), "utf-8")
    renameSync(tmpPath, planPath)
    return true
  } catch {
    // Clean up tmp file if it exists
    if (existsSync(tmpPath)) {
      try {
        unlinkSync(tmpPath)
      } catch {
        // Ignore cleanup errors
      }
    }
    return false
  }
}

/**
 * Delete boulder state for a specific plan from registry
 * @returns true on success, false if file doesn't exist or error
 */
export function deleteBoulderForPlan(directory: string, planName: string): boolean {
  validatePlanName(planName)
  const registryDir = getRegistryDir(directory)
  const planPath = join(registryDir, `${planName}.json`)

  if (!existsSync(planPath)) {
    return false
  }

  try {
    unlinkSync(planPath)
    return true
  } catch {
    return false
  }
}

/**
 * Get list of all active plan names from registry
 * @returns Array of plan names (without .json extension)
 */
export function getActivePlans(directory: string): string[] {
  const registryDir = getRegistryDir(directory)

  if (!existsSync(registryDir)) {
    return []
  }

  try {
    const files = readdirSync(registryDir)
    return files.filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", ""))
  } catch {
    return []
  }
}

/**
 * Get count of active plans
 */
export function getActivePlanCount(directory: string): number {
  return getActivePlans(directory).length
}

/**
 * Find which plan a session ID belongs to
 * Searches all registry files for the session ID
 * @returns Plan name or null if not found
 */
export function findPlanNameForSession(directory: string, sessionId: string): string | null {
  const plans = getActivePlans(directory)

  for (const planName of plans) {
    const state = readBoulderForPlan(directory, planName)
    if (state?.session_ids?.includes(sessionId)) {
      return planName
    }
  }

  return null
}

/**
 * Check if there's a conflicting active plan (not the excluded one)
 * @returns true if another plan exists
 */
export function hasConflictingPlan(directory: string, excludePlanName: string): boolean {
  const plans = getActivePlans(directory)

  if (plans.length === 0) {
    return false
  }

  if (plans.length > 1) {
    return true
  }

  // Only one plan — check if it's the excluded one
  return plans[0] !== excludePlanName
}

/**
 * Migrate v1 boulder.json to v2 registry format
 * Reads old boulder.json, copies to boulder-registry/{plan_name}.json, renames to .bak
 * @returns true on success or if already migrated, false on failure
 */
export function migrateV1ToV2(directory: string): boolean {
  const legacyPath = join(directory, BOULDER_DIR, LEGACY_BOULDER_FILE)
  const registryDir = getRegistryDir(directory)

  // Check if legacy file exists
  if (!existsSync(legacyPath)) {
    // Already migrated or never existed
    return true
  }

  try {
    // Read legacy v1 format
    const content = readFileSync(legacyPath, "utf-8")
    const legacyState = JSON.parse(content) as BoulderState

    // Ensure registry dir exists
    if (!existsSync(registryDir)) {
      mkdirSync(registryDir, { recursive: true })
    }

    // Write to registry with plan name
    if (legacyState.plan_name) {
      const newPath = join(registryDir, `${legacyState.plan_name}.json`)
      writeFileSync(newPath, JSON.stringify(legacyState, null, 2), "utf-8")
    }

    // Rename legacy to .bak
    const backupPath = `${legacyPath}.v1.bak`
    renameSync(legacyPath, backupPath)

    return true
  } catch {
    return false
  }
}

/**
 * Ensure registry directory exists, trigger migration if v1 found
 */
export function ensureRegistryExists(directory: string): void {
  const registryDir = getRegistryDir(directory)

  // Create registry dir if needed
  if (!existsSync(registryDir)) {
    mkdirSync(registryDir, { recursive: true })
  }

  // Trigger migration if v1 exists
  migrateV1ToV2(directory)
}

// =============================================================================
// Plan Completion & Cleanup (Phase 6)
// =============================================================================

/**
 * Complete a plan: sync notepads from worktree, remove worktree, delete boulder from registry
 * @param directory - Root directory (where registry lives)
 * @param planName - Plan name to complete
 * @param worktreePath - Optional worktree path to clean up. When provided, the
 *   per-worktree registry entry is also deleted, then the worktree-local and root
 *   registries are kept in sync via the notepad sync step that precedes removal.
 * @returns true on success
 */
export function completePlan(directory: string, planName: string, worktreePath?: string): boolean {
  try {
    // Step 1: Sync notepads from worktree to root if worktree exists
    if (worktreePath) {
      syncBoulderNotepadsFromWorktree(directory, worktreePath)
    }

    // Step 2: Remove worktree if it exists
    if (worktreePath) {
      // Use git worktree remove --force
      execFileSync("git", ["worktree", "remove", "--force", worktreePath], { cwd: directory })
    }

    // Step 3: Delete boulder from root registry
    deleteBoulderForPlan(directory, planName)

    // Step 4: Delete boulder from the worktree's own registry (if it had one)
    if (worktreePath) {
      deleteBoulderForPlanInWorktree(worktreePath, planName)
    }

    return true
  } catch {
    return false
  }
}

// =============================================================================
// Per-Worktree Registry Operations
// =============================================================================

// The relative path of the registry inside a worktree's .bob/ directory.
// BOULDER_REGISTRY_DIR is "<.bob>/boulder-registry"; this strips the <.bob>/ prefix
// so we can join it onto "<worktreePath>/.bob/" without producing a doubled .bob.
const WORKTREE_REGISTRY_REL_DIR = BOULDER_REGISTRY_DIR.replace(`${BOULDER_DIR}/`, "")

function getWorktreeRegistryDir(worktreePath: string): string {
  return join(worktreePath, BOULDER_DIR, WORKTREE_REGISTRY_REL_DIR)
}

/**
 * Copy a single plan's boulder-registry entry from the root registry into a
 * worktree's own .bob/boulder-registry/. This gives the worktree an isolated
 * state file so the agent running inside the worktree can read/write it
 * without touching the root registry (which is shared with other parallel plans).
 *
 * If the worktree has no .bob/ directory yet, it is created. If the plan does
 * not exist in the root registry, this is a no-op (caller should ensure the
 * root entry exists first via writeBoulderForPlan).
 *
 * @param rootDirectory - Main repo root (where root .bob/boulder-registry lives)
 * @param worktreePath - Worktree path (where worktree .bob/ should live)
 * @param planName - Plan name to copy
 * @returns true on success, false on failure or when the root entry is missing
 */
export function copyBoulderEntryToWorktree(
  rootDirectory: string,
  worktreePath: string,
  planName: string,
): boolean {
  validatePlanName(planName)

  const sourceState = readBoulderForPlan(rootDirectory, planName)
  if (!sourceState) {
    return false
  }

  const worktreeRegistryDir = getWorktreeRegistryDir(worktreePath)
  if (!existsSync(worktreeRegistryDir)) {
    mkdirSync(worktreeRegistryDir, { recursive: true })
  }

  const targetPath = join(worktreeRegistryDir, `${planName}.json`)
  const tmpPath = `${targetPath}.tmp`

  try {
    writeFileSync(tmpPath, JSON.stringify(sourceState, null, 2), "utf-8")
    renameSync(tmpPath, targetPath)
    return true
  } catch {
    if (existsSync(tmpPath)) {
      try {
        unlinkSync(tmpPath)
      } catch {
        // Ignore cleanup errors
      }
    }
    return false
  }
}

/**
 * Delete the boulder-registry entry for a plan that lives inside a worktree's
 * own .bob/boulder-registry/. Use this for worktree-local cleanup, not for
 * removing the root entry (use deleteBoulderForPlan for that).
 *
 * @returns true if the entry was removed or did not exist, false on error
 */
export function deleteBoulderForPlanInWorktree(worktreePath: string, planName: string): boolean {
  validatePlanName(planName)
  const worktreeRegistryDir = getWorktreeRegistryDir(worktreePath)
  const planPath = join(worktreeRegistryDir, `${planName}.json`)

  if (!existsSync(planPath)) {
    return true
  }

  try {
    unlinkSync(planPath)
    return true
  } catch {
    return false
  }
}

/**
 * Read a boulder-registry entry that lives inside a worktree's own registry.
 * Falls back to the root registry if no worktree-local copy exists, so callers
 * can use this uniformly regardless of where state was written.
 *
 * @returns BoulderState | null if neither registry has the entry
 */
export function readBoulderForPlanInWorktree(
  rootDirectory: string,
  worktreePath: string,
  planName: string,
): BoulderState | null {
  validatePlanName(planName)

  // Prefer the worktree-local copy (it's the source of truth for this session).
  const worktreeRegistryDir = getWorktreeRegistryDir(worktreePath)
  const worktreeEntryPath = join(worktreeRegistryDir, `${planName}.json`)
  if (existsSync(worktreeEntryPath)) {
    try {
      const content = readFileSync(worktreeEntryPath, "utf-8")
      return JSON.parse(content) as BoulderState
    } catch {
      // ignore
    }
  }

  return readBoulderForPlan(rootDirectory, planName)
}

/**
 * Check whether a worktree has any live boulder-registry sessions.
 * "Live" means the registry contains at least one entry with a non-empty
 * session_ids array. Used by cleanupStaleWorktrees to avoid removing
 * worktrees that have a running agent session attached to them.
 *
 * @param worktreePath - Worktree directory to inspect
 * @returns true if the worktree owns at least one live plan
 */
export function worktreeHasLiveSession(worktreePath: string): boolean {
  const worktreeRegistryDir = getWorktreeRegistryDir(worktreePath)
  if (!existsSync(worktreeRegistryDir)) {
    return false
  }

  try {
    const files = readdirSync(worktreeRegistryDir)
    for (const file of files) {
      if (!file.endsWith(".json")) continue
      try {
        const content = readFileSync(join(worktreeRegistryDir, file), "utf-8")
        const state = JSON.parse(content) as BoulderState
        if (Array.isArray(state.session_ids) && state.session_ids.length > 0) {
          return true
        }
      } catch {
        // Skip unreadable / corrupted entries
      }
    }
  } catch {
    // Ignore read errors — treat as no live sessions
  }

  return false
}

/**
 * Sync .bob/ directory from worktree back to root
 * Copies notepads and other boulder state files
 * @param rootDirectory - Main repo root
 * @param worktreePath - Worktree path to sync from
 */
export function syncBoulderNotepadsFromWorktree(rootDirectory: string, worktreePath: string): void {
  const worktreeBob = join(worktreePath, BOULDER_DIR)
  const rootBob = join(rootDirectory, BOULDER_DIR)

  if (!existsSync(worktreeBob)) {
    return
  }

  // Ensure root .bob exists
  if (!existsSync(rootBob)) {
    mkdirSync(rootBob, { recursive: true })
  }

  // Sync notepads directory (merge, don't overwrite)
  const worktreeNotepads = join(worktreeBob, NOTEPAD_DIR)
  const rootNotepads = join(rootBob, NOTEPAD_DIR)

  if (existsSync(worktreeNotepads)) {
    if (!existsSync(rootNotepads)) {
      mkdirSync(rootNotepads, { recursive: true })
    }

    // Copy each notepad file (skip if already exists in root)
    const files = readdirSync(worktreeNotepads)
    for (const file of files) {
      const srcPath = join(worktreeNotepads, file)
      const dstPath = join(rootNotepads, file)
      if (!existsSync(dstPath)) {
        copyFileSync(srcPath, dstPath)
      }
    }
  }

  // Sync plans directory (merge)
  const worktreePlans = join(worktreeBob, "plans")
  const rootPlans = join(rootBob, "plans")

  if (existsSync(worktreePlans)) {
    if (!existsSync(rootPlans)) {
      mkdirSync(rootPlans, { recursive: true })
    }

    const files = readdirSync(worktreePlans)
    for (const file of files) {
      const srcPath = join(worktreePlans, file)
      const dstPath = join(rootPlans, file)
      if (!existsSync(dstPath)) {
        copyFileSync(srcPath, dstPath)
      }
    }
  }
}
