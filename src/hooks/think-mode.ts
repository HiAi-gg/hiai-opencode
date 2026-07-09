import type { BobConfig, HookSet } from "../types";

export function createThinkModeHook(_config: BobConfig): HookSet {
  return {
    "chat.params": async (
      _input: Parameters<NonNullable<HookSet["chat.params"]>>[0],
      output: Parameters<NonNullable<HookSet["chat.params"]>>[1],
    ) => {
      if (output?.options && !output.options.thinking) {
        output.options.thinking = { type: "enabled", budgetTokens: 10000 };
      }
    },
  };
}
