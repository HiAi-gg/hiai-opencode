/**
 * stop-continuation-guard.ts — Resets loop and continuation state
 * when stop signals are received.
 *
 * Handles user.message (user has taken over — stop auto-continue),
 * session.error (something went wrong — reset for fresh start),
 * session.deleted (session gone — clean up), and session.stop events.
 */

import type { BobConfig, HookSet } from "../types";
import { BlockingHookError } from "./errors";
import { reset } from "./loop-state";
import { logger } from "../util/log";

/** Event types that should clear loop/continuation state. */
const STOP_EVENTS = new Set([
  "user.message",
  "session.error",
  "session.deleted",
  "session.stop",
]);

// We also need to track which sessions were reset so we don't
// reset them again in the same event burst.
const recentlyReset = new Set<string>();

export function createStopContinuationGuard(_config: BobConfig): HookSet {
  return {
    event: async ({ event }: { event: unknown }) => {
      try {
        const evt = event as {
          type?: string;
          properties?: Record<string, unknown>;
        };
        if (!evt?.type) return;

        if (!STOP_EVENTS.has(evt.type)) return;

        const sessionID = (evt.properties?.sessionID as string) ?? "unknown";

        // Debounce: skip if we just reset this session
        if (recentlyReset.has(sessionID)) return;
        recentlyReset.add(sessionID);
        setTimeout(() => recentlyReset.delete(sessionID), 5_000);

        // Clear loop/continuation state
        reset(sessionID);

        if (evt.type === "session.stop") {
          logger.log(
            `[hiai-opencode] Stop-guard: session ${sessionID} stopped — loop state cleared`,
          );
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        logger.error(
          "[hiai-opencode] Hook error in stop-continuation-guard:",
          err,
        );
      }
    },

    dispose: async () => {
      recentlyReset.clear();
    },
  };
}
