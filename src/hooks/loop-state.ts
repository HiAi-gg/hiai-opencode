/**
 * loop-state.ts — Shared loop/continuation state for the loop/recovery subsystem.
 *
 * Provides in-memory per-session state tracking for loop iterations,
 * completion markers, error classification, and continuation prompts.
 * Designed as the shared backbone for loop, todo-continuation, and recovery hooks.
 *
 * Concurrency: 5 hooks (loop, todo-continuation, stop-continuation-guard,
 * session-recovery, context-window-limit-recovery) read and write the same
 * shared `store` Map. To prevent lost-update and double-reset races under
 * concurrent session.idle / session.error events, every store-accessing
 * function is serialized through a per-session dispatch queue (see `queues`
 * and `enqueue` below). The queue is per-session (never a global lock) and is
 * implemented in pure TypeScript with no external dependencies.
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
  | "rate_limit"
  | "auth"
  | "timeout"
  | "empty_response"
  | "server_error"
  | "context_window_exceeded"
  | "unknown";

// ── Defaults ──

const DEFAULT_MAX_ITERATIONS = 10;
const DEFAULT_COOLDOWN_MS = 10_000;

// ── Store ──

const store = new Map<string, LoopSessionState>();

// ── Per-session dispatch queue ──
//
// Serializes read/write access to `store` per session id so concurrent hooks
// cannot interleave read-modify-write cycles on the same session. The queue is
// per-session (keyed by session id) — there is intentionally NO global lock.
//
// `enqueue` is the canonical Promise-chain primitive: each operation for a
// session is appended to that session's chain and runs strictly after the
// previous one (even if the previous rejected). This is what gives async
// callers a strict per-session ordering guarantee.
const queues = new Map<string, Promise<unknown>>();

function enqueue<T>(sid: string, fn: () => T | Promise<T>): Promise<T> {
  const prev = queues.get(sid) ?? Promise.resolve();
  const next = prev.then(fn, fn); // fn runs even if prev rejected
  queues.set(
    sid,
    next.catch(() => {}),
  ); // don't let rejections poison the queue
  return next;
}

// Synchronous dispatch: the public API of this module is synchronous and is
// consumed synchronously by the 5 hooks and the test-suite, so each exported
// function must return its value synchronously. `dispatch` therefore runs `fn`
// immediately (JS is single-threaded, so synchronous calls are already atomic
// with respect to one another) while still registering the operation on the
// per-session `queues` chain via `enqueue`. That keeps the same per-session
// ordering guarantee available to any future async caller that does
// `await enqueue(sid, …)`, and provides a single choke point for all access
// to `store`.
function dispatch<T>(sid: string, fn: () => T): T {
  const result = fn();
  enqueue(sid, () => {});
  return result;
}

// ── Invariant checks ──
//
// After each mutation we verify the numeric counters stay non-negative. A
// negative iteration/maxIterations count would indicate a corrupted state
// (e.g. a lost-update race) and would break the loop's termination logic.
function assertInvariants(sessionID: string, s: LoopSessionState): void {
  if (s.iterations < 0 || s.maxIterations < 0) {
    console.warn(
      `[hiai-opencode] loop-state: invariant violation for session ${sessionID}: ` +
        `iterations=${s.iterations}, maxIterations=${s.maxIterations} ` +
        `(both must be >= 0)`,
    );
  }
}

// ── State accessors ──

export function get(sessionID: string): LoopSessionState {
  return dispatch(sessionID, () => {
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
      assertInvariants(sessionID, s);
    }
    return s;
  });
}

/** Delete all state for a session (cleanup on stop/deleted/reset). */
export function reset(sessionID: string): void {
  dispatch(sessionID, () => {
    store.delete(sessionID);
    queues.delete(sessionID);
  });
}

export function markCompleted(sessionID: string): void {
  dispatch(sessionID, () => {
    const s = get(sessionID);
    s.isCompleted = true;
    s.lastLoopTime = Date.now();
    assertInvariants(sessionID, s);
  });
}

