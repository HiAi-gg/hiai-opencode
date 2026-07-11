import { describe, expect, spyOn, test } from "bun:test";
import type { BobConfig } from "../types";
import { get, reset } from "./loop-state";
import { createSessionRecoveryHook } from "./session-recovery";

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

describe("session-recovery", () => {
  test("returns a hook set with an event handler", () => {
    const hookSet = createSessionRecoveryHook(makeConfig());
    expect(hookSet.event).toBeDefined();
    expect(typeof hookSet.event).toBe("function");
  });

  test("ignores non session.error events", async () => {
    const hookSet = createSessionRecoveryHook(makeConfig());
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    try {
      await hookSet.event!({ event: { type: "session.idle", properties: {} } });
      expect(logSpy).not.toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
    }
  });

  test("ignores session.error events without properties", async () => {
    const hookSet = createSessionRecoveryHook(makeConfig());
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    try {
      await hookSet.event!({ event: { type: "session.error" } });
      expect(logSpy).not.toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
    }
  });

  test("classifies and records a rate_limit error", async () => {
    const sid = "rec_rate_1";
    reset(sid);
    const hookSet = createSessionRecoveryHook(makeConfig());
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    try {
      await hookSet.event!(
        makeErrorEvent(sid, "HTTP 429 Too Many Requests") as never,
      );
      const state = get(sid);
      expect(state.lastErrorType).toBe("rate_limit");
      expect(state.lastError).toContain("429");
      expect(state.iterations).toBe(0);
      expect(logSpy.mock.calls[0][0]).toContain("type=rate_limit");
    } finally {
      logSpy.mockRestore();
      reset(sid);
    }
  });

  test("classifies an auth error and logs a key-check suggestion", async () => {
    const sid = "rec_auth_1";
    reset(sid);
    const hookSet = createSessionRecoveryHook(makeConfig());
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    try {
      await hookSet.event!(makeErrorEvent(sid, "401 Unauthorized") as never);
      expect(get(sid).lastErrorType).toBe("auth");
      const logs = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(logs).toContain("check API keys");
    } finally {
      logSpy.mockRestore();
      reset(sid);
    }
  });

  test("classifies a timeout error", async () => {
    const sid = "rec_timeout_1";
    reset(sid);
    const hookSet = createSessionRecoveryHook(makeConfig());
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    try {
      await hookSet.event!(makeErrorEvent(sid, "Request timed out") as never);
      expect(get(sid).lastErrorType).toBe("timeout");
    } finally {
      logSpy.mockRestore();
      reset(sid);
    }
  });

  test("classifies an empty_response error", async () => {
    const sid = "rec_empty_1";
    reset(sid);
    const hookSet = createSessionRecoveryHook(makeConfig());
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    try {
      await hookSet.event!(
        makeErrorEvent(sid, "empty response received") as never,
      );
      expect(get(sid).lastErrorType).toBe("empty_response");
    } finally {
      logSpy.mockRestore();
      reset(sid);
    }
  });

  test("classifies a server_error error", async () => {
    const sid = "rec_server_1";
    reset(sid);
    const hookSet = createSessionRecoveryHook(makeConfig());
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    try {
      await hookSet.event!(
        makeErrorEvent(sid, "500 Internal Server Error") as never,
      );
      expect(get(sid).lastErrorType).toBe("server_error");
    } finally {
      logSpy.mockRestore();
      reset(sid);
    }
  });

  test("classifies a context_window_exceeded error and logs compaction suggestion", async () => {
    const sid = "rec_ctx_1";
    reset(sid);
    const hookSet = createSessionRecoveryHook(makeConfig());
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    try {
      await hookSet.event!(
        makeErrorEvent(sid, "context_length_exceeded") as never,
      );
      expect(get(sid).lastErrorType).toBe("context_window_exceeded");
      const logs = logSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(logs).toContain("compacting session");
    } finally {
      logSpy.mockRestore();
      reset(sid);
    }
  });

  test("classifies an unknown error", async () => {
    const sid = "rec_unknown_1";
    reset(sid);
    const hookSet = createSessionRecoveryHook(makeConfig());
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    try {
      await hookSet.event!(
        makeErrorEvent(sid, "something totally weird") as never,
      );
      expect(get(sid).lastErrorType).toBe("unknown");
    } finally {
      logSpy.mockRestore();
      reset(sid);
    }
  });

  test("extracts error message from an error object with .message", async () => {
    const sid = "rec_objmsg_1";
    reset(sid);
    const hookSet = createSessionRecoveryHook(makeConfig());
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    try {
      await hookSet.event!(
        makeErrorEvent(sid, { message: "Rate limit reached" }) as never,
      );
      expect(get(sid).lastErrorType).toBe("rate_limit");
    } finally {
      logSpy.mockRestore();
      reset(sid);
    }
  });

  test("extracts error message from an error object with nested .data.message", async () => {
    const sid = "rec_datamsg_1";
    reset(sid);
    const hookSet = createSessionRecoveryHook(makeConfig());
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    try {
      await hookSet.event!(
        makeErrorEvent(sid, {
          data: { message: "context window exceeded" },
        }) as never,
      );
      expect(get(sid).lastErrorType).toBe("context_window_exceeded");
    } finally {
      logSpy.mockRestore();
      reset(sid);
    }
  });

  test('falls back to sessionID "unknown" when missing', async () => {
    const hookSet = createSessionRecoveryHook(makeConfig());
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    try {
      await hookSet.event!({
        event: { type: "session.error", properties: { error: "timeout" } },
      } as never);
      expect(logSpy.mock.calls[0][0]).toContain("unknown");
    } finally {
      logSpy.mockRestore();
    }
  });
});
