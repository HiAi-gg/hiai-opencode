import type { BobConfig, HookSet } from "../types";
import { BlockingHookError } from "./errors";

export function createAgentUsageReminder(_config: BobConfig): HookSet {
  const callCounts = new Map<string, number>();
  return {
    "tool.execute.after": async (input, output) => {
      try {
        if (input.tool === "task") return;
        const sid = input.sessionID;
        const count = (callCounts.get(sid) ?? 0) + 1;
        callCounts.set(sid, count);
        if (count === 10 || (count > 10 && count % 20 === 0)) {
          output.output +=
            "\n\n[hiai-opencode] Reminder: Use the task tool to track multi-step work for better continuity.";
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        console.error(
          "[hiai-opencode] Hook error in agent-usage-reminder:",
          err,
        );
      }
    },
    dispose: async () => {
      callCounts.clear();
    },
  };
}
