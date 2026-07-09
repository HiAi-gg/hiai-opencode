import type { BobConfig, HookSet } from "../types";

export function createContextWindowMonitor(_config: BobConfig): HookSet {
  return {
    "experimental.chat.system.transform": async (_input, output) => {
      const ctx = output.system.join("\n").length;
      const maxCtx = 128_000;
      const ratio = ctx / maxCtx;
      if (ratio > 0.7) {
        output.system.push(
          `[hiai-opencode] WARNING: Context at ${Math.round(ratio * 100)}% capacity. Consider compacting or finishing soon.`,
        );
      }
    },
  };
}
