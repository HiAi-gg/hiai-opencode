import { describe, expect, test } from "bun:test";
import type { BobConfig } from "../types";
import { get } from "./loop-state";
import { createStopContinuationGuard } from "./stop-continuation-guard";
import { logger } from "../util/log";

const config = {} as BobConfig;

describe("stop-continuation-guard", () => {
  test("returns a hook set with event and dispose", () => {
    const hook = createStopContinuationGuard(config);
    expect(typeof hook.event).toBe("function");
    expect(typeof hook.dispose).toBe("function");
  });

  test("ignores non-stop events", async () => {
    const hook = createStopContinuationGuard(config) as any;
    const fn = hook.event as (input: { event: unknown }) => Promise<void>;
    await expect(
      fn({ event: { type: "session.idle" } }),
    ).resolves.toBeUndefined();
  });

  test("resets loop state on user.message", async () => {
    const hook = createStopContinuationGuard(config) as any;
    const fn = hook.event as (input: { event: unknown }) => Promise<void>;
    const sid = "stop-test-1";

    // Set up some state
    const state = get(sid);
    state.iterations = 5;

    await fn({
      event: {
        type: "user.message",
        properties: { sessionID: sid },
      },
    });

    // After user.message, state should be reset
    const freshState = get(sid);
    expect(freshState.iterations).toBe(0);
  });

  test("resets loop state on session.error", async () => {
    const hook = createStopContinuationGuard(config) as any;
    const fn = hook.event as (input: { event: unknown }) => Promise<void>;
    const sid = "stop-test-2";

    get(sid).iterations = 3;

    await fn({
      event: {
        type: "session.error",
        properties: { sessionID: sid },
      },
    });

    expect(get(sid).iterations).toBe(0);
  });

  test("resets loop state on session.deleted", async () => {
    const hook = createStopContinuationGuard(config) as any;
    const fn = hook.event as (input: { event: unknown }) => Promise<void>;
    const sid = "stop-test-3";

    get(sid).iterations = 7;

    await fn({
      event: {
        type: "session.deleted",
        properties: { sessionID: sid },
      },
    });

    expect(get(sid).iterations).toBe(0);
  });

  test("logs on session.stop with session ID", async () => {
    const hook = createStopContinuationGuard(config) as any;
    const fn = hook.event as (input: { event: unknown }) => Promise<void>;

    const logs: string[] = [];
    const origLog = console.log;
    logger.log = (msg: string) => logs.push(msg);

    try {
      await fn({
        event: {
          type: "session.stop",
          properties: { sessionID: "s-stop-test" },
        },
      });
      expect(logs.some((l) => l.includes("Stop-guard"))).toBe(true);
      expect(logs.some((l) => l.includes("s-stop-test"))).toBe(true);
    } finally {
      logger.log = origLog;
    }
  });

  test("debounces same sessionID within 5 seconds", async () => {
    const hook = createStopContinuationGuard(config) as any;
    const fn = hook.event as (input: { event: unknown }) => Promise<void>;
    const sid = "stop-test-debounce";

    get(sid).iterations = 5;
    await fn({
      event: { type: "user.message", properties: { sessionID: sid } },
    });

    // After first reset, set iterations again
    get(sid).iterations = 10;

    // Second call should be debounced and NOT reset
    await fn({
      event: { type: "session.error", properties: { sessionID: sid } },
    });

    // Should still be 10 because the second reset was debounced
    expect(get(sid).iterations).toBe(10);
  });

  test("dispose clears debounce set", async () => {
    const hook = createStopContinuationGuard(config) as any;
    const fn = hook.event as (input: { event: unknown }) => Promise<void>;
    const sid = "stop-test-dispose";

    // First call adds to debounce set
    await fn({
      event: { type: "user.message", properties: { sessionID: sid } },
    });

    // Dispose clears the set
    await hook.dispose();

    get(sid).iterations = 3;
    await fn({
      event: { type: "user.message", properties: { sessionID: sid } },
    });

    // After dispose + re-call, should have reset again
    expect(get(sid).iterations).toBe(0);
  });
});
