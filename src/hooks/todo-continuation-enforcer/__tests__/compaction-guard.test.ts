import { describe, expect, it } from "bun:test";
import {
  acknowledgeCompactionGuard,
  armCompactionGuard,
  isCompactionGuardActive,
} from "../compaction-guard";
import { COMPACTION_GUARD_MS } from "../constants";
import type { SessionState } from "../types";

function createMockSessionState(): SessionState {
  return {
    stagnationCount: 0,
    consecutiveFailures: 0,
    awaitingPostInjectionProgressCheck: false,
  };
}

describe("compaction-guard", () => {
  describe("COMPACTION_GUARD_MS constant", () => {
    it("is set to 60000ms (60 seconds)", () => {
      expect(COMPACTION_GUARD_MS).toBe(60_000);
    });
  });

  describe("armCompactionGuard", () => {
    it("sets recentCompactionAt and recentCompactionEpoch", () => {
      const state = createMockSessionState();
      const now = Date.now();

      const epoch = armCompactionGuard(state, now);

      expect(state.recentCompactionAt).toBe(now);
      expect(state.recentCompactionEpoch).toBe(epoch);
      expect(epoch).toBe(1);
    });

    it("increments epoch each time", () => {
      const state = createMockSessionState();
      const now = Date.now();

      const epoch1 = armCompactionGuard(state, now);
      const epoch2 = armCompactionGuard(state, now + 1);

      expect(epoch2).toBe(epoch1 + 1);
    });
  });

  describe("acknowledgeCompactionGuard", () => {
    it("returns false when compactionEpoch is undefined", () => {
      const state = createMockSessionState();

      const result = acknowledgeCompactionGuard(state, undefined);

      expect(result).toBe(false);
    });

    it("returns false when epoch does not match", () => {
      const state = createMockSessionState();
      state.recentCompactionEpoch = 2;

      const result = acknowledgeCompactionGuard(state, 1);

      expect(result).toBe(false);
    });

    it("returns true and sets acknowledgedCompactionEpoch when epoch matches", () => {
      const state = createMockSessionState();
      state.recentCompactionEpoch = 3;

      const result = acknowledgeCompactionGuard(state, 3);

      expect(result).toBe(true);
      expect(state.acknowledgedCompactionEpoch).toBe(3);
    });
  });

  describe("isCompactionGuardActive", () => {
    it("returns false when recentCompactionAt is undefined", () => {
      const state = createMockSessionState();
      state.recentCompactionAt = undefined;
      state.recentCompactionEpoch = undefined;

      const result = isCompactionGuardActive(state, Date.now());

      expect(result).toBe(false);
    });

    it("returns false when acknowledgedCompactionEpoch matches recentCompactionEpoch", () => {
      const state = createMockSessionState();
      const now = Date.now();
      state.recentCompactionAt = now;
      state.recentCompactionEpoch = 1;
      state.acknowledgedCompactionEpoch = 1;

      const result = isCompactionGuardActive(state, now);

      expect(result).toBe(false);
    });

    it("returns true when within guard window", () => {
      const state = createMockSessionState();
      const now = Date.now();
      state.recentCompactionAt = now - 50_000;
      state.recentCompactionEpoch = 1;
      state.acknowledgedCompactionEpoch = undefined;

      const result = isCompactionGuardActive(state, now);

      expect(result).toBe(true);
    });

    it("returns false when outside guard window", () => {
      const state = createMockSessionState();
      const now = Date.now();
      state.recentCompactionAt = now - 70_000;
      state.recentCompactionEpoch = 1;
      state.acknowledgedCompactionEpoch = undefined;

      const result = isCompactionGuardActive(state, now);

      expect(result).toBe(false);
    });

    it("is active exactly at boundary (just under 60s)", () => {
      const state = createMockSessionState();
      const now = Date.now();
      state.recentCompactionAt = now - (COMPACTION_GUARD_MS - 1);
      state.recentCompactionEpoch = 1;
      state.acknowledgedCompactionEpoch = undefined;

      const result = isCompactionGuardActive(state, now);

      expect(result).toBe(true);
    });

    it("is inactive exactly at boundary (at or over 60s)", () => {
      const state = createMockSessionState();
      const now = Date.now();
      state.recentCompactionAt = now - COMPACTION_GUARD_MS;
      state.recentCompactionEpoch = 1;
      state.acknowledgedCompactionEpoch = undefined;

      const result = isCompactionGuardActive(state, now);

      expect(result).toBe(false);
    });
  });
});
