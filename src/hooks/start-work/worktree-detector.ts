import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readdirSync, statSync, symlinkSync, unlinkSync } from "node:fs"
import { join } from "node:path"
import { WORKTREE_BASE_DIR, BOULDER_DIR } from "../../features/boulder-state/constants"

export type WorktreeEntry = {
  path: string
  branch: string | undefined
  bare: boolean
}

export function parseWorktreeListPorcelain(output: string): WorktreeEntry[] {
  const lines = output.split("\n").map((line) => line.trim())
  const entries: WorktreeEntry[] = []
  let current: Partial<WorktreeEntry> | undefined

  for (const line of lines) {
    if (!line) {
      if (current?.path) {
        entries.push({
          path: current.path,
          branch: current.branch,
          bare: current.bare ?? false,
        })
      }
      current = undefined
      continue
    }

    if (line.startsWith("worktree ")) {
      current = { path: line.slice("worktree ".length).trim() }
      continue
    }

    if (!current) continue

    if (line.startsWith("branch ")) {
      current.branch = line.slice("branch ".length).trim().replace(/^refs\/heads\//, "")
    } else if (line === "bare") {
      current.bare = true
    }
  }

  if (current?.path) {
    entries.push({
      path: current.path,
      branch: current.branch,
      bare: current.bare ?? false,
    })
  }

  return entries
}

export function listWorktrees(directory: string): WorktreeEntry[] {
  try {
    const output = execFileSync("git", ["worktree", "list", "--porcelain"], {
      cwd: directory,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    })
    return parseWorktreeListPorcelain(output)
  } catch {
    return []
  }
}

export function detectWorktreePath(directory: string): string | null {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: directory,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim()
  } catch {
    return null
  }
}

/**
 * Create a git worktree for plan isolation
 * @param directory - Project root directory
 * @param planName - Plan name to use for worktree path and branch
 * @returns Worktree path on success, null on failure
 */
export function createWorktreeForPlan(directory: string, planName: string): string | null {
  const worktreePath = join(directory, WORKTREE_BASE_DIR, planName)
  const branchName = `boulder/${planName}`

  // Check if already exists
  if (existsSync(worktreePath)) {
    const health = validateWorktreeHealth(worktreePath)
    if (health.valid) {
      return worktreePath // Already exists and healthy
    }
    // Stale worktree - remove it first
    removeWorktree(worktreePath)
  }

  try {
    // Check if git repo
    execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: directory,
      stdio: ["pipe", "pipe", "pipe"],
    })

    // Create worktree with new branch
    execFileSync("git", ["worktree", "add", "-b", branchName, worktreePath], {
      cwd: directory,
      stdio: ["pipe", "pipe", "pipe"],
    })

    // Ensure .bob/ directory exists in worktree
    ensureBoulderDirInWorktree(worktreePath)

    // Create symlink to root plans directory so findStrategistPlans works in worktree
    ensurePlansSymlinkInWorktree(worktreePath, directory)

    return worktreePath
  } catch {
    // Git command failed (not a git repo, worktree exists, etc.)
    return null
  }
}

/**
 * Validate if a worktree is healthy and usable
 * @param worktreePath - Path to the worktree
 * @returns { valid: boolean, reason?: string }
 */
export function validateWorktreeHealth(worktreePath: string): { valid: boolean; reason?: string } {
  // Check directory exists
  if (!existsSync(worktreePath)) {
    return { valid: false, reason: "Worktree directory does not exist" }
  }

  try {
    // Check if it's a valid git worktree
    execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: worktreePath,
      stdio: ["pipe", "pipe", "pipe"],
    })

    // Check git worktree list confirms it
    const worktrees = execFileSync("git", ["worktree", "list", "--porcelain"], {
      cwd: worktreePath,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })

    if (!worktrees.includes(`worktree ${worktreePath}`)) {
      return { valid: false, reason: "Worktree not registered in git" }
    }

    return { valid: true }
  } catch {
    return { valid: false, reason: "Git validation failed" }
  }
}

/**
 * Remove a git worktree
 * @param worktreePath - Path to the worktree
 * @returns true on success, false on failure
 */
