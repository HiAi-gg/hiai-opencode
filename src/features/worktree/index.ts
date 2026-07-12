/**
 * Worktree management for git worktree operations.
 * Provides isolated working directories for parallel agent tasks.
 *
 * Uses Bun.$ for git commands and node:fs / node:path for file operations.
 * No external dependencies (Effect, Zod, child_process) are used.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { $ } from "bun";

/** Information about a single git worktree. */
export interface WorktreeInfo {
  name: string;
  path: string;
  branch: string;
  isMain: boolean;
  isLinked: boolean;
}

/** Runtime status of a worktree (or the main checkout). */
export interface WorktreeStatus {
  directory: string;
  branch: string;
  commit: string;
  dirty: boolean;
  ahead: number;
  behind: number;
  hasConflicts: boolean;
}

/** Raw entry parsed from `git worktree list --porcelain`. */
interface RawEntry {
  path: string;
  head: string;
  branch?: string;
  locked?: string;
  prunable?: string;
}

/** Options for {@link WorktreeManager.create}. */
export interface CreateOptions {
  name?: string;
  planName?: string;
}

const LOCK_ATTEMPTS = 26;
const LOCK_RETRY_MS = 100;
const BRANCH_PREFIX = "hiai-bob/";

/**
 * Manages git worktrees under `<repo>/.hiai-bob/worktrees/`.
 *
 * Branches follow the convention `hiai-bob/<slug>` where slug is the first 8
 * characters of the plan name, normalized so that runs of non `[a-z0-9]`
 * characters become a single dash.
 */
export class WorktreeManager {
  private readonly baseDir?: string;
  private _repoRoot?: string;
  private _worktreesDir?: string;

  constructor(opts?: { baseDir?: string }) {
    this.baseDir = opts?.baseDir;
  }

  /**
   * Create a new linked worktree with a dedicated branch.
   */
  async create(opts?: CreateOptions): Promise<WorktreeInfo> {
    const worktreesDir = await this.resolveWorktreesDir();
    const planName = opts?.planName ?? opts?.name ?? "worktree";
    const slug = toSlug(planName);
    const name = sanitizeName(opts?.name ?? slug);
    const directory = path.resolve(worktreesDir, name);
    const branch = `${BRANCH_PREFIX}${slug}`;

    const lockPath = path.join(worktreesDir, `.${name}.lock`);
    await this.acquireLock(lockPath);
    try {
      fs.mkdirSync(path.dirname(directory), { recursive: true });
      await $`git worktree add -b ${branch} ${directory}`.quiet();
    } finally {
      this.releaseLock(lockPath);
    }

    return {
      name,
      path: directory,
      branch,
      isMain: false,
      isLinked: true,
    };
  }

  /**
   * Remove a worktree by its directory. Returns true if it no longer exists.
   */
  async remove(directory: string): Promise<boolean> {
    const dir = path.resolve(directory);
    try {
      await $`git worktree remove --force ${dir}`.quiet();
      return true;
    } catch {
      // Fall back to pruning and manual removal for broken worktrees.
      try {
        await $`git worktree prune`.quiet();
      } catch {
        // ignore prune failures
      }
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
      return !fs.existsSync(dir);
    }
  }

  /**
   * List all registered worktrees (including the main checkout).
   */
  async list(): Promise<WorktreeInfo[]> {
    const text = await this.git(["worktree", "list", "--porcelain"]);
    const entries = this.parseWorktreeList(text);
    const rootCanon = path.resolve(await this.resolveRepoRoot());
    return entries.map((e) => {
      const isMain = pathsEqual(e.path, rootCanon);
      return {
        name: path.basename(e.path),
        path: e.path,
        branch: e.branch ?? "(detached)",
        isMain,
        isLinked: !isMain,
      };
    });
  }

  /**
   * Get the status of a worktree (defaults to the main checkout).
   */
  async status(directory?: string): Promise<WorktreeStatus> {
    let dir = directory
      ? path.resolve(directory)
      : await this.resolveRepoRoot();
    if (directory) {
      try {
        const text = await this.git(["worktree", "list", "--porcelain"]);
        const located = this.locateWorktree(this.parseWorktreeList(text), dir);
        if (located) dir = path.resolve(located.path);
      } catch {
        // Fall back to the provided directory if listing fails.
      }
    }
    const branch = (
      await this.gitIn(dir, ["rev-parse", "--abbrev-ref", "HEAD"])
    ).trim();
    const commit = (await this.gitIn(dir, ["rev-parse", "HEAD"])).trim();
    const porcelain = (await this.gitIn(dir, ["status", "--porcelain"])).trim();
    const dirty = porcelain.length > 0;
    const conflicts = (
      await this.gitIn(dir, ["diff", "--name-only", "--diff-filter=U"])
    ).trim();
    const hasConflicts = conflicts.length > 0;

    let ahead = 0;
    let behind = 0;
    try {
      const counts = (
        await this.gitIn(dir, [
          "rev-list",
          "--left-right",
          "--count",
          "@{upstream}...HEAD",
        ])
      ).trim();
      const [b, a] = counts.split(/\s+/).map((n) => Number.parseInt(n, 10));
      behind = Number.isFinite(b) ? b : 0;
      ahead = Number.isFinite(a) ? a : 0;
    } catch {
      // No upstream configured — leave ahead/behind at zero.
    }

    return {
      directory: dir,
      branch,
      commit,
      dirty,
      ahead,
      behind,
      hasConflicts,
    };
  }

