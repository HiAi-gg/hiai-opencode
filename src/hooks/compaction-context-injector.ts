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
import { logger } from "../util/log";

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

        // Minimal, single-line preservation instruction. The previous version
        // pushed seven separate PRESERVE lines per compaction — pure noise
        // that diluted the genuinely useful gate rehydration below. We keep
        // one compact instruction instead.
        output.context.push(
          "[hiai-opencode] Preserve: task IDs+status, progress/completion markers, agent assignments, recent file paths, loop/continuation state.",
        );

        // Re-inject live completion-gate state so the post-compaction agent
        // knows which gates are still blocking completion. These come from
        // the in-memory SessionRuntime, which is NOT compacted.
        const sid = input?.sessionID;
        if (sid) {
          const s = st.get(sid);
          if (s.qualityGateFailed) {
            output.context.push(
              "[hiai-opencode] GATE: quality command (test/lint/typecheck) failed — re-run until exit 0 before completing.",
            );
          }
          if (s.lspPending) {
            output.context.push(
              "[hiai-opencode] GATE: lsp_diagnostics pending on edited files — run it and confirm zero errors before completing.",
            );
          }
          if (s.changedFiles.length > 0 && s.criticVerdict !== "approved") {
            output.context.push(
              "[hiai-opencode] GATE: changes pending Critic review — do not report done until Critic returns APPROVED.",
            );
          }
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        logger.error(
          "[hiai-opencode] Hook error in compaction-context-injector:",
          err,
        );
      }
    },
  };
}
