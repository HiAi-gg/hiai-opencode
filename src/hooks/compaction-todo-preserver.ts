import type { BobConfig, HookSet } from "../types";
import { BlockingHookError } from "./errors";

export function createCompactionTodoPreserverHook(_config: BobConfig): HookSet {
  return {
    "experimental.session.compacting": async (
      _input: Parameters<
        NonNullable<HookSet["experimental.session.compacting"]>
      >[0],
      output: Parameters<
        NonNullable<HookSet["experimental.session.compacting"]>
      >[1],
    ) => {
      try {
        if (output?.context) {
          output.context.push(
            "[hiai-opencode] Preserve all TODO items during compaction.",
          );
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        console.error(
          "[hiai-opencode] Hook error in compaction-todo-preserver:",
          err,
        );
      }
    },
  };
}
