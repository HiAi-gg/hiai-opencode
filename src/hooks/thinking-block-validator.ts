import type { BobConfig, HookSet } from "../types";

export function createThinkingBlockValidator(_config: BobConfig): HookSet {
  return {
    "experimental.chat.messages.transform": async (
      _input: Parameters<
        NonNullable<HookSet["experimental.chat.messages.transform"]>
      >[0],
      output: Parameters<
        NonNullable<HookSet["experimental.chat.messages.transform"]>
      >[1],
    ) => {
      for (const msg of output.messages) {
        const parts = msg.parts as Array<Record<string, unknown>>;
        for (const part of parts) {
          if (part.type === "thinking") {
            if (
              typeof part.thinking !== "string" ||
              part.thinking.length === 0
            ) {
              part.thinking = "[empty thinking block]";
            }
          }
        }
      }
    },
  };
}
