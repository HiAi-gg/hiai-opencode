import type { BobConfig, HookSet } from "../types";

export function createDirectoryAgentsInjector(_config: BobConfig): HookSet {
  return {
    "experimental.chat.system.transform": async (_input, output) => {
      output.system.push(
        "[hiai-opencode] When operating in project directories, check for AGENTS.md rules.",
      );
    },
  };
}