  /**
   * Prune stale worktree metadata and remove orphaned directories under the
   * worktrees root that are no longer registered. Returns removed paths.
   */
  async cleanup(): Promise<string[]> {
    const worktreesDir = await this.resolveWorktreesDir();
    try {
      await $`git worktree prune`.quiet();
    } catch {
      // ignore prune failures
    }

    const text = await this.git(["worktree", "list", "--porcelain"]);
    const entries = this.parseWorktreeList(text);
    // Normalize every registered path through path.resolve() + toLowerCase()
    // so that Windows 8.3 short names, forward/back slash separators, and case
    // differences never cause a registered worktree to be mistaken for an
    // orphan. path.resolve() does not require the path to exist on disk, so it
    // is safe even when git reports a worktree whose directory was already
    // removed.
    const registered = new Set(
      entries.map((e) => path.resolve(e.path).toLowerCase()),
    );

    const removed: string[] = [];
    if (!fs.existsSync(worktreesDir)) return removed;

    for (const child of fs.readdirSync(worktreesDir)) {
      if (child.startsWith(".")) continue; // skip lock files and dot entries
      const full = path.resolve(worktreesDir, child);
      if (registered.has(full.toLowerCase())) continue;
      try {
        fs.rmSync(full, { recursive: true, force: true });
        removed.push(full);
      } catch {
        // ignore individual removal failures
      }
    }
    return removed;
  }

  /**
   * Parse the output of `git worktree list --porcelain` into raw entries.
   */
  private parseWorktreeList(text: string): RawEntry[] {
    const entries: RawEntry[] = [];
    const blocks = text.split(/\n\n+/);

    for (const block of blocks) {
      const lines = block.split("\n").filter((l) => l.length > 0);
      if (lines.length === 0) continue;

      let entry: RawEntry | undefined;
      for (const line of lines) {
        if (line.startsWith("worktree ")) {
          entry = {
            path: line.slice("worktree ".length).trim(),
            head: "",
          };
        } else if (!entry) {
          // No entry started yet — skip to next line
        } else if (line.startsWith("HEAD ")) {
          entry.head = line.slice("HEAD ".length).trim();
        } else if (line.startsWith("branch ")) {
          entry.branch = line
            .slice("branch ".length)
            .trim()
            .replace(/^refs\/heads\//, "");
        } else if (line.startsWith("locked")) {
          entry.locked = line.slice("locked".length).trim() || "locked";
        } else if (line.startsWith("prunable")) {
          entry.prunable = line.slice("prunable".length).trim() || "prunable";
        }
        // "bare" and "detached" markers carry no extra data we need here.
      }

      if (entry) entries.push(entry);
    }

    return entries;
  }

  /**
   * Locate a raw entry whose path matches the given directory (canonicalized).
   */
  private locateWorktree(
    entries: RawEntry[],
    dir: string,
  ): RawEntry | undefined {
    const target = path.resolve(dir);
    return entries.find((e) => pathsEqual(e.path, target));
  }

  // --- internals ---------------------------------------------------------

  private async resolveRepoRoot(): Promise<string> {
    if (this._repoRoot) return this._repoRoot;
    const out = await $`git rev-parse --show-toplevel`.text();
    this._repoRoot = out.trim();
    return this._repoRoot;
  }

  private async resolveWorktreesDir(): Promise<string> {
    if (this._worktreesDir) return this._worktreesDir;
    const root = await this.resolveRepoRoot();
    this._worktreesDir =
      this.baseDir ?? path.join(root, ".hiai-bob", "worktrees");
    fs.mkdirSync(this._worktreesDir, { recursive: true });
    return this._worktreesDir;
  }

  private async git(args: string[]): Promise<string> {
    const root = await this.resolveRepoRoot();
    return this.gitIn(root, args);
  }

  private async gitIn(dir: string, args: string[]): Promise<string> {
    const result = await $`git -C ${dir} ${args}`.text();
    return result;
  }

  private async acquireLock(lockPath: string): Promise<void> {
    for (let i = 0; i < LOCK_ATTEMPTS; i++) {
      if (!fs.existsSync(lockPath)) {
        try {
          fs.writeFileSync(lockPath, String(process.pid), { flag: "wx" });
          return;
        } catch {
          // Another process created the lock between the check and write.
        }
      }
      await Bun.sleep(LOCK_RETRY_MS);
    }
    throw new Error(
      `Could not acquire lock ${lockPath} after ${LOCK_ATTEMPTS} attempts`,
    );
  }

  private releaseLock(lockPath: string): void {
    try {
      fs.rmSync(lockPath, { force: true });
    } catch {
      // ignore
    }
  }
}

/**
 * Compare two filesystem paths for equality in a cross-platform way.
 *
 * Both sides are passed through `path.resolve()` (which normalizes relative
 * segments and forward/back slash separators on Windows) and lowercased before
 * comparison. This makes the check robust against:
 *   - forward vs back slash separator styles (git returns `/`, Node returns `\`)
 *   - case differences (e.g. `RUNNER~1` vs `runneradmin` on Windows)
 *   - 8.3 short-name vs long-name forms
 *
 * `path.resolve()` does not require the path to exist on disk, so this is safe
 * for paths that may have been removed.
 */
function pathsEqual(a: string, b: string): boolean {
  return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();
}

/** Normalize a plan name into an 8-char slug: `[^a-z0-9]+` -> `-`. */
function toSlug(planName: string): string {
  const slug = planName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 8);
  return slug.length > 0 ? slug : "worktree";
}

/** Ensure a worktree name is safe to use as a directory entry. */
function sanitizeName(name: string): string {
  const clean = name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  if (
    clean.length === 0 ||
    clean === "." ||
    clean === ".." ||
    path.isAbsolute(name)
  ) {
    throw new Error(`Invalid worktree name: ${name}`);
  }
  return clean;
}

/** Default singleton instance for convenience. */
export const worktreeManager = new WorktreeManager();
