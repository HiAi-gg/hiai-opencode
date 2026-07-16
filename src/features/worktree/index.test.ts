/**
 * index.test.ts — Unit tests for WorktreeManager.
 *
 * Exercises every public method (create / remove / list / status / cleanup)
 * against a real, isolated git repository created in a temporary directory.
 * No mocks are used; all assertions run against actual `git worktree` state.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { $ } from "bun";
import { WorktreeManager } from "./index";

let repoDir: string;
let worktreesBase: string;
let originalCwd: string;

/**
 * Normalize a path for cross-platform comparison: resolve relative segments
 * and lower-case so Windows 8.3 short names, forward/back slash separators,
 * and case differences never cause spurious assertion mismatches.
 */
function norm(p: string): string {
  return path.resolve(p).toLowerCase();
}

/** Run a git command in a specific directory and return its stdout. */
async function gitIn(cwd: string, args: string[]): Promise<string> {
  return (await $`git -C ${cwd} ${args}`.text()).toString();
}

beforeAll(async () => {
  originalCwd = process.cwd();

  // Create an isolated git repository for the whole suite.
  repoDir = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "wt-repo-")),
  );
  // Keep worktrees OUTSIDE the repo so the main checkout stays pristine
  // (untracked worktree dirs would otherwise mark it dirty).
  worktreesBase = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "wt-trees-")),
  );

  await $`git -C ${repoDir} init -q`.quiet();
  await $`git -C ${repoDir} config user.email test@example.com`.quiet();
  await $`git -C ${repoDir} config user.name "Test User"`.quiet();
  fs.writeFileSync(path.join(repoDir, "README.md"), "# test repo\n");
  await $`git -C ${repoDir} add -A`.quiet();
  await $`git -C ${repoDir} commit -q -m "initial commit"`.quiet();

  // WorktreeManager resolves the repo root from the current working dir,
  // so the test process must live inside the temp repository.
  process.chdir(repoDir);
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(repoDir, { recursive: true, force: true });
});

describe("WorktreeManager.create()", () => {
  test("creates the worktree directory, a branch, and returns WorktreeInfo", async () => {
    const mgr = new WorktreeManager({ baseDir: worktreesBase });
    const info = await mgr.create({
      name: "feature-x",
      planName: "Feature X Plan",
    });

    expect(info.name).toBe("feature-x");
    expect(info.isMain).toBe(false);
    expect(info.isLinked).toBe(true);
    // slug of "Feature X Plan" -> "feature-x-plan" -> sliced to 8 -> "feature-"
    expect(info.branch).toBe("hiai-bob/feature-");
    expect(norm(info.path)).toBe(
      norm(path.resolve(worktreesBase, "feature-x")),
    );

    // The worktree directory must exist on disk.
    expect(fs.existsSync(info.path)).toBe(true);

    // The dedicated branch must exist in the repository.
    const branches = await gitIn(repoDir, ["branch", "--list", info.branch]);
    expect(branches.trim()).toContain(info.branch);
  });

  test("derives a slugged name and branch when only planName is given", async () => {
    const mgr = new WorktreeManager({ baseDir: worktreesBase });
    const info = await mgr.create({ planName: "My Cool Plan!!" });

    // slug: "my-cool-plan" -> sliced to 8 -> "my-cool-"
    // sanitizeName trims the trailing dash, so name loses it but branch keeps it.
    expect(info.name).toBe("my-cool");
    expect(info.branch).toBe("hiai-bob/my-cool-");
    expect(fs.existsSync(info.path)).toBe(true);
  });
});

describe("WorktreeManager.remove()", () => {
  test("removes the worktree directory and returns true", async () => {
    const mgr = new WorktreeManager({ baseDir: worktreesBase });
    const info = await mgr.create({ name: "to-remove" });
    expect(fs.existsSync(info.path)).toBe(true);

    const result = await mgr.remove(info.path);
    expect(result).toBe(true);
    expect(fs.existsSync(info.path)).toBe(false);
  });

  test("returns true for an already-removed directory", async () => {
    const mgr = new WorktreeManager({ baseDir: worktreesBase });
    const info = await mgr.create({ name: "remove-twice" });
    expect(await mgr.remove(info.path)).toBe(true);
    // Calling remove again on a non-existent path still resolves to true.
    expect(await mgr.remove(info.path)).toBe(true);
  });
});

describe("WorktreeManager.list()", () => {
  test("parses porcelain output into WorktreeInfo entries", async () => {
    const mgr = new WorktreeManager({ baseDir: worktreesBase });
    await mgr.create({ name: "wt-list" });

    const list = await mgr.list();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(2); // main + the linked worktree

    const main = list.find((w) => w.isMain);
    expect(main).toBeDefined();
    expect(main!.isLinked).toBe(false);
    expect(main!.branch).toBeTruthy();

    const linked = list.find((w) => w.name === "wt-list");
    expect(linked).toBeDefined();
    expect(linked!.isLinked).toBe(true);
    expect(linked!.isMain).toBe(false);
    expect(linked!.branch).toBe("hiai-bob/wt-list");
  });
});

