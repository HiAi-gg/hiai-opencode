import { existsSync, statSync } from "node:fs";
import { delimiter, join } from "node:path";

/**
 * The environment variable that selects which engine `agent-browser` uses.
 * When set, upstream `agent-browser` honors it verbatim. When unset, upstream
 * falls back to its own default engine (Chrome). We deliberately never write a
 * "chrome" value here — an *unset* variable is the signal that means "use the
 * upstream default".
 */
export const AGENT_BROWSER_ENGINE = "AGENT_BROWSER_ENGINE";

/** Engine identifier for Lightpanda (headless-only Chrome alternative). */
export const LIGHTPANDA_ENGINE = "lightpanda";

/**
 * Look up whether a binary named `name` exists (as a regular file) in the
 * directories of `env`'s PATH. Returns the full path of the first match, or
 * `null` when not found.
 *
 * Kept as a standalone, injectable dependency so callers (and tests) can stub
 * PATH discovery without touching the real filesystem or PATH.
 */
export function findInPath(
  name: string,
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const pathVar = env.PATH ?? env.Path ?? "";
  if (!pathVar) return null;

  const isWin = process.platform === "win32";
  const names = isWin ? [name, `${name}.exe`, `${name}.cmd`] : [name];

  for (const dir of pathVar.split(delimiter)) {
    if (!dir) continue;
    for (const candidate of names) {
      const full = join(dir, candidate);
      try {
        if (existsSync(full) && statSync(full).isFile()) return full;
      } catch {
        // Skip entries that race or fail the stat() permission check.
      }
    }
  }
  return null;
}

/** Injectable binary lookup used by {@link applyAgentBrowserEngineDefault}. */
export type BinaryLookup = (name: string) => string | null;

/**
 * Availability-aware runtime default for the `agent-browser` engine.
 *
 * - If `AGENT_BROWSER_ENGINE` is already set, it is left untouched (an explicit
 *   user/upstream choice always wins).
 * - Otherwise, if a `lightpanda` binary is found in PATH, the variable is set
 *   to `"lightpanda"`.
 * - Otherwise the variable is left unset so upstream `agent-browser` falls back
 *   to its own default engine (Chrome). Chrome is never hardcoded here.
 */
export function applyAgentBrowserEngineDefault(
  env: NodeJS.ProcessEnv = process.env,
  lookup: BinaryLookup = (name) => findInPath(name, env),
): void {
  if (env[AGENT_BROWSER_ENGINE]) return;
  if (lookup(LIGHTPANDA_ENGINE)) {
    env[AGENT_BROWSER_ENGINE] = LIGHTPANDA_ENGINE;
  }
}
