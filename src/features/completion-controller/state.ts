import { fingerprint } from "./signals";

export interface SessionRuntime {
  autoContinues: number;
  hasIncompleteTodos: boolean;
  changedFiles: string[];
  reviewedFingerprint: string | null;
  criticVerdict: "approved" | "rejected" | null;
  blockerFlagged: boolean;
  uiChangedSinceReview: boolean;
  /** True when a quality command (test/lint/typecheck) failed in-session. */
  qualityGateFailed: boolean;
  /** True when an edit was made without a subsequent lsp_diagnostics call. */
  lspPending: boolean;
}

const store = new Map<string, SessionRuntime>();

export function get(sessionID: string): SessionRuntime {
  let s = store.get(sessionID);
  if (!s) {
    s = {
      autoContinues: 0,
      hasIncompleteTodos: false,
      changedFiles: [],
      reviewedFingerprint: null,
      criticVerdict: null,
      blockerFlagged: false,
      uiChangedSinceReview: false,
      qualityGateFailed: false,
      lspPending: false,
    };
    store.set(sessionID, s);
  }
  return s;
}

export function recordChangedFile(
  sessionID: string,
  path: string,
  isUi: boolean,
): void {
  const s = get(sessionID);
  const norm = path.replace(/\\/g, "/");
  const isNewFile = !s.changedFiles.includes(norm);
  if (isNewFile) s.changedFiles.push(norm);
  if (isUi) s.uiChangedSinceReview = true;
  // Only a genuinely NEW file invalidates a prior review. Rewriting a file that
  // was already reviewed (e.g. an auto-fix re-saving the same path) must NOT
  // reset criticVerdict/reviewedFingerprint — otherwise every post-review touch
  // re-triggers a fresh Critic cycle and the session loops review→build→review
  // until maxAutoContinues (the "Bob keeps finishing repeatedly" bug).
  if (isNewFile) {
    s.criticVerdict = null;
    s.reviewedFingerprint = null;
    // An edit means lsp_diagnostics is now pending — the agent must run it
    // before the completion controller will allow a stop.
    s.lspPending = true;
  }
}

/** Merge changed files from a child session into the parent without re-tripping gates. */
export function mergeChangedFiles(
  sessionID: string,
  files: string[],
  isUiFn: (fp: string) => boolean,
): void {
  const s = get(sessionID);
  let added = false;
  for (const fp of files) {
    if (!s.changedFiles.includes(fp)) {
      s.changedFiles.push(fp);
      added = true;
    }
    if (isUiFn(fp)) s.uiChangedSinceReview = true;
  }
  // Merging inherited changes invalidates a prior review ONLY when new files
  // actually arrived. A child that changed nothing (e.g. an explore or a
  // finished critic) must NOT reset the parent's approved verdict — otherwise
  // every subagent postStop re-triggers a fresh Critic cycle until the cap.
  // This must NOT flip the per-session quality/lsp gates — those track the
  // parent's own edits.
  if (added) {
    s.criticVerdict = null;
    s.reviewedFingerprint = null;
  }
}

export function recordCriticVerdict(
  sessionID: string,
  verdict: "approved" | "rejected",
): void {
  const s = get(sessionID);
  s.criticVerdict = verdict;
  s.reviewedFingerprint = fingerprint(s.changedFiles);
  if (verdict === "approved") {
    s.uiChangedSinceReview = false;
    // A Critic approval implies the reviewer saw clean state — clear the
    // per-edit gates so we don't re-block on already-reviewed work.
    s.qualityGateFailed = false;
    s.lspPending = false;
  }
}

export function setHasIncompleteTodos(
  sessionID: string,
  hasIncomplete: boolean,
): void {
  get(sessionID).hasIncompleteTodos = hasIncomplete;
}

/** Mark that a quality command failed in this session (blocks completion). */
export function setQualityGateFailed(sessionID: string, failed: boolean): void {
  get(sessionID).qualityGateFailed = failed;
}

/** Mark that an edit was made and lsp_diagnostics is now pending. */
export function setLspPending(sessionID: string, pending: boolean): void {
  get(sessionID).lspPending = pending;
}

export function resetForUser(sessionID: string): void {
  const s = get(sessionID);
  s.autoContinues = 0;
  s.blockerFlagged = false;
}

export function clear(sessionID: string): void {
  store.delete(sessionID);
}

export function currentFingerprint(s: SessionRuntime): string {
  return fingerprint(s.changedFiles);
}
