import type { BobConfig, HookSet } from "../types";
import { BlockingHookError } from "./errors";
import { logger } from "../util/log";

const INTERACTIVE_CMDS = [
  "vim",
  "vi",
  "nano",
  "less",
  "more",
  "htop",
  "top",
  "man",
  "ssh",
];

export function createNonInteractiveEnv(_config: BobConfig): HookSet {
  return {
    "tool.execute.before": async (input, output) => {
      try {
        if (input.tool !== "bash") return;
        const args = output.args as { command?: string };
        const cmd = (args?.command ?? "").trim().split(/\s+/)[0]?.toLowerCase();
        if (cmd && INTERACTIVE_CMDS.includes(cmd)) {
          logger.log(
            `[hiai-opencode] Non-interactive command detected: ${cmd}`,
          );
          output.args = {
            ...((output.args as Record<string, unknown>) ?? {}),
            command: `echo "[hiai-opencode] '${cmd}' is interactive and cannot run in this environment. Use a non-interactive alternative."`,
          } as typeof output.args;
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        logger.error("[hiai-opencode] Hook error in non-interactive-env:", err);
      }
    },
  };
}
