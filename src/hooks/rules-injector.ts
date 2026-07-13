import type { BobConfig, HookSet } from "../types";
import { BlockingHookError } from "./errors";
import { logger } from "../util/log";

export function createRulesInjector(_config: BobConfig): HookSet {
  return {
    "experimental.chat.system.transform": async (_input, output) => {
      try {
        output.system.push(
          "[hiai-opencode] Follow AGENTS.md rules in all file operations.",
        );
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        logger.error("[hiai-opencode] Hook error in rules-injector:", err);
      }
    },
  };
}