describe("WorktreeManager.status()", () => {
  test("defaults to the main checkout and reports a pristine state", async () => {
    const mgr = new WorktreeManager({ baseDir: worktreesBase });
    const st = await mgr.status();

    // Normalize both sides through path.resolve() + toLowerCase() so Windows
    // 8.3 short names (RUNNER~1) and long names (runneradmin), forward/back
    // slash separators, and case differences compare identically. This avoids
    // realpathSync, which throws ENOENT and has platform-specific quirks.
    expect(norm(st.directory)).toBe(norm(repoDir));
    expect(st.branch).toBeTruthy();
    expect(st.dirty).toBe(false);
    expect(st.hasConflicts).toBe(false);
    expect(st.ahead).toBe(0);
    expect(st.behind).toBe(0);
    expect(st.commit).toMatch(/^[0-9a-f]{40}$/);
  });

  test("detects inside a linked worktree and reports its branch", async () => {
    const mgr = new WorktreeManager({ baseDir: worktreesBase });
    const info = await mgr.create({ name: "wt-status" });

    const st = await mgr.status(info.path);
    expect(norm(st.directory)).toBe(norm(info.path));
    expect(st.branch).toBe(info.branch);
    expect(st.dirty).toBe(false);
    expect(st.hasConflicts).toBe(false);
  });

  test("reports dirty when a tracked file is modified", async () => {
    const mgr = new WorktreeManager({ baseDir: worktreesBase });
    const info = await mgr.create({ name: "wt-dirty" });

    fs.writeFileSync(path.join(info.path, "README.md"), "modified content\n");
    const st = await mgr.status(info.path);
    expect(st.dirty).toBe(true);
  });
});

describe("WorktreeManager.cleanup()", () => {
  test("removes orphaned worktree directories not registered with git", async () => {
    const mgr = new WorktreeManager({ baseDir: worktreesBase });
    await mgr.create({ name: "wt-cleanup" });

    // An orphan directory that git does not know about.
    const orphan = path.join(worktreesBase, "orphan-dir");
    fs.mkdirSync(orphan, { recursive: true });
    expect(fs.existsSync(orphan)).toBe(true);

    const removed = await mgr.cleanup();
    expect(removed.map(norm)).toContain(norm(path.resolve(orphan)));
    expect(fs.existsSync(orphan)).toBe(false);
  });

  test("does not remove registered worktrees", async () => {
    const mgr = new WorktreeManager({ baseDir: worktreesBase });
    const info = await mgr.create({ name: "wt-keep" });

    const removed = await mgr.cleanup();
    // Normalize both sides so Windows separator/case/8.3 differences do not
    // cause a false positive. info.path is still registered with git, so it
    // must not appear in the removed set.
    expect(removed.map(norm)).not.toContain(norm(path.resolve(info.path)));
    expect(fs.existsSync(info.path)).toBe(true);
  });
});

describe("WorktreeManager edge cases", () => {
  test("create() throws on a name collision (existing directory)", async () => {
    const mgr = new WorktreeManager({ baseDir: worktreesBase });
    await mgr.create({ name: "collide" });
    await expect(mgr.create({ name: "collide" })).rejects.toThrow();
  });

  test("sanitizeName rejects unsafe names via create()", async () => {
    const mgr = new WorktreeManager({ baseDir: worktreesBase });
    // A name that resolves to "." after sanitization is rejected.
    await expect(mgr.create({ name: ".." })).rejects.toThrow();
  });
});

describe("WorktreeManager outside a git repository", () => {
  let nonGitDir: string;
  let savedCwd: string;

  beforeAll(() => {
    savedCwd = process.cwd();
    nonGitDir = fs.realpathSync.native(
      fs.mkdtempSync(path.join(os.tmpdir(), "wt-nogit-")),
    );
    process.chdir(nonGitDir);
  });

  afterAll(() => {
    process.chdir(savedCwd);
    fs.rmSync(nonGitDir, { recursive: true, force: true });
  });

  test("create() throws when not inside a git repository", async () => {
    const mgr = new WorktreeManager({ baseDir: nonGitDir });
    await expect(mgr.create({ name: "x" })).rejects.toThrow();
  });

  test("list() throws when not inside a git repository", async () => {
    const mgr = new WorktreeManager({ baseDir: nonGitDir });
    await expect(mgr.list()).rejects.toThrow();
  });

  test("status() throws when not inside a git repository", async () => {
    const mgr = new WorktreeManager({ baseDir: nonGitDir });
    await expect(mgr.status()).rejects.toThrow();
  });
});
