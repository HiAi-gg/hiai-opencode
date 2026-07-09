/**
 * compaction-context-injector.ts — Injects actionable compaction context
 * so that essential state (task IDs, progress markers, loop state,
 * recovery flags) survives session compaction.
 *
 * This hook runs during the experimental.session.compacting lifecycle
 * event and appends context strings that guide the compaction LLM call
 * toward preserving what matters.
 */

import type { BobConfig, HookSet } from "../types";

export function createCompactionContextInjector(_config: BobConfig): HookSet {
  return {
    "experimental.session.compacting": async (
      _input: Parameters<
        NonNullable<HookSet["experimental.session.compacting"]>
      >[0],
      output: Parameters<
        NonNullable<HookSet["experimental.session.compacting"]>
      >[1],
    ) => {
      if (!output?.context) return;

      // Core preservation instructions
      output.context.push(
        "[hiai-opencode] PRESERVE: Task IDs (T1, T2, etc.) and their status (open/in_progress/done/blocked).",
      );
      output.context.push(
        "[hiai-opencode] PRESERVE: Progress markers, completion markers (<promise>DONE</promise>, <CLOSURE>).",
      );
      output.context.push(
        "[hiai-opencode] PRESERVE: Agent names and their current assignments.",
      );
      output.context.push(
        "[hiai-opencode] PRESERVE: Any recovery context or error information if the session previously errored.",
      );
      output.context.push(
        "[hiai-opencode] PRESERVE: File paths that were recently edited or created.",
      );

      // Loop/recovery state markers
      output.context.push(
        "[hiai-opencode] PRESERVE: Loop iteration state if the session was in a multi-step workflow.",
      );
      output.context.push(
        "[hiai-opencode] PRESERVE: Continuation prompts and pending instructions.",
      );
    },
  };
}
