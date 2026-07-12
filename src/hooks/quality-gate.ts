import type { BobConfig, HookSet } from "../types";
import { setQualityGateFailed } from "../features/completion-controller/state";
import { BlockingHookError } from "./errors";

/**
 * Strict error-signal patterns. These target *structural* diagnostic signals
 * rather than the bare substring "error", so benign phrases such as
 * "no error" or "handling errors correctly" do not trip the gate.
 *
 * Each pattern is anchored to a real failure indicator emitted by the
 * supported quality commands (bun test, biome, tsc, etc.):
 *  - `\b[A-Za-z]*error\s*:`  → "error:", "Error:", "TypeError:" (diagnostic label + colon)
 *  - `\bERR_`                → "ERR_MODULE_NOT_FOUND", "ERR_INVALID_ARG_TYPE", ...
 *  - `\bERROR\b`             → standalone all-caps ERROR
 *  - `\b[1-9]\d*\s+errors?\b`→ "N error(s)" with N >= 1 (excludes the passing "0 errors")
 *  - `\bfailed\b` / `\bFAIL\b` → test/command failure keywords
 *  - `[✗✘×]`                 → failure glyphs emitted by test runners / linters
 */
const ERROR_PATTERNS: RegExp[] = [
  /\b[A-Za-z]*error\s*:/i,
  /\bERR_/i,
  /\bERROR\b/,
  /\b[1-9]\d*\s+errors?\b/i,
  /\bfailed\b/i,
  /\bFAIL\b/,
  /[✗✘×]/,
];

function isQualityCommand(cmd: string): boolean {
  return (
    cmd.includes("bun test") ||
    cmd.includes("bun run lint") ||
    cmd.includes("bun run check") ||
    cmd.includes("bun run ci") ||
    cmd.includes("biome check") ||
    cmd.includes("bun run format") ||
    cmd.includes("bun run typecheck") ||
    cmd.includes("tsc") ||
    cmd.includes("eslint") ||
    cmd.includes("vitest") ||
    cmd.includes("jest")
  );
}

export function createQualityGate(_config: BobConfig): HookSet {
  return {
    "tool.execute.after": async (input, output) => {
      try {
        if (input.tool !== "bash" || !input.sessionID) return;
        const args = input.args as { command?: string };
        const cmd = args?.command ?? "";
        if (!isQualityCommand(cmd)) return;

        const text = output.output ?? "";
        const hasErrors = ERROR_PATTERNS.some((re) => re.test(text));

        // Drive the completion-controller state machine: a failed quality
        // command blocks task completion until it passes again. A passing
        // command clears any prior failure flag for this session.
        setQualityGateFailed(input.sessionID, hasErrors);

        if (hasErrors) {
          const cmdName = cmd.split(" ")[0];
          console.log(
            `[hiai-opencode] QUALITY GATE FAILED: ${cmdName}`,
          );
          output.output += `\n\n[hiai-opencode] ⛔ QUALITY GATE FAILED: ${cmdName} detected errors.\n⛔ Fix the reported errors and re-run until exit code 0.\n⛔ Task completion is blocked until the quality gate passes.`;
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        console.error("[hiai-opencode] Hook error in quality-gate:", err);
      }
    },
  };
}