export function removeWorktree(worktreePath: string): boolean {
  try {
    if (!existsSync(worktreePath)) {
      return true // Already removed
    }

    // Get the branch name from worktree
    const worktrees = execFileSync("git", ["worktree", "list", "--porcelain"], {
      cwd: worktreePath,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    })

    // Find the branch for this worktree
    const lines = worktrees.split("\n")
    let branchName: string | null = null
    let foundWorktree = false

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("worktree ")) {
        foundWorktree = lines[i].includes(worktreePath)
      }
      if (foundWorktree && lines[i].startsWith("branch ")) {
        branchName = lines[i].replace("branch ", "").trim()
        break
      }
    }

    // Remove worktree
    execFileSync("git", ["worktree", "remove", worktreePath, "--force"], {
      stdio: ["pipe", "pipe", "pipe"],
    })

    // If we have a branch, delete it too
    if (branchName) {
      try {
        execFileSync("git", ["branch", "-D", branchName], {
          stdio: ["pipe", "pipe", "pipe"],
        })
      } catch {
        // Branch deletion failed, but worktree removal succeeded
      }
    }

    return true
  } catch {
    return false
  }
}

/**
 * Ensure .bob/ directory exists in worktree
 * @param worktreePath - Path to the worktree
 */
export function ensureBoulderDirInWorktree(worktreePath: string): void {
  const boulderDir = join(worktreePath, ".bob")
  if (!existsSync(boulderDir)) {
    mkdirSync(boulderDir, { recursive: true })
  }
}

/**
 * Ensure .bob/plans symlink exists in worktree, pointing to root plans directory
 * This allows findStrategistPlans() to find plans when agent runs inside worktree
 * @param worktreePath - Path to the worktree
 * @param rootDirectory - Root directory of the project (where .bob/plans exists)
 */
export function ensurePlansSymlinkInWorktree(worktreePath: string, rootDirectory: string): boolean {
  const worktreePlansDir = join(worktreePath, BOULDER_DIR, "plans")
  const rootPlansDir = join(rootDirectory, BOULDER_DIR, "plans")

  // Check if root plans directory exists
  if (!existsSync(rootPlansDir)) {
    return false
  }

  // Check if already exists (symlink or directory)
  if (existsSync(worktreePlansDir)) {
    return true
  }

  try {
    // Create .bob/ directory in worktree if needed
    const worktreeBobDir = join(worktreePath, BOULDER_DIR)
    if (!existsSync(worktreeBobDir)) {
      mkdirSync(worktreeBobDir, { recursive: true })
    }

    // Create symlink from worktree/.bob/plans -> root/.bob/plans
    symlinkSync(rootPlansDir, worktreePlansDir, "dir")
    return true
  } catch {
    return false
  }
}

/**
 * Remove plans symlink from worktree (cleanup)
 * @param worktreePath - Path to the worktree
 */
export function removePlansSymlinkFromWorktree(worktreePath: string): boolean {
  const worktreePlansDir = join(worktreePath, BOULDER_DIR, "plans")

  if (!existsSync(worktreePlansDir)) {
    return true
  }

  try {
    // Check if it's a symlink before removing
    const stats = statSync(worktreePlansDir)
    if (stats.isSymbolicLink()) {
      unlinkSync(worktreePlansDir)
    }
    return true
  } catch {
    return false
  }
}

/**
 * Startup health check: validate all worktrees and clean up stale ones
 * @param directory - Project root directory
 * @returns Array of removed stale worktree names
 */
export function cleanupStaleWorktrees(directory: string): string[] {
  const removed: string[] = []
  const worktreeBase = join(directory, WORKTREE_BASE_DIR)

  if (!existsSync(worktreeBase)) {
    return removed
  }

  try {
    const entries = readdirSync(worktreeBase)

    for (const entry of entries) {
      const worktreePath = join(worktreeBase, entry)

      // Check if it's a directory
      if (!statSync(worktreePath).isDirectory()) {
        continue
      }

      // Validate health
      const health = validateWorktreeHealth(worktreePath)

      if (!health.valid) {
        // Stale worktree - remove it
        if (removeWorktree(worktreePath)) {
          removed.push(entry)
        }
      }
    }
  } catch {
    // Ignore errors during cleanup
  }

  return removed
}
