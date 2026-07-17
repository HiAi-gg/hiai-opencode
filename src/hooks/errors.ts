/**
 * BlockingHookError — thrown by hooks that must halt execution.
 *
 * When `mergeHookSets` / `combineHookSets` chains multiple handlers for the
 * same hook point, regular errors are logged and swallowed so that
 * observability/recovery hooks don't break each other. A BlockingHookError
 * propagates through the chain immediately, ensuring the legal gate and
 * other safety-critical hooks can always halt the pipeline.
 */
export class BlockingHookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockingHookError";
  }
}

/**
 * TUI-safe error DTO.
 *
 * Non-blocking hook errors are accumulated into `output.errors[]` so the
 * runtime/TUI can surface them without crashing the pipeline. A raw `Error`
 * (or worse, a thrown payload that embeds the full session/event object)
 * must never be placed there verbatim — it can leak huge payloads into the
 * UI and is not serializable. `HookErrorDTO` carries only a stable error
 * code, a short one-line summary, and the originating hook point.
 */
export interface HookErrorDTO {
  /** Stable, machine-readable error code (e.g. "hook_error"). */
  code: string;
  /** Short, single-line human summary — never the full payload. */
  summary: string;
  /** Hook point where the error originated (e.g. "tool.execute.before"). */
  hookPoint?: string;
}

/**
 * Maximum number of non-blocking hook errors retained per hook invocation.
 * Prevents unbounded growth of `output.errors` when a hook throws in a loop.
 */
export const MAX_HOOK_ERRORS = 10;

/**
 * Convert any thrown value into a TUI-safe {@link HookErrorDTO}.
 *
 * - `Error` instances → code `hook_error`, summary = `err.message`
 *   (truncated to a safe length). The stack and any attached payload are
 *   deliberately dropped.
 * - Non-Error throws (objects, strings, the raw session/event payload) →
 *   code `hook_error_unknown`, summary = a short stringified preview.
 *
 * The result is always serializable and bounded in size.
 */
export function sanitizeHookError(
  err: unknown,
  hookPoint?: string,
): HookErrorDTO {
  const MAX_SUMMARY = 200;

  if (err instanceof Error) {
    const message = err.message || err.name || "Unknown error";
    const summary =
      message.length > MAX_SUMMARY
        ? `${message.slice(0, MAX_SUMMARY)}…`
        : message;
    return { code: "hook_error", summary, hookPoint };
  }

  let preview: string;
  if (typeof err === "string") {
    preview = err;
  } else if (err === null || err === undefined) {
    preview = "null";
  } else {
    // A thrown payload object (e.g. a raw session/event) must NEVER be
    // stringified into the summary — that would leak the full payload into the
    // TUI. We only record its constructor name / type as a short, opaque tag.
    const ctor = (err as { constructor?: { name?: string } })?.constructor?.name;
    preview = ctor && ctor !== "Object" ? `<${ctor}>` : "<object>";
  }
  if (preview.length > MAX_SUMMARY) {
    preview = `${preview.slice(0, MAX_SUMMARY)}…`;
  }
  return { code: "hook_error_unknown", summary: preview, hookPoint };
}
