import { describe, expect, spyOn, test } from "bun:test";
import type { BobConfig } from "../types";
import { createContextWindowLimitRecoveryHook } from "./context-window-limit-recovery";
import { get, markError, reset } from "./loop-state";
import { logger } from "../util/log";

function makeConfig(overrides: Partial<BobConfig> = {}): BobConfig {
  return {
    models: { bob: { model: "openai/gpt-5.5" } },
    ...overrides,
  };
}

function makeErrorEvent(sessionID: string, error: unknown) {
  return {
    event: {
      type: "session.error",
      properties: { sessionID, error },
    },
  };
}

describe("context-window-limit-recovery", () => {
  test("returns a hook set with event and compacting handlers", () => {
    const hookSet = createContextWindowLimitRecoveryHook(makeConfig());
    expect(hookSet.event).toBeDefined();
    expect(typeof hookSet.event).toBe("function");
    expect(hookSet["experimental.session.compacting"]).toBeDefined();
    expect(typeof hookSet["experimental.session.compacting"]).toBe("function");
  });

  test("ignores non session.error events", async () => {
    const hookSet = createContextWindowLimitRecoveryHook(makeConfig());
    const logSpy = spyOn(logger, "log").mockImplementation(() => {});
    try {
      await hookSet.event!({ event: { type: "session.idle", properties: {} } });
      expect(logSpy).not.toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
    }
  });

  test("ignores events without a type field", async () => {
    const hookSet = createContextWindowLimitRecoveryHook(makeConfig());
    const logSpy = spyOn(logger, "log").mockImplementation(() => {});
    try {
      await hookSet.event!({ event: { foo: "bar" } });
      expect(logSpy).not.toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
    }
  });

  test("ignores non-context-window errors", async () => {
    const sid = "cwl_nonctx_1";
    reset(sid);
    const hookSet = createContextWindowLimitRecoveryHook(makeConfig());
    const logSpy = spyOn(logger, "log").mockImplementation(() => {});
    try {
      await hookSet.event!(makeErrorEvent(sid, "rate_limit exceeded") as never);
      expect(logSpy).not.toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
      reset(sid);
    }
  });

  test("detects context_length_exceeded and resets loop state", async () => {
    const sid = "cwl_ctx_1";
    // Pre-populate state so we can verify reset() clears it.
    markError(sid, "old error", "auth");
    const hookSet = createContextWindowLimitRecoveryHook(makeConfig());
    const logSpy = spyOn(logger, "log").mockImplementation(() => {});
    try {
      await hookSet.event!(
        makeErrorEvent(sid, "context_length_exceeded") as never,
      );
      const state = get(sid);
      // reset() deletes the session, so get() returns a fresh default state.
      expect(state.lastError).toBeNull();
      expect(state.lastErrorType).toBeNull();
      const logs = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(logs).toContain("exceeded context limit");
      expect(logs).toContain("compaction context injected");
    } finally {
      logSpy.mockRestore();
      reset(sid);
    }
  });

  test('detects "max_tokens" pattern', async () => {
    const sid = "cwl_maxtok_1";
    reset(sid);
    const hookSet = createContextWindowLimitRecoveryHook(makeConfig());
    const logSpy = spyOn(logger, "log").mockImplementation(() => {});
    try {
      await hookSet.event!(makeErrorEvent(sid, "max_tokens exceeded") as never);
      expect(logSpy).toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
      reset(sid);
    }
  });

  test('detects "token limit" pattern', async () => {
    const sid = "cwl_toklim_1";
    reset(sid);
    const hookSet = createContextWindowLimitRecoveryHook(makeConfig());
    const logSpy = spyOn(logger, "log").mockImplementation(() => {});
    try {
      await hookSet.event!(makeErrorEvent(sid, "token limit reached") as never);
      expect(logSpy).toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
      reset(sid);
    }
  });

  test('detects "context window" pattern', async () => {
    const sid = "cwl_ctxwin_1";
    reset(sid);
    const hookSet = createContextWindowLimitRecoveryHook(makeConfig());
    const logSpy = spyOn(logger, "log").mockImplementation(() => {});
    try {
      await hookSet.event!(
        makeErrorEvent(sid, "context window is full") as never,
      );
      expect(logSpy).toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
      reset(sid);
    }
  });

  test('detects "too long" pattern', async () => {
    const sid = "cwl_toolong_1";
    reset(sid);
    const hookSet = createContextWindowLimitRecoveryHook(makeConfig());
    const logSpy = spyOn(logger, "log").mockImplementation(() => {});
    try {
      await hookSet.event!(makeErrorEvent(sid, "prompt is too long") as never);
      expect(logSpy).toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
      reset(sid);
    }
  });

  test("compacting handler injects a hint when context exists", async () => {
    const hookSet = createContextWindowLimitRecoveryHook(makeConfig());
    const output = { context: ["existing instruction"] };
    await hookSet["experimental.session.compacting"]!(
      {} as Parameters<
        NonNullable<(typeof hookSet)["experimental.session.compacting"]>
      >[0],
      output as Parameters<
        NonNullable<(typeof hookSet)["experimental.session.compacting"]>
      >[1],
    );
    expect(output.context).toHaveLength(2);
    expect(output.context[1]).toContain("context limit error");
    expect(output.context[1]).toContain("summarization");
  });

  test("compacting handler is a no-op when context is missing", async () => {
    const hookSet = createContextWindowLimitRecoveryHook(makeConfig());
    const output = {} as Parameters<
      NonNullable<(typeof hookSet)["experimental.session.compacting"]>
    >[1];
    await hookSet["experimental.session.compacting"]!(
      {} as Parameters<
        NonNullable<(typeof hookSet)["experimental.session.compacting"]>
      >[0],
      output,
    );
    expect(output.context).toBeUndefined();
  });
});
