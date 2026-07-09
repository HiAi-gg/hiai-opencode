import type { BobConfig, HookSet } from "../types";

export function createReasoningContentCacheHook(_config: BobConfig): HookSet {
  return {
    "experimental.chat.messages.transform": async (
      _input: Parameters<
        NonNullable<HookSet["experimental.chat.messages.transform"]>
      >[0],
      output: Parameters<
        NonNullable<HookSet["experimental.chat.messages.transform"]>
      >[1],
    ) => {
      if (output?.messages) {
        for (const msg of output.messages) {
          if (!msg.parts) continue;
          for (const part of msg.parts) {
            if (
              part &&
              typeof part === "object" &&
              (part as { type?: unknown }).type === "reasoning"
            ) {
              (part as Record<string, unknown>)._preserved = true;
            }
          }
        }
      }
    },
  };
}
