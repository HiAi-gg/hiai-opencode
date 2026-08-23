import { describe, expect, test } from "bun:test";
import { BlockingHookError } from "./errors";
import {
  createPlanLifecycleGate,
  setPlanLifecycleClient,
  taskSubagentType,
} from "./plan-lifecycle-gate";
import {
  clearPlanLifecycle,
  recordFrozenPlan,
  markExecuting,
  markImplementingWorkerCompleted,
} from "../features/plan-lifecycle";
import { setHasIncompleteTodos, clear as clearCompletion } from "../features/completion-controller/state";

function sid(label: string): string {
  return `gate-${label}-${crypto.randomUUID()}`;
}

function makeGate() {
  const hook = createPlanLifecycleGate({} as never);
  const before = hook["tool.execute.before"] as (
    input: { tool: string; sessionID?: string; args?: Record<string, unknown> },
    output: { args?: Record<string, unknown> },
  ) => Promise<void>;
  const after = hook["tool.execute.after"] as (
    input: { tool: string; sessionID?: string; args?: Record<string, unknown> },
    output: { output?: string; args?: Record<string, unknown> },
  ) => Promise<void>;
  return { before, after };
}

describe("plan-lifecycle-gate", () => {
  test("taskSubagentType reads subagent_type", () => {
    expect(taskSubagentType({ subagent_type: "plan" })).toBe("plan");
    expect(taskSubagentType({ agent: "critic" })).toBe("critic");
  });

  test("freezes when Plan returns Status: done", async () => {
    const sessionID = sid("freeze");
    const { after } = makeGate();
    await after(
      { tool: "task", sessionID, args: { subagent_type: "plan" } },
      {
        output:
          "**Status:** done\n# Plan\n**Evidence:** .bob/plans/feat.md\n",
      },
    );
    const { getPlanLifecycle } = await import("../features/plan-lifecycle");
    expect(getPlanLifecycle(sessionID).status).toBe("frozen");
    expect(getPlanLifecycle(sessionID).planPath).toBe(".bob/plans/feat.md");
    clearPlanLifecycle(sessionID);
  });

  test("blocks a second Plan spawn while frozen", async () => {
    const sessionID = sid("replan");
    recordFrozenPlan(sessionID, "p.md", "x");
    const { before } = makeGate();
    await expect(
      before(
        { tool: "task", sessionID },
        { args: { subagent_type: "plan" } },
      ),
    ).rejects.toBeInstanceOf(BlockingHookError);
    clearPlanLifecycle(sessionID);
  });

  test("allows Plan spawn with INVALIDATE_PLAN", async () => {
    const sessionID = sid("invalidate");
    recordFrozenPlan(sessionID, "p.md", "x");
    const { before } = makeGate();
    await before(
      { tool: "task", sessionID },
      {
        args: {
          subagent_type: "plan",
          prompt: "INVALIDATE_PLAN user changed scope",
        },
      },
    );
    clearPlanLifecycle(sessionID);
  });

  test("blocks Critic while waves are open", async () => {
    const sessionID = sid("early-critic");
    clearCompletion(sessionID);
    recordFrozenPlan(sessionID, "p.md", "x");
    markExecuting(sessionID);
    setHasIncompleteTodos(sessionID, true);
    const { before } = makeGate();
    await expect(
      before(
        { tool: "task", sessionID },
        { args: { subagent_type: "critic" } },
      ),
    ).rejects.toBeInstanceOf(BlockingHookError);
    clearPlanLifecycle(sessionID);
    clearCompletion(sessionID);
  });

  test("Manager phase-close critic does not mark the frozen plan done", async () => {
    const sessionID = sid("phase-critic");
    clearCompletion(sessionID);
    recordFrozenPlan(sessionID, "p.md", "x");
    markExecuting(sessionID);
    markImplementingWorkerCompleted(sessionID);
    setHasIncompleteTodos(sessionID, true);
    setPlanLifecycleClient({
      session: { get: async () => ({ data: { agent: "manager" } }) },
    } as never);
    try {
      const { before } = makeGate();
      await before(
        { tool: "task", sessionID },
        { args: { subagent_type: "critic" } },
      );
      const { getPlanLifecycle } = await import("../features/plan-lifecycle");
      expect(getPlanLifecycle(sessionID).status).toBe("executing");
    } finally {
      setPlanLifecycleClient(null);
      clearPlanLifecycle(sessionID);
      clearCompletion(sessionID);
    }
  });

  test("allows Critic after implementing worker and empty todos", async () => {
    const sessionID = sid("delivery-critic");
    clearCompletion(sessionID);
    recordFrozenPlan(sessionID, "p.md", "x");
    markExecuting(sessionID);
    markImplementingWorkerCompleted(sessionID);
    setHasIncompleteTodos(sessionID, false);
    const { before } = makeGate();
    await before(
      { tool: "task", sessionID },
      { args: { subagent_type: "critic" } },
    );
    clearPlanLifecycle(sessionID);
    clearCompletion(sessionID);
  });
});
