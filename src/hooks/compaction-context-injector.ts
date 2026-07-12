/**
 * compaction-context-injector.ts — Injects actionable compaction context
 * so that essential state (task IDs, progress markers, loop state,
 * recovery flags, completion gates) survives session compaction.
 *
 * This hook runs during the experimental.session.compacting lifecycle
 * event and appends context strings that guide the compaction LLM call
 * toward preserving what matters.
 *
 * Note: the in-memory completion-controller state (qualityGateFailed,
 * lspPending, criticVerdict) is keyed by sessionID and therefore survives
 * compaction automatically — but the agent's *awareness* of these gates
 * lives in message history, which compaction discards. We re-inject the
 * current gate flags here so the post-compaction agent still knows it
 * must re-run a failing quality command or pending lsp_diagnostics before
 * it can complete.
 */

import type { BobConfig, HookSet } from "../types";
import * as st from "../features/completion-controller/state";
import { BlockingHookError } from "./errors";

export function createCompactionContextInjector(_config: BobConfig): HookSet {
  return {
    "experimental.session.compacting": async (
      input: Parameters<
        NonNullable<HookSet["experimental.session.compacting"]>
      >[0],
      output: Parameters<
        NonNullable<HookSet["experimental.session.compacting"]>
      >[1],
    ) => {
      try {
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

        // Re-inject live completion-gate state so the post-compaction agent
        // knows which gates are still blocking completion. These come from
        // the in-memory SessionRuntime, which is NOT compacted.
        const sid = input?.sessionID;
        if (sid) {
          const s = st.get(sid);
          if (s.qualityGateFailed) {
            output.context.push(
              "[hiai-opencode] GATE: A quality command (test/lint/typecheck) failed earlier — you MUST re-run it until exit 0 before completing.",
            );
          }
          if (s.lspPending) {
            output.context.push(
              "[hiai-opencode] GATE: lsp_diagnostics is pending on edited files — you MUST run lsp_diagnostics and confirm zero errors before completing.",
            );
          }
          if (s.changedFiles.length > 0 && s.criticVerdict !== "approved") {
            output.context.push(
              "[hiai-opencode] GATE: Changes are pending Critic review — do not report the task done until Critic returns APPROVED.",
            );
          }
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        console.error(
          "[hiai-opencode] Hook error in compaction-context-injector:",
          err,
        );
      }
    },
  };
}
