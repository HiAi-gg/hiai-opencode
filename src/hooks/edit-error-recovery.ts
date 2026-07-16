import type { BobConfig, HookSet } from "../types";
import { BlockingHookError } from "./errors";
import { logger } from "../util/log";

export function createEditErrorRecovery(_config: BobConfig): HookSet {
  return {
    "tool.execute.after": async (input, output) => {
      try {
        if (
          input.tool === "edit" &&
          (output.output?.includes("oldString not found") ||
            output.output?.includes("No match"))
        ) {
          output.output +=
            "\n\n[hiai-opencode] Edit target not found. Re-read the file first, then retry with the exact current content.";
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        logger.error("[hiai-opencode] Hook error in edit-error-recovery:", err);
      }
    },
  };
}
