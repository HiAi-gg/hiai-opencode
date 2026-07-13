import type { BobConfig, HookSet } from "../types";
import { BlockingHookError } from "./errors";
import { logger } from "../util/log";

/** Max number of sessions tracked before oldest entries are evicted. */
const MAX_SESSIONS = 200;

export function createWriteExistingFileGuard(_config: BobConfig): HookSet {
  const recentReads = new Map<string, Set<string>>();

  // Evict the oldest tracked sessions when the cap is exceeded.
  // Map preserves insertion order, so the first keys are the oldest.
  const enforceCap = () => {
    while (recentReads.size > MAX_SESSIONS) {
      const oldest = recentReads.keys().next().value;
      if (oldest === undefined) break;
      recentReads.delete(oldest);
    }
  };

  return {
    "tool.execute.before": async (input, output) => {
      try {
        const sid = input.sessionID;
        if (input.tool === "read") {
          const args = output.args as { filePath?: string };
          if (args?.filePath) {
            let reads = recentReads.get(sid);
            if (!reads) {
              reads = new Set();
              recentReads.set(sid, reads);
            }
            reads.add(args.filePath);
            // Refresh recency so active sessions are evicted last.
            recentReads.delete(sid);
            recentReads.set(sid, reads);
            enforceCap();
          }
        }
        if (input.tool === "write" || input.tool === "edit") {
          const args = output.args as { filePath?: string; path?: string };
          const fp = args?.filePath ?? args?.path;
          if (fp && !recentReads.get(sid)?.has(fp)) {
            logger.log(`[hiai-opencode] Write/edit without prior Read: ${fp}`);
          }
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        logger.error(
          "[hiai-opencode] Hook error in write-existing-file-guard:",
          err,
        );
      }
    },
    event: async ({ event }: { event: unknown }) => {
      try {
        const evt = event as {
          type?: string;
          properties?: Record<string, unknown>;
        };
        if (evt?.type === "session.deleted") {
          const sessionID = evt.properties?.sessionID as string | undefined;
          if (sessionID) recentReads.delete(sessionID);
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        logger.error(
          "[hiai-opencode] Hook error in write-existing-file-guard:",
          err,
        );
      }
    },
    dispose: async () => {
      recentReads.clear();
    },
  };
}
