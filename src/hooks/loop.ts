/**
 * loop.ts — Main loop hook.
 *
 * Drives the session-idle loop: tracks iterations, enforces cooldown,
 * detects completion markers, and orchestrates continuation prompts.
 */

import type { PluginInput } from "@opencode-ai/plugin";
import { get as getCompletion } from "../features/completion-controller/state";
import { getPlanLifecycle } from "../features/plan-lifecycle";
import type { BobConfig, HookSet } from "../types";
import { logger } from "../util/log";
import { BlockingHookError } from "./errors";
import {
  detectCompletionMarker,
  get,
  recentlyNativelyContinued,
  recordIteration,
  reset,
  setContinuationPrompt,
  shouldContinue,
} from "./loop-state";

let client: PluginInput["client"] | null = null;

export function setLoopClient(c: PluginInput["client"] | null) {
  client = c;
}

export const AUTONOMOUS_CONTINUE =
  "You are the orchestrator (Bob/Manager), not Plan. The plan is FROZEN — do NOT call Plan again, do NOT stay in planning, do NOT wait for the user. Dispatch the next wave NOW: concurrent task() to each step's annotated owner (build/general/designer/writer/vision/explore). Update todowrite. Call delivery Critic only after every implementation wave is done.";

/** Only Bob/Manager execute a frozen plan. Direct Plan cannot dispatch waves. */
export function isWaveExecutorAgent(
  agent?: string | null,
  _mode?: string | null,
): boolean {
  const a = (agent ?? "").toLowerCase();
  if (!a) return true;
  return a === "bob" || a === "manager";
}

export function lastMessageIsTerminalBlock(text: string): boolean {
  if (!text) return false;
  if (/\*\*Status:\*\*\s*blocked\b/i.test(text)) return true;
  if (/\bStatus:\s*blocked\b/i.test(text)) return true;
  if (/^Статус:\s*blocked\b/im.test(text)) return true;
  if (
    /["']readiness["']\s*:\s*["']reject["']/i.test(text) &&
    /\bblocked\b/i.test(text)
  ) {
    return true;
  }
  return false;
}

export function workRemaining(sessionID: string): boolean {
  const plan = getPlanLifecycle(sessionID);
  if (plan.status === "frozen" || plan.status === "executing") return true;
  if (getCompletion(sessionID).hasIncompleteTodos) return true;
  if (get(sessionID).hasIncompleteTasks) return true;
  return false;
}

/** Short, stable, non-leaky identifier for logs/prompts (no raw session id). */
function shortId(sessionID: string): string {
  if (sessionID.length <= 12) return sessionID;
  return `${sessionID.slice(0, 6)}…${sessionID.slice(-4)}`;
}

export function createLoopHook(config: BobConfig): HookSet {
  const loopCfg = config.loop ?? {};
  const enabled = loopCfg.enabled !== false;
  const maxIterations =
    typeof loopCfg.max_auto_continues === "number"
      ? loopCfg.max_auto_continues
      : typeof loopCfg.maxIterations === "number"
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
            setContinuationPrompt(
              sessionID,
              `Session ${shortId(sessionID)} active (iter ${s.iterations}). Continue.`,
            );

            const nativeWindow = (s.cooldownMs || 1500) * 3;
            if (recentlyNativelyContinued(sessionID, nativeWindow)) {
              logger.log(
                `[hiai-opencode] loop: skip_prompt native_continue ${shortId(sessionID)}`,
              );
            } else if (enabled && workRemaining(sessionID) && client) {
              try {
                const ses = await client.session.get({
                  path: { id: sessionID },
                });
                const session = ses.data as
                  | {
                      parentID?: string;
                      agent?: string;
                      mode?: string;
                    }
                  | undefined;
                if (session?.parentID) break;
                if (!isWaveExecutorAgent(session?.agent, session?.mode)) {
                  logger.log(
                    `[hiai-opencode] loop: skip_prompt not_executor ${shortId(sessionID)} agent=${session?.agent ?? "unknown"}`,
                  );
                  break;
                }
                await client.session.prompt({
                  path: { id: sessionID },
                  body: {
                    parts: [{ type: "text", text: AUTONOMOUS_CONTINUE }],
                    noReply: false,
                  },
                } as never);
                logger.log(
                  `[hiai-opencode] loop: autonomous continue ${shortId(sessionID)} iter ${get(sessionID).iterations}`,
                );
              } catch (err) {
                logger.error(
                  "[hiai-opencode] loop: failed to continue session:",
                  err,
                );
              }
            }
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