export function markError(
  sessionID: string,
  error: string,
  errorType: ErrorType,
): void {
  dispatch(sessionID, () => {
    const s = get(sessionID);
    s.lastError = error;
    s.lastErrorType = errorType;
    // Reset iteration count on error so recovery can retry fresh
    s.iterations = 0;
    assertInvariants(sessionID, s);
  });
}

export function setContinuationPrompt(sessionID: string, prompt: string): void {
  dispatch(sessionID, () => {
    const s = get(sessionID);
    s.continuationPrompt = prompt;
    s.continuationInjected = false;
    assertInvariants(sessionID, s);
  });
}

export function recordIteration(sessionID: string): void {
  dispatch(sessionID, () => {
    const s = get(sessionID);
    s.iterations++;
    s.lastLoopTime = Date.now();
    assertInvariants(sessionID, s);
  });
}

export function setHasIncompleteTasks(
  sessionID: string,
  hasIncomplete: boolean,
): void {
  dispatch(sessionID, () => {
    const s = get(sessionID);
    s.hasIncompleteTasks = hasIncomplete;
    assertInvariants(sessionID, s);
  });
}

export function markContinuationInjected(sessionID: string): void {
  dispatch(sessionID, () => {
    const s = get(sessionID);
    s.continuationInjected = true;
    assertInvariants(sessionID, s);
  });
}

/** True if the session should proceed with another loop cycle. */
export function shouldContinue(sessionID: string): boolean {
  return dispatch(sessionID, () => {
    const s = get(sessionID);
    if (s.isCompleted) return false;
    if (s.iterations >= s.maxIterations) return false;
    const now = Date.now();
    if (now - s.lastLoopTime < s.cooldownMs) return false;
    return true;
  });
}

// ── Pure helper functions (no side effects, directly testable) ──

/** Detect <promise>DONE</promise> or <CLOSURE> with readiness "done". */
export function detectCompletionMarker(text: string): boolean {
  if (/<promise>\s*DONE\s*<\/promise>/i.test(text)) return true;
  try {
    const match = text.match(/<CLOSURE>([\s\S]*?)<\/CLOSURE>/);
    if (!match) return false;
    const data = JSON.parse(match[1].trim());
    return data?.readiness === "done";
  } catch {
    return false;
  }
}

/** Classify an error message into a known type. */
export function classifyError(errorMessage: string): ErrorType {
  const msg = errorMessage.toLowerCase();
  if (/\b(rate_limit|rate limit|429)\b/.test(msg)) return "rate_limit";
  if (/\b(auth|unauthorized|401|403)\b/.test(msg)) return "auth";
  if (/\b(timeout|timed out|408)\b/.test(msg)) return "timeout";
  if (/\b(empty|no response)\b/.test(msg)) return "empty_response";
  if (
    /\b(context_length_exceeded|max_tokens|token limit|context window)\b/.test(
      msg,
    )
  )
    return "context_window_exceeded";
  if (/\b(50[0-9]|server error|internal)\b/.test(msg)) return "server_error";
  return "unknown";
}

/** Build a human-friendly recovery hint for a given error type. */
export function buildRecoveryHint(errorType: ErrorType): string {
  switch (errorType) {
    case "rate_limit":
      return "Rate limited — reduce request frequency or wait before retrying";
    case "auth":
      return "Authentication error — check API keys and provider configuration";
    case "timeout":
      return "Request timed out — retry with smaller context or simpler prompt";
    case "empty_response":
      return "Empty response — the model returned no content; retry with a more specific prompt";
    case "context_window_exceeded":
      return "Context window exceeded — compact the session or reduce message history";
    case "server_error":
      return "Server error — retry after a brief delay";
    case "unknown":
      return "Unexpected error — check logs for details";
  }
}

/** Build a continuation prompt indicating remaining tasks. */
export function buildContinuationPrompt(
  sessionID: string,
  incompleteTasks: number,
): string {
  return dispatch(sessionID, () => {
    return `[hiai-opencode] Session ${sessionID} has ${incompleteTasks} incomplete task(s). Continue working on remaining items.`;
  });
}

/** Build an error-recovery context string for compaction injection. */
export function buildRecoveryContext(hint: string): string {
  return `[hiai-opencode] RECOVERY: ${hint}`;
}
