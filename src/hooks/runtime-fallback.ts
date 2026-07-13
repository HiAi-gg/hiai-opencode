import type { BobConfig, HookSet } from "../types";
import { BlockingHookError } from "./errors";
import { logger } from "../util/log";

export function createRuntimeFallback(_config: BobConfig): HookSet {
  return {
    "chat.params": async (_input, output) => {
      try {
        if (output.maxOutputTokens && output.maxOutputTokens > 32_000) {
          output.maxOutputTokens = 32_000;
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        logger.error("[hiai-opencode] Hook error in runtime-fallback:", err);
      }
    },
  };
}
