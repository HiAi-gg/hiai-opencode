/**
 * Git Operations for Manager Source Control Integration (CH-007)
 *
 * Provides git utilities for branch tracking and divergence detection.
 */

import { execFileSync, execSync } from "node:child_process";

/**
 * Get the current git branch name for a directory
 * @returns branch name or null if not a git repo
 */
export function getCurrentBranch(directory: string): string | null {
  try {
    const branch = execSync("git branch --show-current", {
      cwd: directory,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return branch || null;
  } catch {
    return null;
  }
}

/**
 * Check if the current branch has diverged from its upstream
 * Returns true if branch has diverged (both ahead and behind) or has unpulled commits
 * @returns true if divergence detected
 */
export function hasUpstreamDivergence(directory: string): boolean {
  try {
    // Get rev-list to check for divergence
    // rev-list --left-right --count HEAD...@{upstream} returns "ahead behind"
    const result = execSync(
      "git rev-list --left-right --count HEAD...@{upstream}",
      {
        cwd: directory,
        encoding: "utf-8",
        timeout: 5000,
        stdio: ["pipe", "pipe", "pipe"],
      },
    ).trim();

    const [ahead, behind] = result.split("\t").map((n) => parseInt(n, 10) || 0);
    // Diverged means both ahead AND behind, or we have commits behind
    return (ahead > 0 && behind > 0) || behind > 0;
  } catch {
    // No upstream or not a git repo
    return false;
  }
}

/**
 * Get list of modified files compared to HEAD
 * @returns array of relative file paths
 */
export function getModifiedFiles(directory: string): string[] {
  try {
    const output = execSync("git diff --name-only HEAD", {
      cwd: directory,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    if (!output) return [];
    return output.split("\n").filter((f) => f.trim());
  } catch {
    return [];
  }
}

/**
 * Get list of staged files
 * @returns array of relative file paths
 */
export function getStagedFiles(directory: string): string[] {
  try {
    const output = execSync("git diff --name-only --cached", {
      cwd: directory,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    if (!output) return [];
    return output.split("\n").filter((f) => f.trim());
  } catch {
    return [];
  }
}

/**
 * Check if there are uncommitted changes
 * @returns true if there are uncommitted changes
 */
export function hasUncommittedChanges(directory: string): boolean {
  try {
    const output = execSync("git status --porcelain", {
      cwd: directory,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    return output.length > 0;
  } catch {
    return false;
  }
}

/**
 * Run `git merge --no-commit` to check if a merge would succeed without committing
 * This is used to check if the current branch can be merged into without conflicts
 * @returns true if merge would succeed (no conflicts), false if there are conflicts
 */
export function canMergeWithoutConflicts(
  directory: string,
  targetBranch = "main",
): boolean {
  try {
    // Store current state
    const stashOutput = execSync("git stash", {
      cwd: directory,
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    });

    try {
      // Try merge without committing
      execFileSync("git", ["merge", "--no-commit", "--no-ff", targetBranch], {
        cwd: directory,
        encoding: "utf-8",
        timeout: 10000,
        stdio: ["pipe", "pipe", "pipe"],
      });
      // Merge succeeded - abort and restore
      execSync("git merge --abort", {
        cwd: directory,
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
      return true;
    } catch {
      // Merge had conflicts - abort and restore
      try {
        execSync("git merge --abort", {
          cwd: directory,
          encoding: "utf-8",
          stdio: ["pipe", "pipe", "pipe"],
        });
      } catch {
        // Ignore abort errors
      }
      return false;
    } finally {
      // Restore stashed changes
      if (!stashOutput.toString().includes("No stash entries")) {
        execSync("git stash pop", {
          cwd: directory,
          encoding: "utf-8",
          timeout: 5000,
          stdio: ["pipe", "pipe", "pipe"],
        });
      }
    }
  } catch {
    return false;
  }
}

/**
 * Get branch info for a directory including divergence status
 * @returns branch info object
 */
export function getBranchInfo(directory: string): {
  branch_name: string | null;
  upstream_divergence: boolean;
  modified_files: string[];
  has_uncommitted: boolean;
} {
  const branch_name = getCurrentBranch(directory);
  const upstream_divergence = branch_name
    ? hasUpstreamDivergence(directory)
    : false;
  const modified_files = getModifiedFiles(directory);
  const has_uncommitted = hasUncommittedChanges(directory);

  return {
    branch_name,
    upstream_divergence,
    modified_files,
    has_uncommitted,
  };
}
