import type { BobConfig, HookSet } from "../types";
import { BlockingHookError } from "./errors";

export function createToolPairValidator(_config: BobConfig): HookSet {
  return {
    "experimental.chat.messages.transform": async (
      _input: Parameters<
        NonNullable<HookSet["experimental.chat.messages.transform"]>
      >[0],
      output: Parameters<
        NonNullable<HookSet["experimental.chat.messages.transform"]>
      >[1],
    ) => {
      try {
        for (const msg of output.messages) {
          const parts = msg.parts as Array<Record<string, unknown>> | undefined;
          if (!parts) continue;
          const hasToolUse = parts.some((p) => p.type === "tool_use");
          const hasToolResult = parts.some((p) => p.type === "tool_result");
          if (hasToolUse && !hasToolResult) {
            parts.push({
              type: "tool_result",
              tool_use_id: "missing",
              content:
                "[hiai-opencode] Auto-injected missing tool_result placeholder",
              is_error: true,
            });
          }
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        console.error(
          "[hiai-opencode] Hook error in tool-pair-validator:",
          err,
        );
      }
    },
  };
}
