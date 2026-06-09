import type { DelegateTaskArgs } from "./types.js";
import type { AgentConfig } from "@opencode-ai/sdk";

export type ExecutionMode =
  | { mode: "background-continuation"; sessionId: string }
  | { mode: "sync-continuation"; sessionId: string }
  | { mode: "unstable-agent" }
  | { mode: "background" }
  | { mode: "sync" };

export function determineExecutionMode(
  args: DelegateTaskArgs,
  resolvedAgent: AgentConfig,
): ExecutionMode {
  if (args.session_id) {
    if (args.run_in_background)
      return { mode: "background-continuation", sessionId: args.session_id };
    return { mode: "sync-continuation", sessionId: args.session_id };
  }
  if (resolvedAgent.experimental) return { mode: "unstable-agent" };
  if (args.run_in_background) return { mode: "background" };
  return { mode: "sync" };
}
