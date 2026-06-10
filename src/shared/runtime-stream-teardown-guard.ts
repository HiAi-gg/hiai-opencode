import { logWarn } from "./logger";

/**
 * Suppresses a benign teardown race in the OpenCode runtime that surfaces
 * during agent delegation.
 *
 * When a delegated sub-agent session ends or is aborted, the runtime can try to
 * `write()` to a stream that was already destroyed, producing an unhandled
 * rejection like `Cannot call write after a stream was destroyed`. With no
 * `unhandledRejection` listener present, Bun terminates the worker running the
 * tool — observed as `Worker has been terminated`, which kills the whole parent
 * session.
 *
 * The error originates entirely inside the runtime bundle (`/$bunfs/...`) with
 * no plugin frames, so it is not actionable from here and is safe to swallow.
 * Every other unhandled rejection is re-thrown to preserve the default
 * crash-on-real-bug behavior — we only neutralize this specific race.
 */
function isBenignStreamTeardown(reason: unknown): boolean {
  const err = reason as
    | { message?: string; code?: string; stack?: string }
    | undefined;
  const message = err?.message ?? "";
  const code = err?.code ?? "";
  const stack = err?.stack ?? "";

  if (code === "ERR_STREAM_DESTROYED") return true;
  if (message.includes("write after a stream was destroyed")) return true;
  // Some hits arrive with an empty message; identify them by the runtime
  // stream-write call signature instead.
  return (
    stack.includes("internal:streams/writable") && stack.includes("doWrite")
  );
}

export function installRuntimeStreamTeardownGuard(): void {
  const g = globalThis as { __hiaiStreamTeardownGuardInstalled?: boolean };
  if (g.__hiaiStreamTeardownGuardInstalled) {
    return;
  }
  g.__hiaiStreamTeardownGuardInstalled = true;

  process.on("unhandledRejection", (reason: unknown) => {
    if (isBenignStreamTeardown(reason)) {
      const message =
        (reason as { message?: string } | undefined)?.message ??
        String(reason);
      logWarn(
        "[delegation] suppressed benign OpenCode runtime stream-teardown race",
        { message },
      );
      return;
    }
    // Not our race — restore default behavior so genuine bugs still surface.
    throw reason;
  });
}
