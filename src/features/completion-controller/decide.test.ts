import { describe, expect, test } from "bun:test";
import { type CompletionState, decide } from "./decide";

const base: CompletionState = {
  autoContinues: 0,
  maxAutoContinues: 25,
  hasIncompleteTodos: false,
  changedFiles: [],
  changeRevision: 0,
  reviewedRevision: null,
  criticVerdict: null,
  blockerFlagged: false,
  uiChanged: false,
  requireCritic: true,
  qualityGateFailed: false,
  lspPending: false,
};

describe("decide", () => {
  test("blocker flagged -> stop(blocked)", () => {
    expect(decide({ ...base, blockerFlagged: true })).toEqual({
      kind: "stop",
      reason: "blocked",
    });
  });

  test("incomplete todos under cap -> continue", () => {
    expect(decide({ ...base, hasIncompleteTodos: true }).kind).toBe("continue");
  });

  test("incomplete todos at cap -> stop(cap)", () => {
    expect(
      decide({ ...base, hasIncompleteTodos: true, autoContinues: 25 }),
    ).toEqual({
      kind: "stop",
      reason: "cap",
    });
  });

  test("todos done, no changes -> stop(done)", () => {
    const a = decide({ ...base });
    expect(a.kind).toBe("stop");
    if (a.kind === "stop") expect(a.reason).toBe("done");
  });

  test("todos done, require_critic=false -> stop(done) even with changes", () => {
    expect(
      decide({
        ...base,
        requireCritic: false,
        changedFiles: ["a.ts"],
        changeRevision: 1,
      }),
    ).toEqual({ kind: "stop", reason: "done" });
  });

  test("todos done, unreviewed changes -> review", () => {
    const a = decide({
      ...base,
      changedFiles: ["a.ts"],
      changeRevision: 1,
    });
    expect(a.kind).toBe("review");
  });

  test("review forces vision when uiChanged", () => {
    const a = decide({
      ...base,
      changedFiles: ["a.svelte"],
      changeRevision: 1,
      uiChanged: true,
    });
    expect(a.kind).toBe("review");
    if (a.kind === "review")
      expect(a.prompt.toLowerCase()).toContain("browser");
  });

  test("critic approved current revision -> stop(done)", () => {
    expect(
      decide({
        ...base,
        changedFiles: ["a.ts"],
        changeRevision: 1,
        criticVerdict: "approved",
        reviewedRevision: 1,
      }),
    ).toEqual({ kind: "stop", reason: "done" });
  });

  test("stale approval (revision changed since review) -> review again", () => {
    expect(
      decide({
        ...base,
        changedFiles: ["a.ts", "b.ts"],
        changeRevision: 2,
        criticVerdict: "approved",
        reviewedRevision: 1,
      }).kind,
    ).toBe("review");
  });

  test("critic rejected current revision -> continue (fix)", () => {
    expect(
      decide({
        ...base,
        changedFiles: ["a.ts"],
        changeRevision: 1,
        criticVerdict: "rejected",
        reviewedRevision: 1,
      }).kind,
    ).toBe("continue");
  });

  test("review path respects cap -> stop(cap)", () => {
    expect(
      decide({
        ...base,
        changedFiles: ["a.ts"],
        changeRevision: 1,
        autoContinues: 25,
      }),
    ).toEqual({ kind: "stop", reason: "cap" });
  });

  test("quality gate failed -> continue (fix quality)", () => {
    const a = decide({
      ...base,
      changedFiles: ["a.ts"],
      changeRevision: 1,
      qualityGateFailed: true,
    });
    expect(a.kind).toBe("continue");
    if (a.kind === "continue")
      expect(a.prompt.toLowerCase()).toContain("quality");
  });

  test("quality gate failed at cap -> stop(cap)", () => {
    expect(
      decide({
        ...base,
        changedFiles: ["a.ts"],
        changeRevision: 1,
        qualityGateFailed: true,
        autoContinues: 25,
      }),
    ).toEqual({ kind: "stop", reason: "cap" });
  });

  test("lsp pending after edit -> continue (run lsp_diagnostics)", () => {
    const a = decide({
      ...base,
      changedFiles: ["a.ts"],
      changeRevision: 1,
      lspPending: true,
    });
    expect(a.kind).toBe("continue");
    if (a.kind === "continue") expect(a.prompt.toLowerCase()).toContain("lsp");
  });

  test("frozen plan on a non-executor (Plan mode) -> stop(blocked)", () => {
    expect(
      decide({
        ...base,
        hasIncompleteTodos: true,
        planStatus: "frozen",
        waveExecutor: false,
      }),
    ).toEqual({ kind: "stop", reason: "blocked" });
  });

  test("frozen plan with unreviewed changes -> continue (finish waves), not review", () => {
    const a = decide({
      ...base,
      changedFiles: ["a.ts"],
      changeRevision: 1,
      planStatus: "executing",
    });
    expect(a.kind).toBe("continue");
    if (a.kind === "continue")
      expect(a.prompt.toLowerCase()).toContain("frozen plan");
  });

  test("plan done with unreviewed changes -> review", () => {
    expect(
      decide({
        ...base,
        changedFiles: ["a.ts"],
        changeRevision: 1,
        planStatus: "done",
      }).kind,
    ).toBe("review");
  });

  test("lsp pending at cap -> stop(cap)", () => {
    expect(
      decide({
        ...base,
        changedFiles: ["a.ts"],
        changeRevision: 1,
        lspPending: true,
        autoContinues: 25,
      }),
    ).toEqual({ kind: "stop", reason: "cap" });
  });
});
