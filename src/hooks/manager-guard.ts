import type { BobConfig, HookSet } from "../types";
import { BlockingHookError } from "./errors";
import { logger } from "../util/log";

export function createManagerGuard(_config: BobConfig): HookSet {
  return {
    event: async ({ event }: { event: unknown }) => {
      try {
        const evt = event as {
          type?: string;
          properties?: Record<string, unknown>;
        };
        if (evt?.type === "session.idle") {
          const sid = evt.properties?.sessionID as string | undefined;
          const agent = evt.properties?.agent as string | undefined;
          if (sid && agent && agent !== "bob") {
            logger.log(
              `[hiai-opencode] Manager guard: subagent ${agent} idle in session ${sid}`,
            );
          }
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        logger.error("[hiai-opencode] Hook error in manager-guard:", err);
      }
    },
  };
}
