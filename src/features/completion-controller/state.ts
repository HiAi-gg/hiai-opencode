export interface SessionRuntime {
  autoContinues: number;
  hasIncompleteTodos: boolean;
  changedFiles: string[];
  /** Monotonic count of successful file mutations observed in this session. */
  changeRevision: number;
  /** Revision covered by the latest Critic verdict. */
  reviewedRevision: number | null;
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
      changeRevision: 0,
      reviewedRevision: null,
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
  // Every mutation invalidates review and diagnostics, even when the path was
  // already tracked. The revision distinguishes new content at the same path.
  s.changeRevision += 1;
  s.criticVerdict = null;
  s.reviewedRevision = null;
  s.lspPending = true;
}

/** Merge a completed child mutation batch into the parent session. */
export function mergeChangedFiles(
  sessionID: string,
  child: Pick<SessionRuntime, "changedFiles" | "changeRevision" | "lspPending">,
  isUiFn: (fp: string) => boolean,
): void {
  const s = get(sessionID);
  for (const fp of child.changedFiles) {
    if (!s.changedFiles.includes(fp)) {
      s.changedFiles.push(fp);
    }
    if (isUiFn(fp)) s.uiChangedSinceReview = true;
  }
  // A child with no mutations (Explore/Critic) preserves approval. Any actual
  // child mutation invalidates it, including a rewrite of an existing path.
  if (child.changeRevision > 0) {
    s.changeRevision += child.changeRevision;
    s.criticVerdict = null;
    s.reviewedRevision = null;
    // The parent may request review only after the worker that made the edits
    // has run diagnostics. Preserve a cleared child gate, but propagate an
    // outstanding one so actor.postStop cannot skip directly to Critic.
    if (child.lspPending) s.lspPending = true;
  }
}

export function recordCriticVerdict(
  sessionID: string,
  verdict: "approved" | "rejected",
): void {
  const s = get(sessionID);
  s.criticVerdict = verdict;
  s.reviewedRevision = s.changeRevision;
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

export function setBlockerFlagged(sessionID: string, flagged: boolean): void {
  get(sessionID).blockerFlagged = flagged;
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
