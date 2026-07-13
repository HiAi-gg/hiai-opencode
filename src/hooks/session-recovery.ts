/**
 * session-recovery.ts — Classifies session errors and produces actionable
 * recovery hints for the loop/recovery subsystem.
 *
 * Listens for session.error events, classifies the error into a known
 * type (rate_limit, auth, timeout, empty_response, server_error,
 * context_window_exceeded, or unknown), and records the error in
 * loop-state so downstream hooks can respond appropriately.
 */

import type { BobConfig, HookSet } from "../types";
import { BlockingHookError } from "./errors";
import { buildRecoveryHint, classifyError, markError } from "./loop-state";
import { logger } from "../util/log";

function extractErrorMessage(properties: Record<string, unknown>): string {
  // Try common shapes: error string, error object with message, or APIError
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

export function createSessionRecoveryHook(_config: BobConfig): HookSet {
  return {
    event: async ({ event }: { event: unknown }) => {
      try {
        const evt = event as {
          type?: string;
          properties?: Record<string, unknown>;
        };
        if (evt?.type !== "session.error") return;
        if (!evt.properties) return;

        const sessionID = (evt.properties.sessionID as string) ?? "unknown";
        const errorMessage = extractErrorMessage(evt.properties);
        const errorType = classifyError(errorMessage);
        const hint = buildRecoveryHint(errorType);

        // Record the error in loop-state for downstream hooks
        markError(sessionID, errorMessage, errorType);

        logger.log(
          `[hiai-opencode] Session recovery: ${sessionID} — ` +
            `type=${errorType}, hint="${hint}"`,
        );

        // For context-window errors, also log a specific suggestion
        if (errorType === "context_window_exceeded") {
          logger.log(
            `[hiai-opencode] Session recovery: suggest compacting session ${sessionID} or reducing message history`,
          );
        }

        // For fatal errors (auth, server), request user intervention
        if (errorType === "auth") {
          logger.log(
            `[hiai-opencode] Session recovery: auth failure for ${sessionID} — check API keys and provider configuration`,
          );
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        logger.error("[hiai-opencode] Hook error in session-recovery:", err);
      }
    },
  };
}
