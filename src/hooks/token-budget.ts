import type { BobConfig, HookSet } from "../types";
import { BlockingHookError } from "./errors";

export function createTokenBudgetHook(_config: BobConfig): HookSet {
  return {
    "experimental.chat.messages.transform": async (
      _input: Parameters<
        NonNullable<HookSet["experimental.chat.messages.transform"]>
      >[0],
      output: Parameters<
        NonNullable<HookSet["experimental.chat.messages.transform"]>
      >[1],
    ) => {
      try {
        if (output?.messages?.length > 100) {
          console.log("[hiai-opencode] Token budget: high message count");
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        console.error("[hiai-opencode] Hook error in token-budget:", err);
      }
    },
  };
}
