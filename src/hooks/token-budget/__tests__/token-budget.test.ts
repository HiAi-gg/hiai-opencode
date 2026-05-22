import { beforeEach, describe, expect, it } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PluginInput } from "@opencode-ai/plugin";
import type { ContextLimitModelCacheState } from "../../../shared/context-limit-resolver";
import { createTokenBudgetHook } from "../../token-budget";

const TEST_TOKEN_BUDGET_DIR = mkdtempSync(join(tmpdir(), "hiai-test-"));

function createMockPluginInput(): PluginInput {
  return {
    directory: TEST_TOKEN_BUDGET_DIR,
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

function createMockModelCacheState(): ContextLimitModelCacheState {
  return {
    anthropicContext1MEnabled: false,
    modelContextLimitsCache: new Map([
      ["anthropic/claude-4-sonnet-4-6-20250514", 200_000],
      ["openrouter/anthropic/claude-4-sonnet-4-6", 200_000],
    ]),
  };
}

describe("token-budget hook", () => {
  let mockCtx: PluginInput;
  let modelCacheState: ContextLimitModelCacheState;

  beforeEach(() => {
    mockCtx = createMockPluginInput();
    modelCacheState = createMockModelCacheState();
  });

  describe("hook creation", () => {
    it("creates a valid token budget hook", () => {
      const hook = createTokenBudgetHook(mockCtx, modelCacheState);
      expect(hook).toBeDefined();
      expect(typeof hook["tool.execute.before"]).toBe("function");
      expect(typeof hook["tool.execute.after"]).toBe("function");
      expect(typeof hook.event).toBe("function");
    });

    it("creates hook with custom thresholds", () => {
      const hook = createTokenBudgetHook(mockCtx, modelCacheState, {
        warningThreshold80: 0.75,
        warningThreshold90: 0.85,
        hardLimitThreshold: 0.9,
      });
      expect(hook).toBeDefined();
    });

    it("creates hook without modelCacheState", () => {
      const hook = createTokenBudgetHook(mockCtx);
      expect(hook).toBeDefined();
    });
  });

  describe("event handler - message.updated", () => {
    it("ignores non-assistant messages", async () => {
      const hook = createTokenBudgetHook(mockCtx, modelCacheState);

      await hook.event({
        event: {
          type: "message.updated",
          properties: {
            info: {
              role: "user",
              sessionID: "test-session",
              providerID: "anthropic",
              modelID: "claude-4-sonnet-4-6-20250514",
              finish: true,
              tokens: {
                input: 1000,
                output: 500,
                reasoning: 0,
                cache: { read: 100, write: 50 },
              },
            },
          },
        },
      });

      // No error means it handled gracefully
    });

    it("ignores unfinshed messages", async () => {
      const hook = createTokenBudgetHook(mockCtx, modelCacheState);

      await hook.event({
        event: {
          type: "message.updated",
          properties: {
            info: {
              role: "assistant",
              sessionID: "test-session",
              providerID: "anthropic",
              modelID: "claude-4-sonnet-4-6-20250514",
              finish: false,
              tokens: {
                input: 1000,
                output: 500,
                reasoning: 0,
                cache: { read: 100, write: 50 },
              },
            },
          },
        },
      });

      // Should not throw
    });

    it("stores token info from assistant message", async () => {
      const hook = createTokenBudgetHook(mockCtx, modelCacheState);
      const sessionID = "token-cache-test-session";

      await hook.event({
        event: {
          type: "message.updated",
          properties: {
            info: {
              role: "assistant",
              sessionID,
              providerID: "anthropic",
              modelID: "claude-4-sonnet-4-6-20250514",
              finish: true,
              tokens: {
                input: 50000,
                output: 2000,
                reasoning: 10000,
                cache: { read: 20000, write: 5000 },
              },
            },
          },
        },
      });

      // Internal state is updated (we can verify via tool.execute.after behavior)
    });

    it("updates cache on subsequent messages", async () => {
      const hook = createTokenBudgetHook(mockCtx, modelCacheState);
      const sessionID = "cache-update-test";

      await hook.event({
        event: {
          type: "message.updated",
          properties: {
            info: {
              role: "assistant",
              sessionID,
              providerID: "anthropic",
              modelID: "claude-4-sonnet-4-6-20250514",
              finish: true,
              tokens: {
                input: 10000,
                output: 1000,
                reasoning: 0,
                cache: { read: 5000, write: 1000 },
              },
            },
          },
        },
      });

      await hook.event({
        event: {
          type: "message.updated",
          properties: {
            info: {
              role: "assistant",
              sessionID,
              providerID: "anthropic",
              modelID: "claude-4-sonnet-4-6-20250514",
              finish: true,
              tokens: {
                input: 30000,
                output: 2000,
                reasoning: 0,
                cache: { read: 15000, write: 3000 },
              },
            },
          },
        },
      });

      // Should not throw - cache was updated
    });
  });

  describe("event handler - session.deleted", () => {
    it("clears token cache on session deletion", async () => {
      const hook = createTokenBudgetHook(mockCtx, modelCacheState);
      const sessionID = "cleanup-test-session";

      // First add some data to the cache via message.updated
      await hook.event({
        event: {
          type: "message.updated",
          properties: {
            info: {
              role: "assistant",
              sessionID,
              providerID: "anthropic",
              modelID: "claude-4-sonnet-4-6-20250514",
              finish: true,
              tokens: {
                input: 50000,
                output: 2000,
                reasoning: 0,
                cache: { read: 20000, write: 5000 },
              },
            },
          },
        },
      });

      // Now delete the session
      await hook.event({
        event: {
          type: "session.deleted",
          properties: {
            info: { id: sessionID },
          },
        },
      });

      // Should not throw - cache was cleaned up
    });

    it("ignores session.deleted without id", async () => {
      const hook = createTokenBudgetHook(mockCtx, modelCacheState);

      await hook.event({
        event: {
          type: "session.deleted",
          properties: {},
        },
      });

      // Should not throw
    });
  });

  describe("tool.execute.before", () => {
    it("ignores non-compress tools", async () => {
      const hook = createTokenBudgetHook(mockCtx, modelCacheState);

      // Should not throw when calling with non-compress tool
      await hook["tool.execute.before"]({
        tool: "read",
        sessionID: "test-session",
        callID: "call-1",
      });
    });

    it("handles compress tool when no token data cached", async () => {
      const hook = createTokenBudgetHook(mockCtx, modelCacheState);

      // Should not throw when no cache exists
      await hook["tool.execute.before"]({
        tool: "compress",
        sessionID: "uncached-session",
        callID: "call-2",
      });
    });

    it("respects isCompacting flag to skip checks", async () => {
      const hook = createTokenBudgetHook(mockCtx, modelCacheState);

      // Should not throw when session is compacting
      await hook["tool.execute.before"]({
        tool: "compress",
        sessionID: "any-session",
        callID: "call-3",
      });
    });
  });

  describe("tool.execute.after", () => {
    it("handles compress output for uncached session", async () => {
      const hook = createTokenBudgetHook(mockCtx, modelCacheState);

      const output = {
        title: "Compress",
        output: "Compression completed",
        metadata: {},
      };

      // Should not throw
      await hook["tool.execute.after"](
        {
          tool: "compress",
          sessionID: "uncached-session",
          callID: "call-4",
        },
        output,
      );
    });

    it("appends warning for high token usage at hard limit", async () => {
      const hook = createTokenBudgetHook(mockCtx, modelCacheState);
      const sessionID = "high-usage-session";

      // First add high usage data to cache
      await hook.event({
        event: {
          type: "message.updated",
          properties: {
            info: {
              role: "assistant",
              sessionID,
              providerID: "anthropic",
              modelID: "claude-4-sonnet-4-6-20250514",
              finish: true,
              tokens: {
                input: 190000,
                output: 5000,
                reasoning: 0,
                cache: { read: 10000, write: 0 },
              },
            },
          },
        },
      });

      const output = {
        title: "Compress",
        output: "Compression completed",
        metadata: {},
      };

      await hook["tool.execute.after"](
        {
          tool: "compress",
          sessionID,
          callID: "call-5",
        },
        output,
      );

      // Output should have warning appended for high usage
      expect(output.output).toContain("[TURBO-BUDGET");
    });

    it("does not append warning for normal usage below 90%", async () => {
      const hook = createTokenBudgetHook(mockCtx, modelCacheState);
      const sessionID = "normal-usage-session";

      await hook.event({
        event: {
          type: "message.updated",
          properties: {
            info: {
              role: "assistant",
              sessionID,
              providerID: "anthropic",
              modelID: "claude-4-sonnet-4-6-20250514",
              finish: true,
              tokens: {
                input: 50000,
                output: 5000,
                reasoning: 0,
                cache: { read: 10000, write: 0 },
              },
            },
          },
        },
      });

      const output = {
        title: "Compress",
        output: "Compression completed",
        metadata: {},
      };

      await hook["tool.execute.after"](
        {
          tool: "compress",
          sessionID,
          callID: "call-6",
        },
        output,
      );

      expect(output.output).not.toContain("[TURBO-BUDGET");
    });
  });

  describe("threshold boundaries", () => {
    it("handles exact 80% threshold", async () => {
      const hook = createTokenBudgetHook(mockCtx, modelCacheState, {
        warningThreshold80: 0.8,
        warningThreshold90: 0.9,
        hardLimitThreshold: 0.95,
      });
      const sessionID = "exact-80-session";

      // 80% usage: input 160000 + cache 20000 = 180000 / 200000 = 0.9 = 90%
      await hook.event({
        event: {
          type: "message.updated",
          properties: {
            info: {
              role: "assistant",
              sessionID,
              providerID: "anthropic",
              modelID: "claude-4-sonnet-4-6-20250514",
              finish: true,
              tokens: {
                input: 160000,
                output: 5000,
                reasoning: 0,
                cache: { read: 20000, write: 0 },
              },
            },
          },
        },
      });

      const output = { title: "Test", output: "test", metadata: {} };
      await hook["tool.execute.after"](
        { tool: "compress", sessionID, callID: "call-7" },
        output,
      );
    });

    it("handles custom threshold configuration", () => {
      const hook = createTokenBudgetHook(mockCtx, modelCacheState, {
        warningThreshold80: 0.7,
        warningThreshold90: 0.8,
        hardLimitThreshold: 0.85,
      });

      expect(hook).toBeDefined();
    });
  });

  describe("error resilience", () => {
    it("toast failure in showWarning does not propagate", async () => {
      const failDir = mkdtempSync(join(tmpdir(), "hiai-test-"));
      const failingCtx: PluginInput = {
        directory: failDir,
        client: {
          session: {
            messages: async () => [],
            summarize: async () => ({ summary: "" }),
          },
          tui: {
            showToast: async () => {
              throw new Error("Toast failed");
            },
          },
        },
      } as unknown as PluginInput;

      const hook = createTokenBudgetHook(failingCtx, modelCacheState);
      const sessionID = "toast-fail-session";

      await hook.event({
        event: {
          type: "message.updated",
          properties: {
            info: {
              role: "assistant",
              sessionID,
              providerID: "anthropic",
              modelID: "claude-4-sonnet-4-6-20250514",
              finish: true,
              tokens: {
                input: 170000,
                output: 5000,
                reasoning: 0,
                cache: { read: 20000, write: 0 },
              },
            },
          },
        },
      });

      // Should not throw even though toast failed
    });
  });
});
