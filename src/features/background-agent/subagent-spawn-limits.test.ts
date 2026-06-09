import { expect, test, describe } from "bun:test";
import {
  getMaxSubagentDepth,
  getMaxRootSessionSpawnBudget,
  resolveSubagentSpawnContext,
  createSubagentDepthLimitError,
  createSubagentDescendantLimitError,
  DEFAULT_MAX_SUBAGENT_DEPTH,
  DEFAULT_MAX_ROOT_SESSION_SPAWN_BUDGET,
} from "./subagent-spawn-limits";
import type { BackgroundTaskConfig } from "../../config/schema";

describe("Task 2.2: Delegation limits", () => {
  describe("getMaxSubagentDepth", () => {
    test("returns default when no config", () => {
      expect(getMaxSubagentDepth()).toBe(DEFAULT_MAX_SUBAGENT_DEPTH);
    });

    test("returns config value when provided", () => {
      const config: BackgroundTaskConfig = { maxDepth: 5 };
      expect(getMaxSubagentDepth(config)).toBe(5);
    });

    test("returns default when config has no maxDepth", () => {
      const config: BackgroundTaskConfig = {};
      expect(getMaxSubagentDepth(config)).toBe(DEFAULT_MAX_SUBAGENT_DEPTH);
    });
  });

  describe("getMaxRootSessionSpawnBudget", () => {
    test("returns default when no config", () => {
      expect(getMaxRootSessionSpawnBudget()).toBe(
        DEFAULT_MAX_ROOT_SESSION_SPAWN_BUDGET,
      );
    });

    test("returns config value when provided", () => {
      const config: BackgroundTaskConfig = { maxDescendants: 100 };
      expect(getMaxRootSessionSpawnBudget(config)).toBe(100);
    });

    test("returns default when config has no maxDescendants", () => {
      const config: BackgroundTaskConfig = {};
      expect(getMaxRootSessionSpawnBudget(config)).toBe(
        DEFAULT_MAX_ROOT_SESSION_SPAWN_BUDGET,
      );
    });
  });

  describe("resolveSubagentSpawnContext", () => {
    test("resolves root session for top-level session", async () => {
      const client = createMockClient({
        "session-1": { parentID: null },
      });

      const context = await resolveSubagentSpawnContext(
        client as any,
        "session-1",
      );

      expect(context.rootSessionID).toBe("session-1");
      expect(context.parentDepth).toBe(0);
      expect(context.childDepth).toBe(1);
    });

    test("resolves root session through parent chain", async () => {
      const client = createMockClient({
        "session-3": { parentID: "session-2" },
        "session-2": { parentID: "session-1" },
        "session-1": { parentID: null },
      });

      const context = await resolveSubagentSpawnContext(
        client as any,
        "session-3",
      );

      expect(context.rootSessionID).toBe("session-1");
      expect(context.parentDepth).toBe(2);
      expect(context.childDepth).toBe(3);
    });

    test("detects session parent cycle", async () => {
      const client = createMockClient({
        "session-1": { parentID: "session-2" },
        "session-2": { parentID: "session-1" },
      });

      await expect(
        resolveSubagentSpawnContext(client as any, "session-1"),
      ).rejects.toThrow("Detected a session parent cycle");
    });

    test("handles session get error", async () => {
      const client = {
        session: {
          get: async () => ({ error: "Session not found" }),
        },
      };

      await expect(
        resolveSubagentSpawnContext(client as any, "session-1"),
      ).rejects.toThrow("Subagent spawn blocked");
    });

    test("handles missing session data", async () => {
      const client = {
        session: {
          get: async () => ({ data: null }),
        },
      };

      await expect(
        resolveSubagentSpawnContext(client as any, "session-1"),
      ).rejects.toThrow("No session data returned");
    });
  });

  describe("createSubagentDepthLimitError", () => {
    test("creates error with correct message", () => {
      const error = createSubagentDepthLimitError({
        childDepth: 4,
        maxDepth: 3,
        parentSessionID: "parent-1",
        rootSessionID: "root-1",
      });

      expect(error.message).toContain(
        "child depth 4 exceeds background_task.maxDepth=3",
      );
      expect(error.message).toContain("Parent session: parent-1");
      expect(error.message).toContain("Root session: root-1");
    });
  });

  describe("createSubagentDescendantLimitError", () => {
    test("creates error with correct message", () => {
      const error = createSubagentDescendantLimitError({
        rootSessionID: "root-1",
        descendantCount: 50,
        maxDescendants: 50,
      });

      expect(error.message).toContain(
        "root session root-1 already has 50 descendants",
      );
      expect(error.message).toContain("background_task.maxDescendants=50");
    });
  });
});

function createMockClient(
  sessions: Record<string, { parentID: string | null }>,
) {
  return {
    session: {
      get: async ({ path }: { path: { id: string } }) => {
        const session = sessions[path.id];
        if (!session) {
          return { error: "Session not found" };
        }
        return { data: session };
      },
    },
  };
}
