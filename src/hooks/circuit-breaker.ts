import type { BobConfig, HookSet } from "../types";
import type { BackgroundManager } from "../features/background-manager/index";
import { BlockingHookError } from "./errors";
import { logger } from "../util/log";

/**
 * Circuit-breaker hook: feeds every tool call into the BackgroundManager so the
 * consecutive-identical-call and total-tool-call limits can abort runaway
 * sessions. This is the production wiring that makes `background_manager.
 * circuit_breaker` (bob.json) actually take effect — without it the breaker
 * logic in BackgroundManager is never invoked.
 *
 * The breaker is a safety net, not a primary control flow: it only trips on
 * pathological loops (20+ identical calls in a row) or runaway usage (4000+
 * total calls). Normal agent work never approaches these thresholds.
 */
export function createCircuitBreakerHook(
  _config: BobConfig,
  manager: BackgroundManager,
): HookSet {
  return {
    "tool.execute.after": async (input, _output) => {
      try {
        const sid = input.sessionID;
        if (!sid) return;
        // The `task` tool itself is excluded — spawning a subagent is not a
        // repetitive action the breaker should count against the parent.
        if (input.tool === "task") return;
        manager.recordSessionToolCall(
          sid,
          input.tool,
          input.args as Record<string, unknown> | undefined,
        );
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        // Circuit-breaker accounting must never break a tool result.
        logger.error("[hiai-opencode] Hook error in circuit-breaker:", err);
      }
    },
  };
}
