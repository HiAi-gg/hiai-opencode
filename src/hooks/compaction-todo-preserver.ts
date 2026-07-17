import type { BobConfig, HookSet } from "../types";
import { BlockingHookError } from "./errors";
import { logger } from "../util/log";

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
          // Single minimal line. The verbose "Preserve all TODO items during
          // compaction." boilerplate was redundant with the context-injector's
          // preservation instruction; keep only a compact reminder.
          output.context.push(
            "[hiai-opencode] Preserve open TODO items and their status.",
          );
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        logger.error(
          "[hiai-opencode] Hook error in compaction-todo-preserver:",
          err,
        );
      }
    },
  };
}
