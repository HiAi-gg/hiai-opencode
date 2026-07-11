import type { BobConfig, HookSet } from "../types";
import { BlockingHookError } from "./errors";

export function createRuntimeFallback(_config: BobConfig): HookSet {
  return {
    "chat.params": async (_input, output) => {
      try {
        if (output.maxOutputTokens && output.maxOutputTokens > 32_000) {
          output.maxOutputTokens = 32_000;
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        console.error("[hiai-opencode] Hook error in runtime-fallback:", err);
      }
    },
  };
}
