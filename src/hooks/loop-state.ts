/**
 * loop-state.ts — Shared loop/continuation state for the loop/recovery subsystem.
 *
 * Provides in-memory per-session state tracking for loop iterations,
 * completion markers, error classification, and continuation prompts.
 * Designed as the shared backbone for loop, todo-continuation, and recovery hooks.
 */

// ── Types ──

export interface LoopSessionState {
  /** Number of loop iterations executed */
  iterations: number;
  /** Max iterations before giving up */
  maxIterations: number;
  /** Cooldown between loop cycles (ms) */
  cooldownMs: number;
  /** Monotonic timestamp of last loop cycle */
  lastLoopTime: number;
  /** Whether a completion marker was detected */
  isCompleted: boolean;
  /** Whether known incomplete tasks exist */
  hasIncompleteTasks: boolean;
  /** Last error string */
  lastError: string | null;
  /** Classified error type */
  lastErrorType: ErrorType | null;
  /** Continuation prompt for the next cycle */
  continuationPrompt: string | null;
  /** Whether a continuation instruction has been injected */
  continuationInjected: boolean;
}

export type ErrorType =
  | 'rate_limit'
  | 'auth'
  | 'timeout'
  | 'empty_response'
  | 'server_error'
  | 'context_window_exceeded'
  | 'unknown';

// ── Defaults ──

const DEFAULT_MAX_ITERATIONS = 10;
const DEFAULT_COOLDOWN_MS = 10_000;

// ── Store ──

const store = new Map<string, LoopSessionState>();

// ── State accessors ──

export function get(sessionID: string): LoopSessionState {
  let s = store.get(sessionID);
  if (!s) {
    s = {
      iterations: 0,
      maxIterations: DEFAULT_MAX_ITERATIONS,
      cooldownMs: DEFAULT_COOLDOWN_MS,
      lastLoopTime: 0,
      isCompleted: false,
      hasIncompleteTasks: false,
      lastError: null,
      lastErrorType: null,
      continuationPrompt: null,
      continuationInjected: false,
    };
    store.set(sessionID, s);
  }
  return s;
}

/** Delete all state for a session (cleanup on stop/deleted/reset). */
export function reset(sessionID: string): void {
  store.delete(sessionID);
}

export function markCompleted(sessionID: string): void {
  const s = get(sessionID);
  s.isCompleted = true;
  s.lastLoopTime = Date.now();
}

export function markError(sessionID: string, error: string, errorType: ErrorType): void {
  const s = get(sessionID);
  s.lastError = error;
  s.lastErrorType = errorType;
  // Reset iteration count on error so recovery can retry fresh
  s.iterations = 0;
}

export function setContinuationPrompt(sessionID: string, prompt: string): void {
  const s = get(sessionID);
  s.continuationPrompt = prompt;
  s.continuationInjected = false;
}

export function recordIteration(sessionID: string): void {
  const s = get(sessionID);
  s.iterations++;
  s.lastLoopTime = Date.now();
}

export function setHasIncompleteTasks(sessionID: string, hasIncomplete: boolean): void {
  get(sessionID).hasIncompleteTasks = hasIncomplete;
}

export function markContinuationInjected(sessionID: string): void {
  get(sessionID).continuationInjected = true;
}

/** True if the session should proceed with another loop cycle. */
export function shouldContinue(sessionID: string): boolean {
  const s = get(sessionID);
  if (s.isCompleted) return false;
  if (s.iterations >= s.maxIterations) return false;
  const now = Date.now();
  if (now - s.lastLoopTime < s.cooldownMs) return false;
  return true;
}

// ── Pure helper functions (no side effects, directly testable) ──

/** Detect <promise>DONE</promise> or <CLOSURE> with readiness "done". */
export function detectCompletionMarker(text: string): boolean {
  if (/<promise>\s*DONE\s*<\/promise>/i.test(text)) return true;
  try {
    const match = text.match(/<CLOSURE>([\s\S]*?)<\/CLOSURE>/);
    if (!match) return false;
    const data = JSON.parse(match[1].trim());
    return data?.readiness === 'done';
  } catch {
    return false;
  }
}

/** Classify an error message into a known type. */
export function classifyError(errorMessage: string): ErrorType {
  const msg = errorMessage.toLowerCase();
  if (/\b(rate_limit|rate limit|429)\b/.test(msg)) return 'rate_limit';
  if (/\b(auth|unauthorized|401|403)\b/.test(msg)) return 'auth';
  if (/\b(timeout|timed out|408)\b/.test(msg)) return 'timeout';
  if (/\b(empty|no response)\b/.test(msg)) return 'empty_response';
  if (/\b(context_length_exceeded|max_tokens|token limit|context window)\b/.test(msg))
    return 'context_window_exceeded';
  if (/\b(50[0-9]|server error|internal)\b/.test(msg)) return 'server_error';
  return 'unknown';
}

/** Build a human-friendly recovery hint for a given error type. */
export function buildRecoveryHint(errorType: ErrorType): string {
  switch (errorType) {
    case 'rate_limit':
      return 'Rate limited — reduce request frequency or wait before retrying';
    case 'auth':
      return 'Authentication error — check API keys and provider configuration';
    case 'timeout':
      return 'Request timed out — retry with smaller context or simpler prompt';
    case 'empty_response':
      return 'Empty response — the model returned no content; retry with a more specific prompt';
    case 'context_window_exceeded':
      return 'Context window exceeded — compact the session or reduce message history';
    case 'server_error':
      return 'Server error — retry after a brief delay';
    case 'unknown':
      return 'Unexpected error — check logs for details';
  }
}

/** Build a continuation prompt indicating remaining tasks. */
export function buildContinuationPrompt(sessionID: string, incompleteTasks: number): string {
  return `[hiai-opencode] Session ${sessionID} has ${incompleteTasks} incomplete task(s). Continue working on remaining items.`;
}

/** Build an error-recovery context string for compaction injection. */
export function buildRecoveryContext(hint: string): string {
  return `[hiai-opencode] RECOVERY: ${hint}`;
}
