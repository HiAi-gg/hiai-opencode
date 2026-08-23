import { describe, expect, test } from "bun:test";
import {
  canSpawnCritic,
  canSpawnPlan,
  checksumText,
  getPlanLifecycle,
  invalidatePlan,
  isImplementingWorker,
  markExecuting,
  markImplementingWorkerCompleted,
  markPlanDone,
  promptRequestsInvalidate,
  recordFrozenPlan,
} from "./index";

function sid(): string {
  return `plan-lifecycle-${crypto.randomUUID()}`;
}

describe("plan-lifecycle", () => {
  test("starts at none and freezes on recordFrozenPlan", () => {
    const sessionID = sid();
    expect(getPlanLifecycle(sessionID).status).toBe("none");
    recordFrozenPlan(sessionID, ".bob/plans/x.md", "abc");
    const s = getPlanLifecycle(sessionID);
    expect(s.status).toBe("frozen");
    expect(s.planPath).toBe(".bob/plans/x.md");
  });

  test("denies plan spawn while frozen unless INVALIDATE_PLAN", () => {
    const sessionID = sid();
    recordFrozenPlan(sessionID, "p.md", "1");
    expect(canSpawnPlan(sessionID).allow).toBe(false);
    expect(canSpawnPlan(sessionID, { invalidate: true }).allow).toBe(true);
    markExecuting(sessionID);
    expect(canSpawnPlan(sessionID).allow).toBe(false);
  });

  test("allows plan spawn when none/done/invalidated", () => {
    const sessionID = sid();
    expect(canSpawnPlan(sessionID).allow).toBe(true);
    recordFrozenPlan(sessionID, "p.md", "1");
    markPlanDone(sessionID);
    expect(canSpawnPlan(sessionID).allow).toBe(true);
    invalidatePlan(sessionID);
    expect(canSpawnPlan(sessionID).allow).toBe(true);
  });

  test("denies critic until implementing worker finished and todos complete", () => {
    const sessionID = sid();
    recordFrozenPlan(sessionID, "p.md", "1");
    markExecuting(sessionID);
    expect(canSpawnCritic(sessionID, { hasIncompleteTodos: true }).allow).toBe(
      false,
    );
    expect(canSpawnCritic(sessionID, { hasIncompleteTodos: false }).allow).toBe(
      false,
    );
    markImplementingWorkerCompleted(sessionID);
    expect(canSpawnCritic(sessionID, { hasIncompleteTodos: true }).allow).toBe(
      false,
    );
    expect(canSpawnCritic(sessionID, { hasIncompleteTodos: false }).allow).toBe(
      true,
    );
  });

  test("manager phase-close critic allowed after workers; does not require empty todos", () => {
    const sessionID = sid();
    recordFrozenPlan(sessionID, "p.md", "1");
    markExecuting(sessionID);
    markImplementingWorkerCompleted(sessionID);
    expect(
      canSpawnCritic(sessionID, {
        hasIncompleteTodos: true,
        caller: "manager",
      }).allow,
    ).toBe(true);
    expect(getPlanLifecycle(sessionID).status).toBe("executing");
  });

  test("manager critic denied until phase workers finished", () => {
    const sessionID = sid();
    expect(
      canSpawnCritic(sessionID, {
        hasIncompleteTodos: false,
        caller: "manager",
      }).allow,
    ).toBe(false);
  });

  test("allows critic when no frozen plan", () => {
    const sessionID = sid();
    expect(canSpawnCritic(sessionID, { hasIncompleteTodos: false }).allow).toBe(
      true,
    );
  });

  test("isImplementingWorker and invalidate token helpers", () => {
    expect(isImplementingWorker("build")).toBe(true);
    expect(isImplementingWorker("manager")).toBe(true);
    expect(isImplementingWorker("explore")).toBe(false);
    expect(promptRequestsInvalidate("please INVALIDATE_PLAN now")).toBe(true);
    expect(promptRequestsInvalidate("just plan")).toBe(false);
    expect(checksumText("abc")).toBe(checksumText("abc"));
    expect(checksumText("abc")).not.toBe(checksumText("abd"));
  });
});
