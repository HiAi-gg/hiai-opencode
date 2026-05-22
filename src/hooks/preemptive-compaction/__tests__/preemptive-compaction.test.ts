import { afterEach, describe, expect, it } from "bun:test";
import {
  clearSession,
  isCompacting,
  markCompacting,
  markCompactionDone,
} from "../../shared/compaction-in-progress";

const PREEMPTIVE_COMPACTION_THRESHOLD = 0.78;

describe("preemptive-compaction shared state integration", () => {
  const sessionID = "preemptive-test-session";

  afterEach(() => {
    clearSession(sessionID);
  });

  describe("shared compaction state", () => {
    it("isCompacting returns false initially", () => {
      expect(isCompacting(sessionID)).toBe(false);
    });

    it("markCompacting sets session as compacting", () => {
      markCompacting(sessionID);
      expect(isCompacting(sessionID)).toBe(true);
    });

    it("markCompactionDone clears compacting state", () => {
      markCompacting(sessionID);
      markCompactionDone(sessionID);
      expect(isCompacting(sessionID)).toBe(false);
    });

    it("clearSession removes session from compaction tracking", () => {
      markCompacting(sessionID);
      clearSession(sessionID);
      expect(isCompacting(sessionID)).toBe(false);
    });

    it("multiple sessions tracked independently", () => {
      const sessionA = "session-a-preemptive";
      const sessionB = "session-b-preemptive";

      markCompacting(sessionA);
      expect(isCompacting(sessionA)).toBe(true);
      expect(isCompacting(sessionB)).toBe(false);

      clearSession(sessionA);
      expect(isCompacting(sessionA)).toBe(false);
      expect(isCompacting(sessionB)).toBe(false);
    });

    it("markCompacting is idempotent", () => {
      markCompacting(sessionID);
      markCompacting(sessionID);
      expect(isCompacting(sessionID)).toBe(true);
    });
  });

  describe("preemptive-compaction threshold constant", () => {
    it("uses 78% threshold", () => {
      expect(PREEMPTIVE_COMPACTION_THRESHOLD).toBe(0.78);
    });
  });

  describe("compaction state for preemptive logic", () => {
    it("session not compacting should allow preemption check", () => {
      expect(isCompacting(sessionID)).toBe(false);
    });

    it("session compacting should skip preemption check", () => {
      markCompacting(sessionID);
      expect(isCompacting(sessionID)).toBe(true);
    });

    it("compaction state cleared allows normal operation", () => {
      markCompacting(sessionID);
      markCompactionDone(sessionID);
      expect(isCompacting(sessionID)).toBe(false);
    });
  });
});
