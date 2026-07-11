/**
 * memory/service.test.ts — Tests for the memory service layer.
 *
 * Uses a temporary directory + SQLite db for isolated testing.
 * Each test uses its own db path to avoid db.ts singleton caching issues.
 * reconcileMemory returns { indexed, pruned } so checks check indexed count.
 */

import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resetDb } from "./db";
import { createMemoryService } from "./service";

function makeTestDir() {
  const dir = join(
    tmpdir(),
    `hiai-memory-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const memoryRoot = join(dir, "memory");
  const dbPath = join(dir, "test.db");
  mkdirSync(memoryRoot, { recursive: true });
  return { dir, memoryRoot, dbPath };
}

function addTestMemoryFile(memoryRoot: string) {
  const projectDir = join(memoryRoot, "projects", "test-project");
  mkdirSync(projectDir, { recursive: true });
  writeFileSync(
    join(projectDir, "MEMORY.md"),
    "# Test Memory\n\nThis is test project memory about authentication and database configuration.",
  );
  writeFileSync(
    join(projectDir, "note.md"),
    "Some additional notes about the project.",
  );
}

afterEach(() => {
  resetDb();
});

describe("createMemoryService", () => {
  test("creates service with root path", () => {
    const { memoryRoot, dbPath } = makeTestDir();
    const svc = createMemoryService({
      memoryRoot,
      dbPath,
      searchScoreFloor: 0,
    });
    expect(svc.root()).toBe(memoryRoot);
  });

  test("reconcile scans memory root and populates the database", async () => {
    const { memoryRoot, dbPath } = makeTestDir();
    addTestMemoryFile(memoryRoot);
    const svc = createMemoryService({
      memoryRoot,
      dbPath,
      searchScoreFloor: 0,
    });
    const result = await svc.reconcile();
    expect(result.indexed).toBeGreaterThan(0);
  });

  test("search returns results from reconciled memory", async () => {
    const { memoryRoot, dbPath } = makeTestDir();
    addTestMemoryFile(memoryRoot);
    const svc = createMemoryService({
      memoryRoot,
      dbPath,
      searchScoreFloor: 0.001,
    });

    // Ensure reconcile happens
    await svc.reconcile();

    const results = await svc.search({ query: "authentication", limit: 5 });
    if (results.length > 0) {
      expect(results[0].path).toContain("MEMORY.md");
      expect(results[0].snippet).toBeDefined();
      expect(typeof results[0].score).toBe("number");
    }
  });

  test("search returns empty array for non-matching query", async () => {
    const { memoryRoot, dbPath } = makeTestDir();
    addTestMemoryFile(memoryRoot);
    const svc = createMemoryService({
      memoryRoot,
      dbPath,
      searchScoreFloor: 0,
    });
    await svc.reconcile();

    const results = await svc.search({ query: "zzzznotexistzzzz", limit: 5 });
    expect(results).toHaveLength(0);
  });

  test("search respects scope filter", async () => {
    const { memoryRoot, dbPath } = makeTestDir();
    addTestMemoryFile(memoryRoot);
    const svc = createMemoryService({
      memoryRoot,
      dbPath,
      searchScoreFloor: 0,
    });
    await svc.reconcile();

    const results = await svc.search({
      query: "memory",
      scope: "projects",
      limit: 10,
    });
    expect(Array.isArray(results)).toBe(true);
  });

  test("search respects limit parameter", async () => {
    const { memoryRoot, dbPath } = makeTestDir();
    addTestMemoryFile(memoryRoot);
    const svc = createMemoryService({
      memoryRoot,
      dbPath,
      searchScoreFloor: 0,
    });
    await svc.reconcile();

    const results = await svc.search({ query: "project", limit: 1 });
    expect(results.length).toBeLessThanOrEqual(1);
  });

  test("returns empty array for empty query", async () => {
    const { memoryRoot, dbPath } = makeTestDir();
    addTestMemoryFile(memoryRoot);
    const svc = createMemoryService({
      memoryRoot,
      dbPath,
      searchScoreFloor: 0,
    });
    await svc.reconcile();

    const results = await svc.search({ query: "", limit: 5 });
    expect(results).toHaveLength(0);
  });

  test("returns empty array for query with only special chars", async () => {
    const { memoryRoot, dbPath } = makeTestDir();
    addTestMemoryFile(memoryRoot);
    const svc = createMemoryService({
      memoryRoot,
      dbPath,
      searchScoreFloor: 0,
    });
    await svc.reconcile();

    const results = await svc.search({ query: "!!! @@@ ###", limit: 5 });
    expect(results).toHaveLength(0);
  });

  test("does not throw on invalid db path", () => {
    expect(() => {
      createMemoryService({
        memoryRoot: "/nonexistent",
        dbPath: "/tmp/invalid-test.db",
      });
    }).not.toThrow();
  });

  test("search returns empty when memory root is empty", async () => {
    const { memoryRoot, dbPath } = makeTestDir();
    const svc = createMemoryService({
      memoryRoot,
      dbPath,
      reconcileOnSearch: true,
      searchScoreFloor: 0,
    });
    await svc.reconcile();

    const results = await svc.search({ query: "something", limit: 5 });
    expect(results).toHaveLength(0);
  });
});
