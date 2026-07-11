import { describe, expect, test, spyOn } from "bun:test";
import type { BobConfig } from "../types";
import { createSessionNotification } from "./session-notification";

function makeConfig(overrides: Partial<BobConfig> = {}): BobConfig {
  return {
    models: { bob: { model: "openai/gpt-5.5" } },
    ...overrides,
  };
}

describe("session-notification", () => {
  test("returns a hook set with an event handler", () => {
    const hookSet = createSessionNotification(makeConfig());
    expect(hookSet.event).toBeDefined();
    expect(typeof hookSet.event).toBe("function");
  });

  test("logs for session.idle events with sessionID", async () => {
    const hookSet = createSessionNotification(makeConfig());
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    try {
      await hookSet.event!({
        event: { type: "session.idle", properties: { sessionID: "ses_1" } },
      });
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy.mock.calls[0][0]).toContain("session.idle");
      expect(logSpy.mock.calls[0][0]).toContain("ses_1");
    } finally {
      logSpy.mockRestore();
    }
  });

  test("logs for session.question events with sessionID", async () => {
    const hookSet = createSessionNotification(makeConfig());
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    try {
      await hookSet.event!({
        event: { type: "session.question", properties: { sessionID: "ses_2" } },
      });
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy.mock.calls[0][0]).toContain("session.question");
      expect(logSpy.mock.calls[0][0]).toContain("ses_2");
    } finally {
      logSpy.mockRestore();
    }
  });

  test("does not log for unrelated event types", async () => {
    const hookSet = createSessionNotification(makeConfig());
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    try {
      await hookSet.event!({
        event: { type: "session.error", properties: { sessionID: "ses_3" } },
      });
      expect(logSpy).not.toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
    }
  });

  test("edge case: event is null/undefined → no throw, no log", async () => {
    const hookSet = createSessionNotification(makeConfig());
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    try {
      await hookSet.event!({ event: null });
      await hookSet.event!({ event: undefined });
      expect(logSpy).not.toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
    }
  });

  test("edge case: event without properties → logs with undefined sessionID", async () => {
    const hookSet = createSessionNotification(makeConfig());
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    try {
      await hookSet.event!({ event: { type: "session.idle" } });
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(logSpy.mock.calls[0][0]).toContain("(undefined)");
    } finally {
      logSpy.mockRestore();
    }
  });

  test("edge case: event is not an object → no throw", async () => {
    const hookSet = createSessionNotification(makeConfig());
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    try {
      await hookSet.event!({ event: "a string" });
      expect(logSpy).not.toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
    }
  });
});
