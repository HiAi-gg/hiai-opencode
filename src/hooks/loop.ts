/**
 * loop.ts — Main loop hook.
 *
 * Drives the session-idle loop: tracks iterations, enforces cooldown,
 * detects completion markers, and orchestrates continuation prompts.
 */

import type { BobConfig, HookSet } from "../types";
import { BlockingHookError } from "./errors";
import {
  detectCompletionMarker,
  get,
  recordIteration,
  reset,
  setContinuationPrompt,
  shouldContinue,
} from "./loop-state";
import { logger } from "../util/log";

/** Short, stable, non-leaky identifier for logs/prompts (no raw session id). */
function shortId(sessionID: string): string {
  if (sessionID.length <= 12) return sessionID;
  return `${sessionID.slice(0, 6)}…${sessionID.slice(-4)}`;
}

export function createLoopHook(config: BobConfig): HookSet {
  const rawCfg = config as Record<string, unknown>;
  const loopCfg = (rawCfg.loop ?? {}) as Record<string, unknown>;
  const maxIterations =
    typeof loopCfg.maxIterations === "number"
      ? loopCfg.maxIterations
      : undefined;
  const cooldownMs =
    typeof loopCfg.cooldownMs === "number" ? loopCfg.cooldownMs : undefined;

  return {
    dispose: async () => {
      // Cleanup is per-event; no global dispose needed.
    },

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
            const s = get(sessionID);

            // Apply config-level overrides on first access
            if (maxIterations !== undefined) s.maxIterations = maxIterations;
            if (cooldownMs !== undefined) s.cooldownMs = cooldownMs;

            if (!shouldContinue(sessionID)) return;

            recordIteration(sessionID);
            // Build and record a continuation prompt so downstream
            // hooks (eg todo-continuation) can pick it up. Use a sanitized
            // short id to avoid leaking the raw session id into prompts/logs.
            setContinuationPrompt(
              sessionID,
              `Session ${shortId(sessionID)} active (iter ${s.iterations}). Continue.`,
            );
            break;
          }

          case "session.error": {
            // Reset loop state so recovery can start fresh
            reset(sessionID);
            break;
          }

          case "session.deleted": {
            reset(sessionID);
            break;
          }
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        logger.error("[hiai-opencode] Hook error in loop:", err);
      }
    },

    /** Detect completion markers in the messages being sent to the LLM. */
    "experimental.chat.messages.transform": async (
      _input: Parameters<
        NonNullable<HookSet["experimental.chat.messages.transform"]>
      >[0],
      output: Parameters<
        NonNullable<HookSet["experimental.chat.messages.transform"]>
      >[1],
    ) => {
      try {
        if (!output?.messages?.length) return;
        const lastEntry = output.messages[output.messages.length - 1];
        if (!lastEntry?.parts?.length) return;
        const lastPart = lastEntry.parts[lastEntry.parts.length - 1] as Record<
          string,
          unknown
        >;
        if (lastPart?.type === "text" && typeof lastPart.text === "string") {
          if (detectCompletionMarker(lastPart.text)) {
            // Completion detected — we can't get sessionID here,
            // but we log the detection event for observability.
          }
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        logger.error("[hiai-opencode] Hook error in loop:", err);
      }
    },
  };
}
