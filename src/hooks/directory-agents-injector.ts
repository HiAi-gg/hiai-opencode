import type { BobConfig, HookSet } from "../types";
import { BlockingHookError } from "./errors";

export function createDirectoryAgentsInjector(_config: BobConfig): HookSet {
  return {
    "experimental.chat.system.transform": async (_input, output) => {
      try {
        output.system.push(
          "[hiai-opencode] When operating in project directories, check for AGENTS.md rules.",
        );
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        console.error(
          "[hiai-opencode] Hook error in directory-agents-injector:",
          err,
        );
      }
    },
  };
}
