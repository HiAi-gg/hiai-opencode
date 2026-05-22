import { execFileSync } from "node:child_process";

export interface GitStateSummary {
  branch: string;
  hasUncommittedChanges: boolean;
  uncommittedCount: number;
  stagedCount: number;
  unstagedCount: number;
  untrackedCount: number;
  cleanWorkingTree: boolean;
}

/**
 * Gathers a lightweight summary of current git state for Manager to use
 * before making delegation decisions. Does NOT run git diff (expensive).
 */
export function getGitStateSummary(directory: string): GitStateSummary | null {
  try {
    const branch = execFileSync("git", ["branch", "--show-current"], {
      cwd: directory,
      encoding: "utf-8",
      timeout: 3000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    const statusOutput = execFileSync("git", ["status", "--porcelain"], {
      cwd: directory,
      encoding: "utf-8",
      timeout: 3000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    if (!statusOutput) {
      return {
        branch,
        hasUncommittedChanges: false,
        uncommittedCount: 0,
        stagedCount: 0,
        unstagedCount: 0,
        untrackedCount: 0,
        cleanWorkingTree: true,
      };
    }

    let stagedCount = 0;
    let unstagedCount = 0;
    let untrackedCount = 0;

    for (const line of statusOutput.split("\n")) {
      if (!line || line.length < 2) continue;
      const indexStatus = line[0];
      const worktreeStatus = line[1];
      const filePath = line.slice(3);

      if (filePath.includes("node_modules") || filePath.includes(".git"))
        continue;

      if (indexStatus === "?" && worktreeStatus === "?") {
        untrackedCount++;
      } else if (indexStatus !== " " && indexStatus !== "?") {
        stagedCount++;
      }

      if (worktreeStatus !== " " && worktreeStatus !== "?") {
        unstagedCount++;
      }
    }

    const uncommittedCount = stagedCount + unstagedCount;

    return {
      branch,
      hasUncommittedChanges: uncommittedCount > 0 || untrackedCount > 0,
      uncommittedCount,
      stagedCount,
      unstagedCount,
      untrackedCount,
      cleanWorkingTree: uncommittedCount === 0 && untrackedCount === 0,
    };
  } catch {
    return null;
  }
}
