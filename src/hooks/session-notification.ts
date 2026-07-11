import type { BobConfig, HookSet } from "../types";
import { BlockingHookError } from "./errors";

export function createSessionNotification(_config: BobConfig): HookSet {
  return {
    event: async ({ event }: { event: unknown }) => {
      try {
        const evt = event as {
          type?: string;
          properties?: Record<string, unknown>;
        };
        if (evt?.type === "session.idle" || evt?.type === "session.question") {
          const sid = evt.properties?.sessionID as string | undefined;
          console.log(`[hiai-opencode] Session event: ${evt?.type} (${sid})`);
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        console.error(
          "[hiai-opencode] Hook error in session-notification:",
          err,
        );
      }
    },
  };
}
