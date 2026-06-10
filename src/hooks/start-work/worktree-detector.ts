import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  rmdirSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { join } from "node:path";
import {
  BOULDER_DIR,
  WORKTREE_BASE_DIR,
  WORKTREE_LOCK_DIR,
  WORKTREE_LOCK_POLL_MS,
  WORKTREE_LOCK_TTL_MS,
  WORKTREE_LOCK_WAIT_MS,
} from "../../features/boulder-state/constants";
import {
  copyBoulderEntryToWorktree,
  worktreeHasLiveSession,
} from "../../features/boulder-state/storage";

export type WorktreeEntry = {
  path: string;
  branch: string | undefined;
  bare: boolean;
};

/**
 * Compute a short, stable hash for a (planName, sessionID) pair so that:
 *  - The same plan/session pair always lands on the same worktree path/branch.
 *  - Different sessions working on the same plan get distinct worktree paths,
 *    avoiding the path-collision bug from issue #5.
 *  - Different plans in the same session get distinct worktree paths, avoiding
 *    the path-collision bug from issue #3.
 *
 * 8 hex chars (32 bits) is enough entropy for a single developer machine —
 * collision probability is <1e-9 for <100 active plans.
 */
export function worktreePathHash(planName: string, sessionID?: string): string {
  const session = sessionID ?? "";
  const seed = `${planName}\u0000${session}`;
  return createHash("sha1").update(seed).digest("hex").slice(0, 8);
}

/**
 * Acquire a per-plan worktree-creation lock using mkdirSync({recursive:false}).
 * mkdir returns EEXIST atomically on POSIX, so this is race-free across processes.
 *
 * The lock directory is {rootDirectory}/{WORKTREE_LOCK_DIR}/{planName}.lock/.
 * The parent of the lock dir is created up front with recursive: true, then the
 * leaf is created with recursive: false so the OS gives us atomic EEXIST on it.
 * If a lock older than WORKTREE_LOCK_TTL_MS is present, it is considered stale
 * and stolen (a previous process must have died mid-operation).
 *
 * @param rootDirectory - Project root directory. The lock is scoped per-project
 *   so two projects on the same machine can work on plans with the same name
 *   without contending.
 * @param planName - Plan name to lock on.
 * @returns absolute path to the lock dir on success, or null on timeout
 */
export function acquireWorktreeLock(
  rootDirectory: string,
  planName: string,
  options?: { waitMs?: number; ttlMs?: number },
): string | null {
  const waitMs = options?.waitMs ?? WORKTREE_LOCK_WAIT_MS;
  const ttlMs = options?.ttlMs ?? WORKTREE_LOCK_TTL_MS;
  const lockBase = join(rootDirectory, WORKTREE_LOCK_DIR);
  const lockDir = join(lockBase, `${planName}.lock`);
  const deadline = Date.now() + waitMs;

  // Ensure the lock-base parent directory exists; this is one-time setup and
  // does not need to be inside the atomic-mkdir critical section.
  if (!existsSync(lockBase)) {
    try {
      mkdirSync(lockBase, { recursive: true });
    } catch {
      // ignore — another process may have created it concurrently
    }
  }

  while (Date.now() < deadline) {
    try {
      mkdirSync(lockDir, { recursive: false });
      return lockDir;
    } catch {
      // mkdir failed — either EEXIST (someone else holds the lock) or a real error.
      // Distinguish by checking the directory: if it exists and is stale, steal it.
      if (existsSync(lockDir)) {
        try {
          const mtimeMs = statSync(lockDir).mtimeMs;
          if (Date.now() - mtimeMs > ttlMs) {
            // Stale — try to remove and retry. Best-effort: if removal fails,
            // fall through to the sleep and try again later.
            try {
              rmdirSync(lockDir);
            } catch {
              // ignore
            }
            continue;
          }
        } catch {
          // stat failed (e.g. disappeared between exists and stat) — treat as transient.
        }
      }
    }

    const sleepMs = Math.min(WORKTREE_LOCK_POLL_MS, deadline - Date.now());
    if (sleepMs <= 0) break;
    // Busy-wait sleep using Atomics.wait-style synchronous delay; avoid setTimeout
    // so callers don't have to make this function async.
    const end = Date.now() + sleepMs;
    while (Date.now() < end) {}
  }

  return null;
}

