import { fingerprint } from './signals';

export interface SessionRuntime {
  autoContinues: number;
  hasIncompleteTodos: boolean;
  changedFiles: string[];
  reviewedFingerprint: string | null;
  criticVerdict: 'approved' | 'rejected' | null;
  blockerFlagged: boolean;
  uiChangedSinceReview: boolean;
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
    };
    store.set(sessionID, s);
  }
  return s;
}

export function recordChangedFile(sessionID: string, path: string, isUi: boolean): void {
  const s = get(sessionID);
  if (!s.changedFiles.includes(path)) s.changedFiles.push(path);
  if (isUi) s.uiChangedSinceReview = true;
  s.criticVerdict = null;
  s.reviewedFingerprint = null;
}

export function recordCriticVerdict(sessionID: string, verdict: 'approved' | 'rejected'): void {
  const s = get(sessionID);
  s.criticVerdict = verdict;
  s.reviewedFingerprint = fingerprint(s.changedFiles);
  if (verdict === 'approved') s.uiChangedSinceReview = false;
}

export function setHasIncompleteTodos(sessionID: string, hasIncomplete: boolean): void {
  get(sessionID).hasIncompleteTodos = hasIncomplete;
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
