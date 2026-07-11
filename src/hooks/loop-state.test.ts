import { describe, expect, test } from "bun:test";
import {
  get,
  reset,
  markCompleted,
  markError,
  setContinuationPrompt,
  recordIteration,
  setHasIncompleteTasks,
  markContinuationInjected,
  shouldContinue,
} from "./loop-state";

describe("loop-state (stateful)", () => {
  test("get returns a fresh default state for an unknown session", () => {
    const sid = "ls_get_1";
    reset(sid);
    const s = get(sid);
    expect(s.iterations).toBe(0);
    expect(s.maxIterations).toBe(10);
    expect(s.cooldownMs).toBe(10_000);
    expect(s.isCompleted).toBe(false);
    expect(s.hasIncompleteTasks).toBe(false);
    expect(s.lastError).toBeNull();
    expect(s.lastErrorType).toBeNull();
    expect(s.continuationPrompt).toBeNull();
    expect(s.continuationInjected).toBe(false);
  });

  test("get is cached and idempotent for the same session", () => {
    const sid = "ls_get_2";
    reset(sid);
    const a = get(sid);
    const b = get(sid);
    expect(a).toBe(b);
  });

  test("reset deletes session state", () => {
    const sid = "ls_reset_1";
    get(sid); // create
    reset(sid);
    const fresh = get(sid);
    expect(fresh.iterations).toBe(0);
    expect(fresh.lastError).toBeNull();
  });

  test("markCompleted sets isCompleted and updates lastLoopTime", () => {
    const sid = "ls_completed_1";
    reset(sid);
    markCompleted(sid);
    const s = get(sid);
    expect(s.isCompleted).toBe(true);
    expect(s.lastLoopTime).toBeGreaterThan(0);
  });

  test("markError records error, type, and resets iterations", () => {
    const sid = "ls_error_1";
    reset(sid);
    recordIteration(sid);
    recordIteration(sid);
    expect(get(sid).iterations).toBe(2);
    markError(sid, "boom: rate_limit", "rate_limit");
    const s = get(sid);
    expect(s.lastError).toContain("rate_limit");
    expect(s.lastErrorType).toBe("rate_limit");
    expect(s.iterations).toBe(0);
  });

  test("setContinuationPrompt sets prompt and clears injected flag", () => {
    const sid = "ls_cont_1";
    reset(sid);
    markContinuationInjected(sid);
    setContinuationPrompt(sid, "keep going");
    const s = get(sid);
    expect(s.continuationPrompt).toBe("keep going");
    expect(s.continuationInjected).toBe(false);
  });

  test("recordIteration increments iterations and updates lastLoopTime", () => {
    const sid = "ls_iter_1";
    reset(sid);
    recordIteration(sid);
    recordIteration(sid);
    const s = get(sid);
    expect(s.iterations).toBe(2);
    expect(s.lastLoopTime).toBeGreaterThan(0);
  });

  test("setHasIncompleteTasks toggles the flag", () => {
    const sid = "ls_incomplete_1";
    reset(sid);
    setHasIncompleteTasks(sid, true);
    expect(get(sid).hasIncompleteTasks).toBe(true);
    setHasIncompleteTasks(sid, false);
    expect(get(sid).hasIncompleteTasks).toBe(false);
  });

  test("markContinuationInjected sets the flag", () => {
    const sid = "ls_injected_1";
    reset(sid);
    markContinuationInjected(sid);
    expect(get(sid).continuationInjected).toBe(true);
  });

  test("shouldContinue is true for a fresh session", () => {
    const sid = "ls_cont_true_1";
    reset(sid);
    expect(shouldContinue(sid)).toBe(true);
  });

  test("shouldContinue is false once completed", () => {
    const sid = "ls_cont_done_1";
    reset(sid);
    markCompleted(sid);
    expect(shouldContinue(sid)).toBe(false);
  });

  test("shouldContinue is false once maxIterations reached", () => {
    const sid = "ls_cont_max_1";
    reset(sid);
    for (let i = 0; i < 10; i++) recordIteration(sid);
    expect(get(sid).iterations).toBe(10);
    expect(shouldContinue(sid)).toBe(false);
  });

  test("shouldContinue is false during cooldown", () => {
    const sid = "ls_cont_cool_1";
    reset(sid);
    recordIteration(sid); // sets lastLoopTime = now, iterations = 1
    expect(get(sid).iterations).toBeLessThan(10);
    expect(shouldContinue(sid)).toBe(false);
  });

  test("shouldContinue is true when cooldown has elapsed", () => {
    const sid = "ls_cont_cool_2";
    reset(sid);
    const s = get(sid);
    s.lastLoopTime = 0; // simulate an old cycle
    expect(shouldContinue(sid)).toBe(true);
  });
});
