import { describe, expect, test } from "bun:test"
import { decide, type CompletionState } from "./decide"

const base: CompletionState = {
  autoContinues: 0,
  maxAutoContinues: 25,
  hasIncompleteTodos: false,
  changedFiles: [],
  currentFingerprint: "",
  reviewedFingerprint: null,
  criticVerdict: null,
  blockerFlagged: false,
  uiChanged: false,
  requireCritic: true,
}

describe("decide", () => {
  test("blocker flagged -> stop(blocked)", () => {
    expect(decide({ ...base, blockerFlagged: true })).toEqual({ kind: "stop", reason: "blocked" })
  })

  test("incomplete todos under cap -> continue", () => {
    expect(decide({ ...base, hasIncompleteTodos: true }).kind).toBe("continue")
  })

  test("incomplete todos at cap -> stop(cap)", () => {
    expect(decide({ ...base, hasIncompleteTodos: true, autoContinues: 25 })).toEqual({
      kind: "stop",
      reason: "cap",
    })
  })

  test("todos done, no changes -> stop(done)", () => {
    const a = decide({ ...base })
    expect(a.kind).toBe("stop")
    if (a.kind === "stop") expect(a.reason).toBe("done")
  })

  test("todos done, require_critic=false -> stop(done) even with changes", () => {
    expect(
      decide({ ...base, requireCritic: false, changedFiles: ["a.ts"], currentFingerprint: "x" }),
    ).toEqual({ kind: "stop", reason: "done" })
  })

  test("todos done, unreviewed changes -> review", () => {
    const a = decide({ ...base, changedFiles: ["a.ts"], currentFingerprint: "x" })
    expect(a.kind).toBe("review")
  })

  test("review forces vision when uiChanged", () => {
    const a = decide({
      ...base,
      changedFiles: ["a.svelte"],
      currentFingerprint: "x",
      uiChanged: true,
    })
    expect(a.kind).toBe("review")
    if (a.kind === "review") expect(a.prompt.toLowerCase()).toContain("browser")
  })

  test("critic approved current fingerprint -> stop(done)", () => {
    expect(
      decide({
        ...base,
        changedFiles: ["a.ts"],
        currentFingerprint: "x",
        criticVerdict: "approved",
        reviewedFingerprint: "x",
      }),
    ).toEqual({ kind: "stop", reason: "done" })
  })

  test("stale approval (fingerprint changed since review) -> review again", () => {
    expect(
      decide({
        ...base,
        changedFiles: ["a.ts", "b.ts"],
        currentFingerprint: "y",
        criticVerdict: "approved",
        reviewedFingerprint: "x",
      }).kind,
    ).toBe("review")
  })

  test("critic rejected current fingerprint -> continue (fix)", () => {
    expect(
      decide({
        ...base,
        changedFiles: ["a.ts"],
        currentFingerprint: "x",
        criticVerdict: "rejected",
        reviewedFingerprint: "x",
      }).kind,
    ).toBe("continue")
  })

  test("review path respects cap -> stop(cap)", () => {
    expect(
      decide({
        ...base,
        changedFiles: ["a.ts"],
        currentFingerprint: "x",
        autoContinues: 25,
      }),
    ).toEqual({ kind: "stop", reason: "cap" })
  })
})
