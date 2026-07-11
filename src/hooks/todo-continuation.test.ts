import { afterEach, beforeEach, describe, expect, test, spyOn } from "bun:test";
import type { BobConfig } from "../types";
import { createTodoContinuationHook } from "./todo-continuation";
import { get, reset } from "./loop-state";

const config = {} as BobConfig;

describe("todo-continuation", () => {
  let logSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    logSpy = spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    reset("ses_test");
  });

  test("returns a hook set with an event hook defined", () => {
    const hookSet = createTodoContinuationHook(config);
    expect(hookSet.event).toBeDefined();
    expect(typeof hookSet.event).toBe("function");
  });

  test("happy path: session.idle with incomplete tasks logs continuation prompt", async () => {
    const hookSet = createTodoContinuationHook(config);
    await hookSet.event!({
      event: {
        type: "session.idle",
        properties: { sessionID: "ses_test", incompleteTodoCount: 2 },
      },
    });

    expect(logSpy).toHaveBeenCalled();
    const logLine = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logLine).toContain("has incomplete tasks");
    expect(get("ses_test").hasIncompleteTasks).toBe(true);
    expect(get("ses_test").continuationPrompt).toContain("incomplete task");
  });

  test("session.idle with zero incomplete tasks logs no-tasks message", async () => {
    const hookSet = createTodoContinuationHook(config);
    await hookSet.event!({
      event: {
        type: "session.idle",
        properties: { sessionID: "ses_test", incompleteTodoCount: 0 },
      },
    });

    expect(get("ses_test").hasIncompleteTasks).toBe(false);
    const logLine = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logLine).toContain("no incomplete tasks");
  });

  test("session.idle uses existing hasIncompleteTasks flag when no count provided", async () => {
    const hookSet = createTodoContinuationHook(config);
    // Pre-set the flag via loop-state
    get("ses_test").hasIncompleteTasks = true;
    await hookSet.event!({
      event: { type: "session.idle", properties: { sessionID: "ses_test" } },
    });

    const logLine = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logLine).toContain("has incomplete tasks");
  });

  test("session.idle when completed → no continuation log", async () => {
    const hookSet = createTodoContinuationHook(config);
    get("ses_test").isCompleted = true;
    get("ses_test").hasIncompleteTasks = true;
    await hookSet.event!({
      event: {
        type: "session.idle",
        properties: { sessionID: "ses_test", incompleteTodoCount: 3 },
      },
    });

    const logLine = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logLine).not.toContain("has incomplete tasks");
  });

  test("session.idle respects cooldown (rate-limit) after a recorded iteration", async () => {
    const hookSet = createTodoContinuationHook(config);
    get("ses_test").hasIncompleteTasks = true;
    get("ses_test").lastLoopTime = Date.now();
    await hookSet.event!({
      event: {
        type: "session.idle",
        properties: { sessionID: "ses_test", incompleteTodoCount: 1 },
      },
    });

    const logLine = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logLine).not.toContain("has incomplete tasks");
  });

  test("session.error logs the error string", async () => {
    const hookSet = createTodoContinuationHook(config);
    await hookSet.event!({
      event: {
        type: "session.error",
        properties: { sessionID: "ses_test", error: "rate_limit exceeded" },
      },
    });

    const logLine = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logLine).toContain("errored");
    expect(logLine).toContain("rate_limit exceeded");
  });

  test("session.error with no error property logs unknown error", async () => {
    const hookSet = createTodoContinuationHook(config);
    await hookSet.event!({
      event: { type: "session.error", properties: { sessionID: "ses_test" } },
    });

    const logLine = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logLine).toContain("unknown error");
  });

  test("session.deleted logs cleanup", async () => {
    const hookSet = createTodoContinuationHook(config);
    await hookSet.event!({
      event: { type: "session.deleted", properties: { sessionID: "ses_test" } },
    });

    const logLine = logSpy.mock.calls.map((c) => String(c[0])).join("\n");
    expect(logLine).toContain("deleted");
  });

  test("edge case: missing event type → no throw, no log", async () => {
    const hookSet = createTodoContinuationHook(config);
    await expect(
      hookSet.event!({ event: { properties: { sessionID: "ses_test" } } }),
    ).resolves.toBeUndefined();
    expect(logSpy).not.toHaveBeenCalled();
  });

  test("edge case: missing properties → no throw, no log", async () => {
    const hookSet = createTodoContinuationHook(config);
    await expect(
      hookSet.event!({ event: { type: "session.idle" } }),
    ).resolves.toBeUndefined();
    expect(logSpy).not.toHaveBeenCalled();
  });

  test("edge case: missing sessionID → no throw, no log", async () => {
    const hookSet = createTodoContinuationHook(config);
    await expect(
      hookSet.event!({ event: { type: "session.idle", properties: {} } }),
    ).resolves.toBeUndefined();
    expect(logSpy).not.toHaveBeenCalled();
  });

  test("edge case: null event → no throw", async () => {
    const hookSet = createTodoContinuationHook(config);
    await expect(hookSet.event!({ event: null })).resolves.toBeUndefined();
    expect(logSpy).not.toHaveBeenCalled();
  });
});
