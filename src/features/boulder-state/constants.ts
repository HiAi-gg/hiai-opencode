/**
 * Boulder State Constants
 */

export const BOULDER_DIR = ".bob"
export const BOULDER_FILE = "boulder.json"
export const BOULDER_STATE_PATH = `${BOULDER_DIR}/${BOULDER_FILE}`

export const NOTEPAD_DIR = "notepads"
export const NOTEPAD_BASE_PATH = `${BOULDER_DIR}/${NOTEPAD_DIR}`

/** Strategist plan directory pattern */
export const STRATEGIST_PLANS_DIR = ".bob/plans"

// Directory for boulder registry (one file per active plan)
export const BOULDER_REGISTRY_DIR = ".bob/boulder-registry"

// Base directory for auto-created worktrees
export const WORKTREE_BASE_DIR = ".opencode/worktrees"

// Lock directory under WORKTREE_BASE_DIR used to serialize createWorktreeForPlan.
// Created with mkdirSync({ recursive: false }) so the OS returns EEXIST atomically.
export const WORKTREE_LOCK_DIR = `${WORKTREE_BASE_DIR}/.locks`

// A worktree lock older than this is considered stale and may be stolen.
export const WORKTREE_LOCK_TTL_MS = 5 * 60 * 1000

// Default wait budget for acquireWorktreeLock retries.
export const WORKTREE_LOCK_WAIT_MS = 5000
export const WORKTREE_LOCK_POLL_MS = 50

// Legacy boulder file path (for v1→v2 migration)
export const LEGACY_BOULDER_FILE = "boulder.json"
