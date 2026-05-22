import { afterEach, describe, expect, it } from "bun:test";
import {
  clearSession,
  isCompacting,
  markCompacting,
  markCompactionDone,
} from "../compaction-in-progress";

// Test the shared compaction-in-progress state module
describe("compaction-in-progress", () => {
  const sessionID = "test-session-123";

  afterEach(() => {
    // Clean up after each test
    clearSession(sessionID);
  });

  describe("isCompacting", () => {
    it("returns false when session is not compacting", () => {
      expect(isCompacting(sessionID)).toBe(false);
    });

    it("returns true after markCompacting is called", () => {
      markCompacting(sessionID);
      expect(isCompacting(sessionID)).toBe(true);
    });

    it("returns false after markCompactionDone is called", () => {
      markCompacting(sessionID);
      markCompactionDone(sessionID);
      expect(isCompacting(sessionID)).toBe(false);
    });
  });

  describe("markCompacting", () => {
    it("adds session to compaction set", () => {
      markCompacting(sessionID);
      expect(isCompacting(sessionID)).toBe(true);
    });

    it("is idempotent - calling twice does not cause issues", () => {
      markCompacting(sessionID);
      markCompacting(sessionID);
      expect(isCompacting(sessionID)).toBe(true);
    });
  });

  describe("markCompactionDone", () => {
    it("removes session from compaction set", () => {
      markCompacting(sessionID);
      markCompactionDone(sessionID);
      expect(isCompacting(sessionID)).toBe(false);
    });

    it("does not throw if session was not compacting", () => {
      expect(() => markCompactionDone(sessionID)).not.toThrow();
    });
  });

  describe("clearSession", () => {
    it("removes session from compaction set", () => {
      markCompacting(sessionID);
      clearSession(sessionID);
      expect(isCompacting(sessionID)).toBe(false);
    });

    it("does not throw if session was not compacting", () => {
      expect(() => clearSession(sessionID)).not.toThrow();
    });
  });
});
