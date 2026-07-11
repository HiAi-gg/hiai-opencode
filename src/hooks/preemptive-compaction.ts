import type { BobConfig, HookSet } from "../types";
import { BlockingHookError } from "./errors";

export function createPreemptiveCompaction(_config: BobConfig): HookSet {
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
        const totalParts = output.messages.reduce(
          (sum, m) => sum + ((m.parts as unknown[])?.length ?? 0),
          0,
        );
        if (totalParts > 200) {
          console.log(
            `[hiai-opencode] High message count (${totalParts}) — consider compacting`,
          );
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        console.error(
          "[hiai-opencode] Hook error in preemptive-compaction:",
          err,
        );
      }
    },
  };
}
