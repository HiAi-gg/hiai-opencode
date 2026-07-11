import { getToolSetting } from "../config";
import type { BobConfig, HookSet } from "../types";
import { BlockingHookError } from "./errors";

export function createThinkModeHook(_config: BobConfig): HookSet {
  return {
    "chat.params": async (
      _input: Parameters<NonNullable<HookSet["chat.params"]>>[0],
      output: Parameters<NonNullable<HookSet["chat.params"]>>[1],
    ) => {
      try {
        if (output?.options && !output.options.thinking) {
          output.options.thinking = {
            type: "enabled",
            budgetTokens: getToolSetting("thinking_budget_fallback", 10000),
          };
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        console.error("[hiai-opencode] Hook error in think-mode:", err);
      }
    },
  };
}
