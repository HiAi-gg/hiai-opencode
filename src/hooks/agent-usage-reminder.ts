import type { BobConfig, HookSet } from "../types";

export function createAgentUsageReminder(_config: BobConfig): HookSet {
  return {
    "tool.execute.after": async () => {
      // Intentionally silent. Tool results are a TUI-visible transport and
      // must never be decorated with plugin diagnostics or reminders.
    },
    dispose: async () => {},
  };
}
