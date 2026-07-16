import type { BobConfig, HookSet } from "../types";
import { BlockingHookError } from "./errors";
import { logger } from "../util/log";

export function createJsonErrorRecovery(_config: BobConfig): HookSet {
  return {
    "tool.execute.after": async (_input, output) => {
      try {
        if (
          output.output?.includes("JSON") &&
          (output.output.includes("parse error") ||
            output.output.includes("Unexpected token") ||
            output.output.includes("SyntaxError"))
        ) {
          output.output +=
            "\n\n[hiai-opencode] JSON parse error detected. Re-read the file and ensure valid JSON before retrying.";
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        logger.error("[hiai-opencode] Hook error in json-error-recovery:", err);
      }
    },
  };
}
