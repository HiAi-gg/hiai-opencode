import { describe, expect, test } from "bun:test";
import {
  clear as clearCompletion,
  setHasIncompleteTodos,
} from "../features/completion-controller/state";
import {
  clearPlanLifecycle,
  getPlanLifecycle,
  markExecuting,
  markImplementingWorkerCompleted,
  recordFrozenPlan,
} from "../features/plan-lifecycle";
import { BlockingHookError } from "./errors";
import {
  createPlanLifecycleGate,
  setPlanLifecycleClient,
  taskSubagentType,
} from "./plan-lifecycle-gate";

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
        output: "**Status:** done\n# Plan\n**Evidence:** .bob/plans/feat.md\n",
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
      before({ tool: "task", sessionID }, { args: { subagent_type: "plan" } }),
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
    expect(getPlanLifecycle(sessionID).status).toBe("executing");
    clearPlanLifecycle(sessionID);
    clearCompletion(sessionID);
  });

  test("marks plan done only after delivery Critic accepts", async () => {
    const sessionID = sid("critic-accept");
    clearCompletion(sessionID);
    recordFrozenPlan(sessionID, "p.md", "x");
    markExecuting(sessionID);
    markImplementingWorkerCompleted(sessionID);
    setHasIncompleteTodos(sessionID, false);
    const { before, after } = makeGate();
    const input = {
      tool: "task",
      sessionID,
      args: { subagent_type: "critic" },
    };
    await before(input, { args: input.args });
    await after(input, {
      output:
        '<CLOSURE>{"reasoning":"approved","evidence":[],"readiness":"accept"}</CLOSURE>',
    });
    expect(getPlanLifecycle(sessionID).status).toBe("done");
    clearPlanLifecycle(sessionID);
    clearCompletion(sessionID);
  });

  test("keeps plan executing when delivery Critic rejects", async () => {
    const sessionID = sid("critic-reject");
    clearCompletion(sessionID);
    recordFrozenPlan(sessionID, "p.md", "x");
    markExecuting(sessionID);
    markImplementingWorkerCompleted(sessionID);
    setHasIncompleteTodos(sessionID, false);
    const { before, after } = makeGate();
    const input = {
      tool: "task",
      sessionID,
      args: { subagent_type: "critic" },
    };
    await before(input, { args: input.args });
    await after(input, {
      output:
        '<CLOSURE>{"reasoning":"changes required","evidence":[],"readiness":"reject"}</CLOSURE>',
    });
    expect(getPlanLifecycle(sessionID).status).toBe("executing");
    clearPlanLifecycle(sessionID);
    clearCompletion(sessionID);
  });

  test("counts only successful implementation tasks", async () => {
    const blockedSession = sid("worker-blocked");
    recordFrozenPlan(blockedSession, "p.md", "x");
    const { after } = makeGate();
    await after(
      {
        tool: "task",
        sessionID: blockedSession,
        args: { subagent_type: "build" },
      },
      {
        output:
          '<CLOSURE>{"reasoning":"blocked","evidence":[],"readiness":"reject"}</CLOSURE>',
      },
    );
    expect(getPlanLifecycle(blockedSession).implementingWorkerCompleted).toBe(
      false,
    );

    const managerSession = sid("manager-done");
    recordFrozenPlan(managerSession, "p.md", "x");
    await after(
      {
        tool: "task",
        sessionID: managerSession,
        args: { subagent_type: "manager" },
      },
      {
        output:
          '<CLOSURE>{"reasoning":"phase complete","evidence":[],"readiness":"done"}</CLOSURE>',
      },
    );
    expect(getPlanLifecycle(managerSession).implementingWorkerCompleted).toBe(
      true,
    );
    clearPlanLifecycle(blockedSession);
    clearPlanLifecycle(managerSession);
  });
});
