import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  canSpawnCritic,
  canSpawnPlan,
  clearPlanLifecycle,
  getPlanLifecycle,
  markExecuting,
  markImplementingWorkerCompleted,
  recordFrozenPlan,
  setPlansRoot,
  setPlanTodos,
} from "./index";

describe("plan-lifecycle persist", () => {
  afterEach(() => {
    setPlansRoot(null);
  });

  test("same session hydrates after memory clear; other session is not blocked", () => {
    const root = mkdtempSync(join(tmpdir(), "hiai-plan-"));
    setPlansRoot(root);
    const planRel = ".bob/plans/feat.md";
    const abs = join(root, planRel);
    mkdirSync(join(root, ".bob", "plans"), { recursive: true });
    writeFileSync(abs, "# Plan: feat\n", "utf-8");

    recordFrozenPlan("sess-a", planRel, "deadbeef");
    setPlanTodos("sess-a", [
      { id: "p1", content: "Phase 1", status: "in_progress" },
    ]);
    expect(getPlanLifecycle("sess-a").status).toBe("frozen");

    clearPlanLifecycle("sess-a");
    const restored = getPlanLifecycle("sess-a");
    expect(restored.status).toBe("frozen");
    expect(restored.planPath).toBe(planRel);
    expect(restored.todos[0]?.id).toBe("p1");
    expect(canSpawnPlan("sess-a").allow).toBe(false);

    clearPlanLifecycle("sess-b");
    expect(getPlanLifecycle("sess-b").status).toBe("none");
    expect(canSpawnPlan("sess-b").allow).toBe(true);

    const md = readFileSync(abs, "utf-8");
    expect(md).toContain("status: frozen");
    expect(md).toContain("planId: feat");
    expect(md).toContain("checksum: deadbeef");
  });

  test("implementing worker completion survives hydration", () => {
    const root = mkdtempSync(join(tmpdir(), "hiai-plan-worker-"));
    setPlansRoot(root);
    recordFrozenPlan("sess-worker", ".bob/plans/worker.md", "abc");
    markExecuting("sess-worker");
    markImplementingWorkerCompleted("sess-worker");

    clearPlanLifecycle("sess-worker");
    const restored = getPlanLifecycle("sess-worker");
    expect(restored.implementingWorkerCompleted).toBe(true);
    expect(
      canSpawnCritic("sess-worker", { hasIncompleteTodos: false }).allow,
    ).toBe(true);
  });
});
