import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { tmpdir } from "os";
import { join } from "path";
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "fs";
import {
  getRegistryDir,
  readBoulderForPlan,
  writeBoulderForPlan,
  deleteBoulderForPlan,
  getActivePlans,
  getActivePlanCount,
  findPlanNameForSession,
  hasConflictingPlan,
  migrateV1ToV2,
  ensureRegistryExists,
} from "../../../src/features/boulder-state/storage";
import type { BoulderState } from "../../../src/features/boulder-state/types";

describe("Boulder Registry", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `boulder-registry-test-${Date.now()}-${Math.random()}`);
    mkdirSync(join(testDir, ".bob"), { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("getRegistryDir", () => {
    it("returns correct registry path", () => {
      const registryDir = getRegistryDir(testDir);
      expect(registryDir).toBe(join(testDir, ".bob/boulder-registry"));
    });
  });

  describe("readBoulderForPlan", () => {
    it("returns null for missing plan", () => {
      const state = readBoulderForPlan(testDir, "nonexistent");
      expect(state).toBeNull();
    });

    it("returns state for existing plan", () => {
      const testState: BoulderState = {
        active_plan: "/test/plan.md",
        started_at: "2026-05-12T00:00:00.000Z",
        session_ids: ["ses_123"],
        session_origins: { ses_123: "direct" },
        plan_name: "test-plan",
      };
      writeBoulderForPlan(testDir, "test-plan", testState);

      const state = readBoulderForPlan(testDir, "test-plan");
      expect(state).toEqual(testState);
    });

    it("returns null for corrupted JSON", () => {
      const registryDir = getRegistryDir(testDir);
      mkdirSync(registryDir, { recursive: true });
      writeFileSync(join(registryDir, "bad-plan.json"), "{ invalid json }", "utf-8");

      const state = readBoulderForPlan(testDir, "bad-plan");
      expect(state).toBeNull();
    });
  });

  describe("writeBoulderForPlan", () => {
    it("creates file atomically", () => {
      const testState: BoulderState = {
        active_plan: "/test/plan.md",
        started_at: "2026-05-12T00:00:00.000Z",
        session_ids: ["ses_123"],
        plan_name: "atomic-plan",
      };

      const result = writeBoulderForPlan(testDir, "atomic-plan", testState);
      expect(result).toBe(true);
      expect(existsSync(join(getRegistryDir(testDir), "atomic-plan.json"))).toBe(true);
    });

    it("overwrites existing state", () => {
      const state1: BoulderState = {
        active_plan: "/test/plan1.md",
        started_at: "2026-05-12T00:00:00.000Z",
        session_ids: ["ses_1"],
        plan_name: "overwrite-plan",
      };
      const state2: BoulderState = {
        active_plan: "/test/plan2.md",
        started_at: "2026-05-12T01:00:00.000Z",
        session_ids: ["ses_2"],
        plan_name: "overwrite-plan",
      };

      writeBoulderForPlan(testDir, "overwrite-plan", state1);
      writeBoulderForPlan(testDir, "overwrite-plan", state2);

      const result = readBoulderForPlan(testDir, "overwrite-plan");
      expect(result?.session_ids).toEqual(["ses_2"]);
    });
  });

  describe("deleteBoulderForPlan", () => {
    it("removes file and returns true", () => {
      const testState: BoulderState = {
        active_plan: "/test/plan.md",
        started_at: "2026-05-12T00:00:00.000Z",
        session_ids: ["ses_123"],
        plan_name: "delete-me",
      };
      writeBoulderForPlan(testDir, "delete-me", testState);

      const result = deleteBoulderForPlan(testDir, "delete-me");
      expect(result).toBe(true);
      expect(readBoulderForPlan(testDir, "delete-me")).toBeNull();
    });

    it("returns false for missing plan", () => {
      const result = deleteBoulderForPlan(testDir, "nonexistent");
      expect(result).toBe(false);
    });
  });

  describe("getActivePlans", () => {
    it("returns empty array when registry is empty", () => {
      const plans = getActivePlans(testDir);
      expect(plans).toEqual([]);
    });

    it("returns array of plan names", () => {
      writeBoulderForPlan(testDir, "plan-a", { active_plan: "/a.md", started_at: "", session_ids: [], plan_name: "plan-a" });
      writeBoulderForPlan(testDir, "plan-b", { active_plan: "/b.md", started_at: "", session_ids: [], plan_name: "plan-b" });

      const plans = getActivePlans(testDir);
      expect(plans).toContain("plan-a");
      expect(plans).toContain("plan-b");
    });
  });

  describe("getActivePlanCount", () => {
    it("returns 0 for empty registry", () => {
      const count = getActivePlanCount(testDir);
      expect(count).toBe(0);
    });

    it("returns correct count", () => {
      writeBoulderForPlan(testDir, "plan-a", { active_plan: "/a.md", started_at: "", session_ids: [], plan_name: "plan-a" });
      writeBoulderForPlan(testDir, "plan-b", { active_plan: "/b.md", started_at: "", session_ids: [], plan_name: "plan-b" });

      const count = getActivePlanCount(testDir);
      expect(count).toBe(2);
    });
  });

  describe("findPlanNameForSession", () => {
    it("returns null for unknown session", () => {
      const planName = findPlanNameForSession(testDir, "unknown-session");
      expect(planName).toBeNull();
    });

    it("finds session in correct plan", () => {
      const state1: BoulderState = {
        active_plan: "/a.md",
        started_at: "",
        session_ids: ["ses_alpha"],
        plan_name: "plan-alpha",
      };
      const state2: BoulderState = {
        active_plan: "/b.md",
        started_at: "",
        session_ids: ["ses_beta"],
        plan_name: "plan-beta",
      };
      writeBoulderForPlan(testDir, "plan-alpha", state1);
      writeBoulderForPlan(testDir, "plan-beta", state2);

      const planName = findPlanNameForSession(testDir, "ses_beta");
      expect(planName).toBe("plan-beta");
    });
  });

  describe("hasConflictingPlan", () => {
    it("returns false when no plans exist", () => {
      const hasConflict = hasConflictingPlan(testDir, "any-plan");
      expect(hasConflict).toBe(false);
    });

    it("returns false when only excluded plan exists", () => {
      writeBoulderForPlan(testDir, "solo-plan", { active_plan: "/solo.md", started_at: "", session_ids: [], plan_name: "solo-plan" });

      const hasConflict = hasConflictingPlan(testDir, "solo-plan");
      expect(hasConflict).toBe(false);
    });

    it("returns true when other plans exist", () => {
      writeBoulderForPlan(testDir, "existing", { active_plan: "/existing.md", started_at: "", session_ids: [], plan_name: "existing" });

      const hasConflict = hasConflictingPlan(testDir, "new-plan");
      expect(hasConflict).toBe(true);
    });
  });

  describe("migrateV1ToV2", () => {
    it("migrates legacy boulder.json to registry", () => {
      const legacyState = {
        active_plan: "/test/v1-plan.md",
        started_at: "2026-05-12T00:00:00.000Z",
        session_ids: ["ses_legacy"],
        plan_name: "v1-plan",
      };
      mkdirSync(join(testDir, ".bob"), { recursive: true });
      writeFileSync(join(testDir, ".bob/boulder.json"), JSON.stringify(legacyState), "utf-8");

      const result = migrateV1ToV2(testDir);
      expect(result).toBe(true);

      const migrated = readBoulderForPlan(testDir, "v1-plan");
      expect(migrated?.plan_name).toBe("v1-plan");
      expect(migrated?.session_ids).toContain("ses_legacy");

      expect(existsSync(join(testDir, ".bob/boulder.json.v1.bak"))).toBe(true);
      expect(existsSync(join(testDir, ".bob/boulder.json"))).toBe(false);
    });

    it("returns true if no legacy file exists", () => {
      const result = migrateV1ToV2(testDir);
      expect(result).toBe(true);
    });
  });

  describe("ensureRegistryExists", () => {
    it("creates registry directory", () => {
      ensureRegistryExists(testDir);

      const registryDir = getRegistryDir(testDir);
      expect(existsSync(registryDir)).toBe(true);
    });

    it("triggers migration when legacy file exists", () => {
      const legacyState = {
        active_plan: "/test/migrate-test.md",
        started_at: "2026-05-12T00:00:00.000Z",
        session_ids: ["ses_migrate"],
        plan_name: "migrate-test",
      };
      mkdirSync(join(testDir, ".bob"), { recursive: true });
      writeFileSync(join(testDir, ".bob/boulder.json"), JSON.stringify(legacyState), "utf-8");

      ensureRegistryExists(testDir);

      const migrated = readBoulderForPlan(testDir, "migrate-test");
      expect(migrated?.plan_name).toBe("migrate-test");
    });
  });
});
