export interface CompletionState {
  autoContinues: number;
  maxAutoContinues: number;
  hasIncompleteTodos: boolean;
  changedFiles: string[];
  currentFingerprint: string;
  reviewedFingerprint: string | null;
  criticVerdict: "approved" | "rejected" | null;
  blockerFlagged: boolean;
  uiChanged: boolean;
  requireCritic: boolean;
  /** A quality command (test/lint/typecheck) failed in-session. */
  qualityGateFailed: boolean;
  /** An edit was made without a subsequent lsp_diagnostics call. */
  lspPending: boolean;
}

export type CompletionAction =
  | { kind: "stop"; reason: "blocked" | "done" | "cap" }
  | { kind: "continue"; prompt: string }
  | { kind: "review"; prompt: string };

const CONTINUE_PROMPT =
  "Continue with the remaining TODO items until all are complete. Do not stop early.";
const FIX_PROMPT =
  "The Critic REJECTED the current changes. Address every point it raised, then continue.";
const QUALITY_GATE_PROMPT =
  "A quality gate (test/lint/typecheck) failed. Fix the reported errors and re-run the failing command until it exits 0 before requesting review.";
const LSP_PENDING_PROMPT =
  "You edited files without running lsp_diagnostics afterwards. Run lsp_diagnostics on every changed file and confirm zero errors before requesting review.";
const REVIEW_PROMPT =
  'All TODOs are done. Delegate to Critic (task subagent_type="critic") to review the changes; ' +
  "do not finish until Critic returns APPROVED.";
const REVIEW_VISION_PROMPT = `${REVIEW_PROMPT} UI files changed — Critic MUST delegate a Vision browser verification task before approving. Vision will navigate, set viewport, screenshot, inspect console, and report evidence.`;

export function decide(s: CompletionState): CompletionAction {
  if (s.blockerFlagged) return { kind: "stop", reason: "blocked" };

  const atCap = s.autoContinues >= s.maxAutoContinues;

  if (s.hasIncompleteTodos) {
    return atCap
      ? { kind: "stop", reason: "cap" }
      : { kind: "continue", prompt: CONTINUE_PROMPT };
  }

  // Hard gates that must be cleared before any review/stop: a failed quality
  // command or a pending lsp_diagnostics run means the agent is not done.
  if (s.qualityGateFailed) {
    return atCap
      ? { kind: "stop", reason: "cap" }
      : { kind: "continue", prompt: QUALITY_GATE_PROMPT };
  }
  if (s.lspPending) {
    return atCap
      ? { kind: "stop", reason: "cap" }
      : { kind: "continue", prompt: LSP_PENDING_PROMPT };
  }

  if (!s.requireCritic || s.changedFiles.length === 0) {
    return { kind: "stop", reason: "done" };
  }

  const verdictMatchesDiff = s.reviewedFingerprint === s.currentFingerprint;
  if (s.criticVerdict === "approved" && verdictMatchesDiff) {
    return { kind: "stop", reason: "done" };
  }
  if (s.criticVerdict === "rejected" && verdictMatchesDiff) {
    return atCap
      ? { kind: "stop", reason: "cap" }
      : { kind: "continue", prompt: FIX_PROMPT };
  }
  return atCap
    ? { kind: "stop", reason: "cap" }
    : {
        kind: "review",
        prompt: s.uiChanged ? REVIEW_VISION_PROMPT : REVIEW_PROMPT,
      };
}
