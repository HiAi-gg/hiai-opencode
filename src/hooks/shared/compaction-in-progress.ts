/**
 * Intentionally module-global for cross-hook coordination.
 * Used by: preemptive-compaction, anthropic-context-window-limit-recovery,
 * compaction-context-injector, and todo-continuation-enforcer.
 */
const compactionInProgress = new Set<string>();

export function isCompacting(sessionID: string): boolean {
  return compactionInProgress.has(sessionID);
}

export function markCompacting(sessionID: string): void {
  compactionInProgress.add(sessionID);
}

export function markCompactionDone(sessionID: string): void {
  compactionInProgress.delete(sessionID);
}

export function clearSession(sessionID: string): void {
  compactionInProgress.delete(sessionID);
}
