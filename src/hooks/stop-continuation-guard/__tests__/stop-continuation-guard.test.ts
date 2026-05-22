import { beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PluginInput } from "@opencode-ai/plugin";
import { createStopContinuationGuardHook } from "../hook";

const TEST_SESSION_DIR = mkdtempSync(join(tmpdir(), "hiai-test-"));

function createMockPluginInput(): PluginInput {
  return {
    directory: TEST_SESSION_DIR,
    client: {
      session: {
        messages: async () => [],
        summarize: async () => ({ summary: "" }),
      },
      tui: {
        showToast: async () => {},
      },
    },
  } as unknown as PluginInput;
}

describe("stop-continuation-guard", () => {
  let mockCtx: PluginInput;

  beforeEach(() => {
    mockCtx = createMockPluginInput();
  });

  describe("hook creation", () => {
    it("creates a valid StopContinuationGuard hook", () => {
      const guard = createStopContinuationGuardHook(mockCtx);
      expect(guard).toBeDefined();
      expect(typeof guard.stop).toBe("function");
      expect(typeof guard.isStopped).toBe("function");
      expect(typeof guard.clear).toBe("function");
      expect(typeof guard.event).toBe("function");
      expect(typeof guard["chat.message"]).toBe("function");
    });

    it("creates hook without background manager", () => {
      const guard = createStopContinuationGuardHook(mockCtx);
      expect(guard).toBeDefined();
    });

    it("creates hook with optional background manager", () => {
      const mockBackgroundManager = {
        getAllDescendantTasks: () => [],
        cancelTask: async () => true,
      };
      const guard = createStopContinuationGuardHook(mockCtx, {
        backgroundManager: mockBackgroundManager,
      });
      expect(guard).toBeDefined();
    });
  });

  describe("stop functionality", () => {
    it("markSessionAsStopped adds session to stopped set", () => {
      const guard = createStopContinuationGuardHook(mockCtx);
      const sessionID = "test-session-001";

      guard.stop(sessionID);

      expect(guard.isStopped(sessionID)).toBe(true);
    });

    it("isStopped returns false for never-stopped session", () => {
      const guard = createStopContinuationGuardHook(mockCtx);
      const sessionID = "test-session-002";

      expect(guard.isStopped(sessionID)).toBe(false);
    });

    it("multiple stop calls on same session are idempotent", () => {
      const guard = createStopContinuationGuardHook(mockCtx);
      const sessionID = "test-session-003";

      guard.stop(sessionID);
      guard.stop(sessionID);

      expect(guard.isStopped(sessionID)).toBe(true);
    });
  });

  describe("clear functionality", () => {
    it("clear removes session from stopped set", () => {
      const guard = createStopContinuationGuardHook(mockCtx);
      const sessionID = "test-session-004";

      guard.stop(sessionID);
      expect(guard.isStopped(sessionID)).toBe(true);

      guard.clear(sessionID);
      expect(guard.isStopped(sessionID)).toBe(false);
    });

    it("clear on never-stopped session does not throw", () => {
      const guard = createStopContinuationGuardHook(mockCtx);
      const sessionID = "test-session-005";

      expect(() => guard.clear(sessionID)).not.toThrow();
    });

    it("clear is idempotent", () => {
      const guard = createStopContinuationGuardHook(mockCtx);
      const sessionID = "test-session-006";

      guard.stop(sessionID);
      guard.clear(sessionID);
      expect(() => guard.clear(sessionID)).not.toThrow();
      expect(guard.isStopped(sessionID)).toBe(false);
    });
  });

  describe("event handler", () => {
    it("handles session.deleted event with id", async () => {
      const guard = createStopContinuationGuardHook(mockCtx);
      const sessionID = "test-session-007";

      guard.stop(sessionID);
      expect(guard.isStopped(sessionID)).toBe(true);

      await guard.event({
        event: {
          type: "session.deleted",
          properties: { info: { id: sessionID } },
        },
      });

      // After session.deleted, the session should be cleared from stop state
      expect(guard.isStopped(sessionID)).toBe(false);
    });

    it("ignores session.deleted without id", async () => {
      const guard = createStopContinuationGuardHook(mockCtx);
      const sessionID = "test-session-008";

      guard.stop(sessionID);

      // Event without id should not throw
      await guard.event({
        event: {
          type: "session.deleted",
          properties: {},
        },
      });

      // Session should still be stopped since no id was provided
      expect(guard.isStopped(sessionID)).toBe(true);
    });

    it("ignores other event types", async () => {
      const guard = createStopContinuationGuardHook(mockCtx);
      const sessionID = "test-session-009";

      guard.stop(sessionID);

      await guard.event({
        event: {
          type: "message.sent",
          properties: {},
        },
      });

      expect(guard.isStopped(sessionID)).toBe(true);
    });
  });

  describe("chat.message handler", () => {
    it("chat.message does not clear stop state on new message", async () => {
      const guard = createStopContinuationGuardHook(mockCtx);
      const sessionID = "test-session-010";

      guard.stop(sessionID);
      expect(guard.isStopped(sessionID)).toBe(true);

      // New chat message should NOT clear stop state
      await guard["chat.message"]({ sessionID });

      expect(guard.isStopped(sessionID)).toBe(true);
    });

    it("chat.message handles undefined sessionID", async () => {
      const guard = createStopContinuationGuardHook(mockCtx);

      // Should not throw
      await guard["chat.message"]({ sessionID: undefined });
    });
  });

  describe("multiple sessions", () => {
    it("manages multiple independent sessions", () => {
      const guard = createStopContinuationGuardHook(mockCtx);
      const sessionA = "session-a";
      const sessionB = "session-b";
      const sessionC = "session-c";

      guard.stop(sessionA);
      guard.stop(sessionB);

      expect(guard.isStopped(sessionA)).toBe(true);
      expect(guard.isStopped(sessionB)).toBe(true);
      expect(guard.isStopped(sessionC)).toBe(false);

      guard.clear(sessionA);
      expect(guard.isStopped(sessionA)).toBe(false);
      expect(guard.isStopped(sessionB)).toBe(true);
    });

    it("clearing one session does not affect others", () => {
      const guard = createStopContinuationGuardHook(mockCtx);
      const session1 = "multi-session-1";
      const session2 = "multi-session-2";

      guard.stop(session1);
      guard.stop(session2);
      guard.clear(session1);

      expect(guard.isStopped(session1)).toBe(false);
      expect(guard.isStopped(session2)).toBe(true);
    });
  });
});
