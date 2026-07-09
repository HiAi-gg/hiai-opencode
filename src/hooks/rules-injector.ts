import type { BobConfig, HookSet } from "../types";

export function createRulesInjector(_config: BobConfig): HookSet {
  return {
    "experimental.chat.system.transform": async (_input, output) => {
      output.system.push(
        "[hiai-opencode] Follow AGENTS.md rules in all file operations.",
      );
    },
  };
}
