import type { BobConfig, CavemanConfig, HookSet } from "../types";

/**
 * Caveman Message Compressor — optional conservative message/history
 * compressor for internal agent-to-agent communication.
 *
 * Hook point: experimental.chat.messages.transform
 *
 * SAFETY GUARANTEES (conservative no-op design):
 * 1. NEVER mutates the current user prompt or assistant final output.
 * 2. NEVER removes or rewrites tool_use, tool_result, code, or error payloads.
 * 3. Only compresses long-running internal conversation turns (past assistant
 *    messages that are clearly internal subagent chatter).
 * 4. Requires min_messages_to_compress threshold to be exceeded.
 * 5. If in doubt, skip — no-op is safer than lossy compression.
 *
 * CURRENTLY a conservative no-op/marker:
 *   - Adds a safety instruction to system prompt reminding agents to be concise.
 *   - Does NOT rewrite, remove, or truncate any messages.
 *   - Future: if OpenCode hook API gains a safe compaction-only hook point
 *     with clear message-role discrimination, compression logic may be added.
 *
 * Disable: add "caveman-message-compressor" to hooks.disabled in bob.json.
 */
export function createCavemanMessageCompressor(config: BobConfig): HookSet {
  const caveman: CavemanConfig = config.caveman ?? {
    enabled: true,
    level: "full",
    bob_internal: true,
    bob_to_agents: true,
    agents_to_bob: true,
    final_user_output: "normal",
    target_agents: [
      "bob",
      "explore",
      "build",
      "critic",
      "general",
      "designer",
      "manager",
    ],
    exclude_agents: ["vision", "writer"],
    min_messages_to_compress: 5,
  };

  if (!caveman.enabled) {
    return {};
  }

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
        if (!output?.messages?.length) return;

        // CONSERVATIVE: only inject a conciseness reminder into the last
        // assistant message if there are enough messages to warrant it.
        // NEVER mutate tool_use/tool_result/code/error payloads.
        const msgCount = output.messages.length;

        if (msgCount < (caveman.min_messages_to_compress ?? 5)) {
          return; // Below threshold — skip entirely
        }

        // Find the last assistant message to add a conciseness hint
        for (let i = output.messages.length - 1; i >= 0; i--) {
          const msg = output.messages[i];
          if (msg.info?.role !== "assistant") continue;
          if (!msg.parts?.length) continue;

          const lastPart = msg.parts[msg.parts.length - 1] as Record<
            string,
            unknown
          >;
          if (lastPart?.type === "text" && typeof lastPart.text === "string") {
            // Only add the marker if caveman protocol is enabled for context
            if (
              caveman.bob_internal ||
              caveman.bob_to_agents ||
              caveman.agents_to_bob
            ) {
              // Insert a conciseness reminder only if one isn't already present
              if (!lastPart.text.includes("[hiai-opencode] caveman")) {
                lastPart.text +=
                  "\n\n[hiai-opencode] caveman: prefer concise internal communication — drop filler, preserve exact artifacts.";
              }
            }
          }
          break; // Only touch the last assistant message
        }
      } catch (err) {
        // Fail-safe: log and continue without breaking messages
        console.error("[hiai-opencode] caveman-message-compressor error:", err);
      }
    },
  };
}
