import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { tmpdir } from "os";
import { join } from "path";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "fs";
import {
  getRegistryDir,
  readBoulderForPlan,
  writeBoulderForPlan,
  deleteBoulderForPlan,
  getActivePlans,
  getActivePlanCount,
  hasConflictingPlan,
  migrateV1ToV2,
  ensureRegistryExists,
  findPlanNameForSession,
} from "../../../src/features/boulder-state/storage";
import {
  createWorktreeForPlan,
  validateWorktreeHealth,
} from "../../../src/hooks/start-work/worktree-detector";
import type { BoulderState } from "../../../src/features/boulder-state/types";

describe("Start-Work Isolation Integration", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `isolation-test-${Date.now()}-${Math.random()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("single plan workflow", () => {
    it("start-work with no existing plan creates registry entry without worktree", () => {
      ensureRegistryExists(testDir);

      const state: BoulderState = {
        active_plan: join(testDir, ".bob/plans/test-plan.md"),
        started_at: new Date().toISOString(),
        session_ids: ["ses_new"],
        plan_name: "test-plan",
      };

      const written = writeBoulderForPlan(testDir, "test-plan", state);
      expect(written).toBe(true);

      const plans = getActivePlans(testDir);
      expect(plans).toContain("test-plan");
    });

    it("start-work with existing plan reuses registry entry", () => {
      const existingState: BoulderState = {
        active_plan: join(testDir, ".bob/plans/existing-plan.md"),
        started_at: new Date().toISOString(),
        session_ids: ["ses_existing"],
        plan_name: "existing-plan",
      };
      writeBoulderForPlan(testDir, "existing-plan", existingState);

      const found = readBoulderForPlan(testDir, "existing-plan");
      expect(found?.plan_name).toBe("existing-plan");
      expect(found?.session_ids).toContain("ses_existing");
    });
  });

  describe("parallel plan conflict detection", () => {
    it("hasConflictingPlan returns false when no other plans", () => {
      const hasConflict = hasConflictingPlan(testDir, "new-plan");
      expect(hasConflict).toBe(false);
    });

    it("hasConflictingPlan returns true when other plans exist", () => {
      writeBoulderForPlan(testDir, "existing", {
        active_plan: join(testDir, ".bob/plans/existing.md"),
        started_at: new Date().toISOString(),
        session_ids: ["ses_existing"],
        plan_name: "existing",
      });

      const hasConflict = hasConflictingPlan(testDir, "new-plan");
      expect(hasConflict).toBe(true);
    });

    it("hasConflictingPlan returns false when only excluded plan exists", () => {
      writeBoulderForPlan(testDir, "solo", {
        active_plan: join(testDir, ".bob/plans/solo.md"),
        started_at: new Date().toISOString(),
        session_ids: ["ses_solo"],
        plan_name: "solo",
      });

      const hasConflict = hasConflictingPlan(testDir, "solo");
      expect(hasConflict).toBe(false);
    });
  });

  describe("worktree creation for isolation", () => {
    it("createWorktreeForPlan returns null in non-git directory", () => {
      const worktreePath = createWorktreeForPlan(testDir, "isolated-plan");
      expect(worktreePath).toBeNull();
    });

    it("validateWorktreeHealth returns invalid for missing path", () => {
      const result = validateWorktreeHealth(join(testDir, "nonexistent-worktree"));
      expect(result.valid).toBe(false);
    });
  });

  describe("stop continuation cleanup", () => {
    it("deleteBoulderForPlan removes only that plan", () => {
      writeBoulderForPlan(testDir, "plan-a", {
        active_plan: "/a.md",
        started_at: "",
        session_ids: ["ses_a"],
        plan_name: "plan-a",
      });
      writeBoulderForPlan(testDir, "plan-b", {
        active_plan: "/b.md",
        started_at: "",
        session_ids: ["ses_b"],
        plan_name: "plan-b",
      });

      deleteBoulderForPlan(testDir, "plan-b");

      const remainingPlans = getActivePlans(testDir);
      expect(remainingPlans).toContain("plan-a");
      expect(remainingPlans).not.toContain("plan-b");
    });
  });

  describe("v1 to v2 migration", () => {
    it("legacy boulder.json migrates to registry format", () => {
      const legacyState = {
        active_plan: join(testDir, ".bob/plans/v1-plan.md"),
        started_at: "2026-05-12T00:00:00.000Z",
        session_ids: ["ses_v1"],
        plan_name: "v1-plan",
      };
      mkdirSync(join(testDir, ".bob"), { recursive: true });
      writeFileSync(join(testDir, ".bob/boulder.json"), JSON.stringify(legacyState), "utf-8");

      migrateV1ToV2(testDir);

      const migrated = readBoulderForPlan(testDir, "v1-plan");
      expect(migrated?.plan_name).toBe("v1-plan");
      expect(migrated?.session_ids).toContain("ses_v1");
    });

    it("original boulder.json renamed to .v1.bak after migration", () => {
      const legacyState = {
        active_plan: "/test.md",
        started_at: "",
        session_ids: ["ses_backup"],
        plan_name: "backup-test",
      };
      mkdirSync(join(testDir, ".bob"), { recursive: true });
      writeFileSync(join(testDir, ".bob/boulder.json"), JSON.stringify(legacyState), "utf-8");

      migrateV1ToV2(testDir);

      expect(existsSync(join(testDir, ".bob/boulder.json.v1.bak"))).toBe(true);
      expect(existsSync(join(testDir, ".bob/boulder.json"))).toBe(false);
    });
  });

  describe("backward compatibility", () => {
    it("single plan mode still works", () => {
      const state: BoulderState = {
        active_plan: join(testDir, ".bob/plans/compat-test.md"),
        started_at: new Date().toISOString(),
        session_ids: ["ses_compat"],
        plan_name: "compat-test",
      };

      writeBoulderForPlan(testDir, "compat-test", state);
      const readBack = readBoulderForPlan(testDir, "compat-test");

      expect(readBack?.plan_name).toBe("compat-test");
      expect(readBack?.session_ids).toContain("ses_compat");
    });

    it("empty registry returns empty array from getActivePlans", () => {
      const plans = getActivePlans(testDir);
      expect(plans).toEqual([]);
    });

    it("getActivePlanCount returns 0 for empty registry", () => {
      const count = getActivePlanCount(testDir);
      expect(count).toBe(0);
    });
  });

  describe("session tracking across plans", () => {
    it("findPlanNameForSession returns correct plan", () => {
      const state1: BoulderState = {
        active_plan: "/a.md",
        started_at: "",
        session_ids: ["ses_alpha"],
        plan_name: "alpha",
      };
      const state2: BoulderState = {
        active_plan: "/b.md",
        started_at: "",
        session_ids: ["ses_beta", "ses_shared"],
        plan_name: "beta",
      };
      writeBoulderForPlan(testDir, "alpha", state1);
      writeBoulderForPlan(testDir, "beta", state2);

      const foundAlpha = findPlanNameForSession(testDir, "ses_alpha");
      expect(foundAlpha).toBe("alpha");

      const foundBeta = findPlanNameForSession(testDir, "ses_beta");
      expect(foundBeta).toBe("beta");
    });

    it("findPlanNameForSession returns null for unknown session", () => {
      const found = findPlanNameForSession(testDir, "ses_unknown");
      expect(found).toBeNull();
    });
  });
});
