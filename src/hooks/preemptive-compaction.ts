import type { BobConfig, HookSet } from "../types";
import { BlockingHookError } from "./errors";
import { logger } from "../util/log";

// Per-session debounce so the "consider compacting" hint is not re-logged on
// every single transform while a large session is mid-flight.
const lastWarnAt = new Map<string, number>();
const WARN_COOLDOWN_MS = 60_000;

export function createPreemptiveCompaction(_config: BobConfig): HookSet {
  return {
    "experimental.chat.messages.transform": async (
      _input: Parameters<
        NonNullable<HookSet["experimental.chat.messages.transform"]>
      >[0],
      output: Parameters<
        NonNullable<HookSet["experimental.chat.messages.transform"]>
      >[1],
    ) => {
      try {
        const totalParts = output.messages.reduce(
          (sum, m) => sum + ((m.parts as unknown[])?.length ?? 0),
          0,
        );
        if (totalParts > 200) {
          const sid =
            (output as { sessionID?: string }).sessionID ?? "unknown";
          const now = Date.now();
          const prev = lastWarnAt.get(sid);
          if (prev === undefined || now - prev >= WARN_COOLDOWN_MS) {
            lastWarnAt.set(sid, now);
            logger.log(
              `[hiai-opencode] High message count (${totalParts}) — consider compacting`,
            );
          }
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        logger.error(
          "[hiai-opencode] Hook error in preemptive-compaction:",
          err,
        );
      }
    },

    dispose: async () => {
      lastWarnAt.clear();
    },
  };
}
