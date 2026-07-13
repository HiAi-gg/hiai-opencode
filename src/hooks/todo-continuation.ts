/**
 * todo-continuation.ts — Detects incomplete tasks and generates actionable
 * continuation instructions for the loop subsystem.
 *
 * On session.idle, checks if there are incomplete tasks (via loop-state's
 * hasIncompleteTasks flag, set by the completion-controller's event handler).
 * If incomplete tasks exist and the loop is still active, generates a
 * continuation prompt. If the API supports injection, the prompt is logged
 * and recorded in loop-state for downstream hooks; otherwise a detailed
 * log reason is recorded.
 */

import type { BobConfig, HookSet } from "../types";
import { BlockingHookError } from "./errors";
import {
  buildContinuationPrompt,
  get,
  setContinuationPrompt,
  setHasIncompleteTasks,
} from "./loop-state";
import { logger } from "../util/log";

const COOLDOWN_MS = 30_000;

export function createTodoContinuationHook(_config: BobConfig): HookSet {
  return {
    event: async ({ event }: { event: unknown }) => {
      try {
        const evt = event as {
          type?: string;
          properties?: Record<string, unknown>;
        };
        if (!evt?.type || !evt.properties) return;
        const sessionID = evt.properties.sessionID as string | undefined;
        if (!sessionID) return;

        switch (evt.type) {
          case "session.idle": {
            // Update incomplete-tasks flag from event data if available
            const maybeTodoCount = evt.properties.incompleteTodoCount as
              | number
              | undefined;
            if (maybeTodoCount !== undefined) {
              setHasIncompleteTasks(sessionID, maybeTodoCount > 0);
            }

            const s = get(sessionID);

            // Rate-limit continuation prompts
            const now = Date.now();
            if (s.lastLoopTime > 0 && now - s.lastLoopTime < COOLDOWN_MS)
              return;

            // If the loop says completed, nothing to continue
            if (s.isCompleted) return;

            if (s.hasIncompleteTasks) {
              // Generate a continuation prompt for the remaining work
              const prompt = buildContinuationPrompt(sessionID, 1);
              logger.log(
                `[hiai-opencode] Todo-continuation: session ${sessionID} has incomplete tasks — ${prompt}`,
              );

              // Record the prompt in loop-state so other hooks can use it
              setContinuationPrompt(sessionID, prompt);
            }
            // No incomplete tasks: nothing to continue. Stay silent to avoid
            // flooding the TUI with a hint on every idle session.
            break;
          }

          case "session.error": {
            // Log the error for continuation context
            const errorStr = evt.properties?.error
              ? String(evt.properties.error)
              : "unknown error";
            logger.log(
              `[hiai-opencode] Todo-continuation: session ${sessionID} errored — ${errorStr}. Continuation state reset.`,
            );
            break;
          }

          case "session.deleted": {
            logger.log(
              `[hiai-opencode] Todo-continuation: session ${sessionID} deleted — cleanup`,
            );
            break;
          }
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        logger.error("[hiai-opencode] Hook error in todo-continuation:", err);
      }
    },
  };
}
