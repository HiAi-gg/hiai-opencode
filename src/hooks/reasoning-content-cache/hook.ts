import type { Message, Part } from "@opencode-ai/sdk";
import { getMainSessionID } from "../../features/claude-code-session-state";
import { log } from "../../shared/logger";
import { reasoningContentCache } from "../../shared/reasoning-content-cache";

interface MessageWithParts {
  info: Message;
  parts: Part[];
}

export function createReasoningContentCacheHook(): {
  "experimental.chat.messages.transform": (
    input: Record<string, never>,
    output: { messages: MessageWithParts[] },
  ) => Promise<void>;
} {
  return {
    "experimental.chat.messages.transform": async (
      _input: Record<string, never>,
      output: { messages: MessageWithParts[] },
    ) => {
      const { messages } = output;

      reasoningContentCache.clearExpired();

      if (!messages || messages.length === 0) {
        return;
      }

      const sessionID = extractSessionID(messages);
      if (!sessionID) {
        return;
      }

      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (msg.info.role !== "assistant") {
          continue;
        }

        const info = msg.info as unknown as Record<string, unknown>;
        if (
          info.reasoning_content &&
          typeof info.reasoning_content === "string"
        ) {
          reasoningContentCache.save(sessionID, i, info.reasoning_content);
        }
      }

      output.messages = reasoningContentCache.reinjectIntoMessages(
        sessionID,
        messages as unknown[],
      ) as MessageWithParts[];

      for (let i = 0; i < output.messages.length; i++) {
        const processed = output.messages[i];
        if (typeof processed === "object" && processed !== null) {
          const msgObj = processed as unknown as Record<string, unknown>;
          if (msgObj.info && typeof msgObj.info === "object") {
            const processedInfo = msgObj.info as Record<string, unknown>;
            if (
              processedInfo.reasoning_content &&
              typeof processedInfo.reasoning_content === "string"
            ) {
              const original = messages[i];
              const originalInfo = original.info as unknown as Record<
                string,
                unknown
              >;
              if (!originalInfo.reasoning_content) {
                log("[reasoning-content-cache] Reinstated reasoning_content", {
                  sessionID,
                  messageIndex: i,
                  contentLength: (processedInfo.reasoning_content as string)
                    .length,
                });
              }
            }
          }
        }
      }
    },
  };
}

function extractSessionID(messages: MessageWithParts[]): string | undefined {
  for (const msg of messages) {
    const info = msg.info as unknown as { sessionID?: string };
    if (info.sessionID) {
      return info.sessionID;
    }
  }
  return getMainSessionID();
}
