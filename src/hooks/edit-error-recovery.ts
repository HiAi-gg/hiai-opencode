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
          // Single-line recovery hint. The original error text is preserved in
          // output.output; we only append a concise, actionable directive.
          output.output +=
            "\n[hiai-opencode] edit failed: re-read the file, then retry with the exact current content.";
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        logger.error("[hiai-opencode] Hook error in edit-error-recovery:", err);
      }
    },
  };
}
