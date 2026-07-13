/**
 * context-window-limit-recovery.ts — Detects context window limit errors
 * and triggers recovery via the compaction subsystem.
 *
 * Listens for session.error events with context-window-related errors,
 * resets loop state, and logs a specific recovery hint suggesting
 * compaction or summarization.
 */

import type { BobConfig, HookSet } from "../types";
import { BlockingHookError } from "./errors";
import {
  buildRecoveryContext,
  buildRecoveryHint,
  classifyError,
  reset,
} from "./loop-state";
import { logger } from "../util/log";

/** Errors that explicitly say the context window was hit. */
const CONTEXT_WINDOW_PATTERNS = [
  "context_length_exceeded",
  "max_tokens",
  "token limit",
  "context window",
  "maximum context length",
  "context length",
  "too long",
  "reduce the length",
];

function isContextWindowError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return CONTEXT_WINDOW_PATTERNS.some((p) => lower.includes(p));
}

function extractErrorMessage(properties: Record<string, unknown>): string {
  const err = properties.error;
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && err !== null) {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === "string") return obj.message;
    const data = obj.data;
    if (
      data &&
      typeof data === "object" &&
      data !== null &&
      typeof (data as Record<string, unknown>).message === "string"
    )
      return (data as Record<string, unknown>).message as string;
  }
  return String(err ?? "unknown error");
}

export function createContextWindowLimitRecoveryHook(
  _config: BobConfig,
): HookSet {
  return {
    event: async ({ event }: { event: unknown }) => {
      try {
        if (!event || typeof event !== "object" || !("type" in event)) return;
        const evt = event as {
          type?: string;
          properties?: Record<string, unknown>;
        };
        if (evt?.type !== "session.error") return;

        const sessionID = (evt.properties?.sessionID as string) ?? "unknown";
        const errorMessage = extractErrorMessage(evt.properties ?? {});

        if (!isContextWindowError(errorMessage)) return;

        const errorType = classifyError(errorMessage);
        const hint = buildRecoveryHint(errorType);
        const context = buildRecoveryContext(hint);

        // Reset loop state so the next idle cycle can start fresh
        reset(sessionID);

        logger.log(
          `[hiai-opencode] Context-window-limit: session ${sessionID} exceeded context limit.`,
        );
        logger.log(`[hiai-opencode] Context-window-limit: ${hint}`);
        logger.log(
          "[hiai-opencode] Context-window-limit: compaction context injected for next compaction cycle",
        );
        logger.log(`[hiai-opencode] Context-window-limit: ${context}`);
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        logger.error(
          "[hiai-opencode] Hook error in context-window-limit-recovery:",
          err,
        );
      }
    },

    /** Inject context-window recovery hints into compaction. */
    "experimental.session.compacting": async (
      _input: Parameters<
        NonNullable<HookSet["experimental.session.compacting"]>
      >[0],
      output: Parameters<
        NonNullable<HookSet["experimental.session.compacting"]>
      >[1],
    ) => {
      try {
        if (!output?.context) return;
        output.context.push(
          "[hiai-opencode] Context-window-limit: if the previous session ended due to a context limit error, " +
            "prioritize summarization and remove redundant messages.",
        );
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        logger.error(
          "[hiai-opencode] Hook error in context-window-limit-recovery:",
          err,
        );
      }
    },
  };
}
