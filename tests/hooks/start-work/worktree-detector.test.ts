import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { tmpdir } from "os";
import { join } from "path";
import { mkdirSync, rmSync, existsSync, readdirSync } from "fs";
import {
  createWorktreeForPlan,
  validateWorktreeHealth,
  removeWorktree,
  ensureBoulderDirInWorktree,
  cleanupStaleWorktrees,
  parseWorktreeListPorcelain,
} from "../../../src/hooks/start-work/worktree-detector";

describe("Worktree Detector", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `worktree-test-${Date.now()}-${Math.random()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("parseWorktreeListPorcelain", () => {
    it("parses basic worktree output", () => {
      const output = `worktree /path/to/main
branch refs/heads/main

worktree /path/to/worktree1
branch refs/heads/boulder/plan-a
`;
      const entries = parseWorktreeListPorcelain(output);
      expect(entries).toHaveLength(2);
      expect(entries[0].path).toBe("/path/to/main");
      expect(entries[0].branch).toBe("main");
      expect(entries[1].path).toBe("/path/to/worktree1");
      expect(entries[1].branch).toBe("boulder/plan-a");
    });

    it("handles bare worktree", () => {
      const output = `worktree /path/to/bare
bare
`;
      const entries = parseWorktreeListPorcelain(output);
      expect(entries).toHaveLength(1);
      expect(entries[0].bare).toBe(true);
    });

    it("handles empty output", () => {
      const entries = parseWorktreeListPorcelain("");
      expect(entries).toHaveLength(0);
    });
  });

  describe("validateWorktreeHealth", () => {
    it("returns invalid for missing directory", () => {
      const result = validateWorktreeHealth(join(testDir, "nonexistent"));
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("does not exist");
    });

    it("returns invalid for non-git directory", () => {
      const nonGitDir = join(testDir, "non-git");
      mkdirSync(nonGitDir, { recursive: true });

      const result = validateWorktreeHealth(nonGitDir);
      expect(result.valid).toBe(false);
    });
  });

  describe("ensureBoulderDirInWorktree", () => {
    it("creates .bob directory in worktree", () => {
      const worktreePath = join(testDir, "my-worktree");
      mkdirSync(worktreePath, { recursive: true });

      ensureBoulderDirInWorktree(worktreePath);

      expect(existsSync(join(worktreePath, ".bob"))).toBe(true);
    });

    it("does not error if .bob already exists", () => {
      const worktreePath = join(testDir, "existing-bob");
      mkdirSync(join(worktreePath, ".bob"), { recursive: true });

      expect(() => ensureBoulderDirInWorktree(worktreePath)).not.toThrow();
    });
  });

  describe("cleanupStaleWorktrees", () => {
    it("returns empty array when no worktrees exist", () => {
      const result = cleanupStaleWorktrees(testDir);
      expect(result).toEqual([]);
    });

    it("returns empty array when worktree base dir does not exist", () => {
      const result = cleanupStaleWorktrees(join(testDir, "nonexistent-base"));
      expect(result).toEqual([]);
    });

    it("skips non-directory entries", () => {
      const worktreeBase = join(testDir, ".opencode/worktrees");
      mkdirSync(worktreeBase, { recursive: true });
      const fileInWorktreeBase = join(worktreeBase, "not-a-dir.txt");
      const { writeFileSync } = require("fs");
      writeFileSync(fileInWorktreeBase, "not a directory", "utf-8");

      const result = cleanupStaleWorktrees(testDir);
      expect(result).toEqual([]);
    });
  });

  describe("createWorktreeForPlan", () => {
    it("returns null for non-git directory", () => {
      const result = createWorktreeForPlan(testDir, "plan-in-non-git");
      expect(result).toBeNull();
    });

    it("returns null when git command fails", () => {
      const result = createWorktreeForPlan(join(testDir, "nonexistent"), "plan-fail");
      expect(result).toBeNull();
    });
  });

  describe("removeWorktree", () => {
    it("returns true for nonexistent path", () => {
      const result = removeWorktree(join(testDir, "nonexistent"));
      expect(result).toBe(true);
    });
  });
});
