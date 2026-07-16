import type { BobConfig, HookSet } from "../types";
import { BlockingHookError } from "./errors";
import { logger } from "../util/log";

export function createAgentUsageReminder(_config: BobConfig): HookSet {
  return {
    "tool.execute.after": async () => {
      try {
        // Intentionally silent. Tool results are a TUI-visible transport and
        // must never be decorated with plugin diagnostics or reminders.
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        logger.error(
          "[hiai-opencode] Hook error in agent-usage-reminder:",
          err,
        );
      }
    },
    dispose: async () => {},
  };
}