/**
 * Release a lock previously acquired with acquireWorktreeLock.
 * Always call this in a finally block. Failures are silently ignored because
 * the lock is also protected by TTL-based stale recovery.
 */
export function releaseWorktreeLock(lockDir: string | null): void {
  if (!lockDir) return;
  try {
    rmdirSync(lockDir);
  } catch {
    // ignore
  }
}

export function parseWorktreeListPorcelain(output: string): WorktreeEntry[] {
  const lines = output.split("\n").map((line) => line.trim());
  const entries: WorktreeEntry[] = [];
  let current: Partial<WorktreeEntry> | undefined;

  for (const line of lines) {
    if (!line) {
      if (current?.path) {
        entries.push({
          path: current.path,
          branch: current.branch,
          bare: current.bare ?? false,
        });
      }
      current = undefined;
      continue;
    }

    if (line.startsWith("worktree ")) {
      current = { path: line.slice("worktree ".length).trim() };
      continue;
    }

    if (!current) continue;

    if (line.startsWith("branch ")) {
      current.branch = line
        .slice("branch ".length)
        .trim()
        .replace(/^refs\/heads\//, "");
    } else if (line === "bare") {
      current.bare = true;
    }
  }

  if (current?.path) {
    entries.push({
      path: current.path,
      branch: current.branch,
      bare: current.bare ?? false,
    });
  }

  return entries;
}

export function listWorktrees(directory: string): WorktreeEntry[] {
  try {
    const output = execFileSync("git", ["worktree", "list", "--porcelain"], {
      cwd: directory,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return parseWorktreeListPorcelain(output);
  } catch {
    return [];
  }
}

export function detectWorktreePath(directory: string): string | null {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: directory,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Create a git worktree for plan isolation.
 *
 * Fixes vs. the previous version:
 *  - Per-plan file lock (acquireWorktreeLock) closes the race where two parallel
 *    start-work invocations both pass existsSync() and one fails on git worktree add.
 *  - Unique hashed path/branch (`{planName}-{8-char-hash}`) eliminates collisions
 *    between different sessions working the same plan, and between different plans
 *    in different projects that happen to share a name.
 *  - Per-worktree boulder-registry copy: the matching plan's registry entry is
 *    copied into worktree/.bob/boulder-registry/, so the worktree has its own
 *    isolated state and parallel sessions can't stomp each other.
 *  - Plans are COPIED (not symlinked) into the worktree. The previous symlink
 *    meant writes in the worktree mutated root plans, which is a data-loss risk.
 *    Write-back still happens via syncBoulderNotepadsFromWorktree on completion.
 *
 * @param directory - Project root directory
 * @param planName - Plan name to use for worktree path and branch
 * @param sessionID - Optional OpenCode session ID; mixed into the path hash so
 *   parallel sessions working the same plan get distinct worktrees.
 * @returns Worktree path on success, null on failure
 */
export function createWorktreeForPlan(
  directory: string,
  planName: string,
  sessionID?: string,
): string | null {
  const hash = worktreePathHash(planName, sessionID ?? "");
  const worktreePath = join(
    directory,
    WORKTREE_BASE_DIR,
    `${planName}-${hash}`,
  );
  const branchName = `boulder/${planName}-${hash}`;

  // Per-plan lock — must be released in finally.
  const lockDir = acquireWorktreeLock(directory, planName);
  if (!lockDir) {
    return null;
  }
  try {
    // Re-check existence under the lock; another caller may have just finished.
    if (existsSync(worktreePath)) {
      const health = validateWorktreeHealth(worktreePath);
      if (health.valid) {
        // Ensure the worktree-local registry/plans are present (idempotent
        // re-entries from a re-fired hook still get a usable worktree).
        ensureBoulderDirInWorktree(worktreePath);
        ensurePlansCopyInWorktree(worktreePath, directory);
        copyBoulderEntryToWorktree(directory, worktreePath, planName);
        return worktreePath;
      }
      // Stale worktree — remove it first, then recreate.
      removeWorktree(worktreePath);
    }

    // Check if git repo
    execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: directory,
      stdio: ["pipe", "pipe", "pipe"],
    });

    execFileSync("git", ["worktree", "add", "-b", branchName, worktreePath], {
      cwd: directory,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Rebase the new branch onto main to pick up any commits that landed
    // after HEAD was read. This prevents the worktree from being behind main
    // when work is created after other parallel work has merged.
    try {
      execFileSync(
        "git",
        ["rebase", "main"],
        { cwd: worktreePath, stdio: ["pipe", "pipe", "pipe"] },
      );
    } catch {
      // Rebase may fail if there are conflicts or no upstream — non-fatal.
      // The worktree is still usable; the agent can resolve conflicts later.
    }

    // Ensure .bob/ directory exists in worktree
    ensureBoulderDirInWorktree(worktreePath);

    // Copy plans (do not symlink — symlinks would let worktree writes
    // mutate root plans, which is a data-loss risk).
    ensurePlansCopyInWorktree(worktreePath, directory);

    // Copy the matching boulder-registry entry into the worktree so the
    // running session has its own isolated state.
    copyBoulderEntryToWorktree(directory, worktreePath, planName);

    return worktreePath;
  } catch {
    // Git command failed (not a git repo, worktree exists, etc.)
    return null;
  } finally {
    releaseWorktreeLock(lockDir);
  }
}

/**
 * Validate if a worktree is healthy and usable
 * @param worktreePath - Path to the worktree
 * @returns { valid: boolean, reason?: string }
 */
export function validateWorktreeHealth(worktreePath: string): {
  valid: boolean;
  reason?: string;
} {
  // Check directory exists
  if (!existsSync(worktreePath)) {
    return { valid: false, reason: "Worktree directory does not exist" };
  }

  try {
    // Check if it's a valid git worktree
    execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: worktreePath,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Check git worktree list confirms it
    const worktrees = execFileSync("git", ["worktree", "list", "--porcelain"], {
      cwd: worktreePath,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    if (!worktrees.includes(`worktree ${worktreePath}`)) {
      return { valid: false, reason: "Worktree not registered in git" };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: "Git validation failed" };
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
      return true; // Already removed
    }

    // Get the branch name from worktree
    const worktrees = execFileSync("git", ["worktree", "list", "--porcelain"], {
      cwd: worktreePath,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Find the branch for this worktree
    const lines = worktrees.split("\n");
    let branchName: string | null = null;
    let foundWorktree = false;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("worktree ")) {
        foundWorktree = lines[i].includes(worktreePath);
      }
      if (foundWorktree && lines[i].startsWith("branch ")) {
        branchName = lines[i].replace("branch ", "").trim();
        break;
      }
    }

    // Remove worktree
    execFileSync("git", ["worktree", "remove", worktreePath, "--force"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    // If we have a branch, delete it too
    if (branchName) {
      try {
        execFileSync("git", ["branch", "-D", branchName], {
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch {
        // Branch deletion failed, but worktree removal succeeded
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure .bob/ directory exists in worktree
 * @param worktreePath - Path to the worktree
 */
export function ensureBoulderDirInWorktree(worktreePath: string): void {
  const boulderDir = join(worktreePath, ".bob");
  if (!existsSync(boulderDir)) {
    mkdirSync(boulderDir, { recursive: true });
  }
}

/**
 * Ensure .bob/plans exists in the worktree as a COPY of the root .bob/plans
 * directory. Each plan file is copied individually so the worktree has its
 * own independent view that it can write to without mutating the root.
 *
 * Previously this was a symlink to root, which meant writes in the worktree
 * silently mutated the root plans directory (data-loss risk). Write-back
 * still happens via syncBoulderNotepadsFromWorktree on plan completion.
 *
 * Idempotent: if .bob/plans already exists in the worktree (whether as a
 * legacy symlink or a real directory), this function is a no-op so we don't
 * accidentally clobber a previous copy. Stale symlinks can be removed via
 * removePlansFromWorktree before calling this again.
 *
 * @param worktreePath - Path to the worktree
 * @param rootDirectory - Root directory of the project (where .bob/plans exists)
 * @returns true on success, false when root plans dir is missing or copy failed
 */
export function ensurePlansCopyInWorktree(
  worktreePath: string,
  rootDirectory: string,
): boolean {
  const worktreePlansDir = join(worktreePath, BOULDER_DIR, "plans");
  const rootPlansDir = join(rootDirectory, BOULDER_DIR, "plans");

  if (!existsSync(rootPlansDir)) {
    return false;
  }

  if (existsSync(worktreePlansDir)) {
    return true;
  }

  try {
    mkdirSync(worktreePlansDir, { recursive: true });

    const rootFiles = readdirSync(rootPlansDir);
    for (const file of rootFiles) {
      const src = join(rootPlansDir, file);
      const dst = join(worktreePlansDir, file);
      const srcStat = statSync(src);
      if (srcStat.isFile()) {
        copyFileSync(src, dst);
      }
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove .bob/plans from a worktree. Handles both the new copy-based layout
 * and the legacy symlink layout for backwards compatibility. Idempotent.
 *
 * @param worktreePath - Path to the worktree
 * @returns true on success
 */
export function removePlansFromWorktree(worktreePath: string): boolean {
  const worktreePlansDir = join(worktreePath, BOULDER_DIR, "plans");

  if (!existsSync(worktreePlansDir)) {
    return true;
  }

  try {
    // Use lstatSync, not statSync: a symlink to a directory must be detected
    // as a symlink (and removed), not followed into the target.
    const stats = lstatSync(worktreePlansDir);
    if (stats.isSymbolicLink()) {
      unlinkSync(worktreePlansDir);
      return true;
    }
    if (stats.isDirectory()) {
      const files = readdirSync(worktreePlansDir);
      for (const file of files) {
        try {
          unlinkSync(join(worktreePlansDir, file));
        } catch {
          // ignore individual file removal errors
        }
      }
      try {
        rmdirSync(worktreePlansDir);
      } catch {
        // ignore
      }
    }
    return true;
  } catch {
    return false;
  }
}

// Back-compat shims for callers still using the old symlink names.
export const ensurePlansSymlinkInWorktree = ensurePlansCopyInWorktree;
export const removePlansSymlinkFromWorktree = removePlansFromWorktree;

/**
 * Startup health check: validate all worktrees and clean up stale ones.
 *
 * Fix vs. previous version: a worktree is only considered stale if BOTH:
 *  - it fails git health validation (corrupt .git, missing from worktree list, etc.)
 *  - it has no live boulder-registry session (no .bob/boulder-registry/*.json
 *    with a non-empty session_ids array).
 *
 * The previous version only checked git health, which could delete a worktree
 * while an agent session was still running inside it (data loss).
 *
 * @param directory - Project root directory
 * @returns Array of removed stale worktree names
 */
export function cleanupStaleWorktrees(directory: string): string[] {
  const removed: string[] = [];
  const worktreeBase = join(directory, WORKTREE_BASE_DIR);

  if (!existsSync(worktreeBase)) {
    return removed;
  }

  try {
    const entries = readdirSync(worktreeBase);

    for (const entry of entries) {
      // Skip the lock directory itself — it isn't a worktree.
      if (entry === ".locks") {
        continue;
      }

      const worktreePath = join(worktreeBase, entry);

      // Check if it's a directory
      if (!statSync(worktreePath).isDirectory()) {
        continue;
      }

      // Session-aware check: never remove a worktree that has a live session.
      if (worktreeHasLiveSession(worktreePath)) {
        continue;
      }

      // Validate health
      const health = validateWorktreeHealth(worktreePath);

      if (!health.valid) {
        // Stale worktree - remove it
        if (removeWorktree(worktreePath)) {
          removed.push(entry);
        }
      }
    }
  } catch {
    // Ignore errors during cleanup
  }

  return removed;
}
