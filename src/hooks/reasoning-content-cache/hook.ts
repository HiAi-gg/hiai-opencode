import type { Message, Part } from "@opencode-ai/sdk";
import { getMainSessionID } from "../../features/claude-code-session-state";
import { log } from "../../shared/logger";
import { reasoningContentCache } from "../../shared/reasoning-content-cache";

interface MessageWithParts {
  info: Message;
  parts: Part[];
}

/**
 * Last-resort reasoning text for a tool-call assistant message that reached the
 * transform boundary without any reasoning to restore. OpenAI-compatible
 * reasoning providers (GLM/z.ai, DeepSeek, …) reject the request with
 * "thinking is enabled but reasoning_content is missing in assistant tool call
 * message at index N" when an assistant message carries tool_calls but no
 * reasoning_content. Unlike Anthropic thinking blocks, this field is NOT
 * signature-validated, so a neutral placeholder is accepted and unblocks the
 * request.
 */
const SYNTHETIC_REASONING_TEXT = "Continuing based on the prior context.";

type AnyPart = Part & Record<string, unknown>;

function partType(part: Part): string {
  return (part as { type?: string }).type ?? "";
}

/** A real reasoning part (OpenAI-compatible), i.e. type "reasoning" with text. */
function reasoningTextFromParts(parts: Part[] | undefined): string | null {
  if (!parts) return null;
  const texts: string[] = [];
  for (const part of parts) {
    if (partType(part) !== "reasoning") continue;
    const text = (part as { text?: unknown }).text;
    if (typeof text === "string" && text.trim().length > 0) texts.push(text);
  }
  return texts.length > 0 ? texts.join("\n") : null;
}

function hasReasoningPart(parts: Part[] | undefined): boolean {
  if (!parts) return false;
  return parts.some(
    (p) =>
      partType(p) === "reasoning" &&
      typeof (p as { text?: unknown }).text === "string" &&
      ((p as { text?: string }).text as string).trim().length > 0,
  );
}

function hasToolCallPart(parts: Part[] | undefined): boolean {
  if (!parts) return false;
  return parts.some((p) => {
    const t = partType(p);
    return t === "tool" || t === "tool_use" || t === "tool-call";
  });
}

/**
 * Anthropic signed thinking block. Those flows are owned by the
 * thinking-block-validator hook (signatures cannot be fabricated). When present
 * we must NOT inject unsigned reasoning parts, or Anthropic rejects the request
 * with "Invalid `signature` in `thinking` block".
 */
function hasSignedThinkingBlocksInHistory(messages: MessageWithParts[]): boolean {
  return messages.some(
    (m) =>
      m.info.role === "assistant" &&
      m.parts?.some((p) => {
        const t = partType(p);
        if (t !== "thinking" && t !== "redacted_thinking") return false;
        const sig = (p as { signature?: unknown }).signature;
        const synthetic = (p as { synthetic?: unknown }).synthetic;
        return typeof sig === "string" && sig.length > 0 && synthetic !== true;
      }),
  );
}

/**
 * Whether this session is an OpenAI-compatible reasoning session: some assistant
 * message carries a reasoning part or `info.reasoning_content`, or the cache
 * holds reasoning for it. Used to scope the tool-call guarantee so we never
 * touch plain (non-reasoning) sessions.
 */
function hasUnsignedReasoningSignal(
  messages: MessageWithParts[],
  sessionID: string,
): boolean {
  for (const m of messages) {
    if (m.info.role !== "assistant") continue;
    if (hasReasoningPart(m.parts)) return true;
    const info = m.info as unknown as Record<string, unknown>;
    if (typeof info.reasoning_content === "string" && info.reasoning_content.trim().length > 0) {
      return true;
    }
  }
  const size = reasoningContentCache.stats?.()?.size ?? 0;
  return size > 0 && hasCachedForSession(messages, sessionID);
}

function hasCachedForSession(messages: MessageWithParts[], sessionID: string): boolean {
  // Cheap heuristic: probe by message id / index for any cached entry.
  for (let i = 0; i < messages.length; i++) {
    const id = (messages[i].info as { id?: string }).id;
    if (id && reasoningContentCache.retrieveById?.(sessionID, id) != null) return true;
    if (reasoningContentCache.retrieve(sessionID, i) != null) return true;
  }
  return false;
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

      // 1. Capture: persist any reasoning we can see (parts OR legacy info field),
      //    keyed by both message id and index, so it survives serialization.
      for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (msg.info.role !== "assistant") continue;

        const info = msg.info as unknown as Record<string, unknown>;
        const fromInfo =
          typeof info.reasoning_content === "string" && info.reasoning_content.trim().length > 0
            ? info.reasoning_content
            : null;
        const reasoning = fromInfo ?? reasoningTextFromParts(msg.parts);
        if (reasoning) {
          reasoningContentCache.save(sessionID, i, reasoning);
          const id = (msg.info as { id?: string }).id;
          if (id) reasoningContentCache.saveById?.(sessionID, id, reasoning);
        }
      }

      // 2. Guarantee a reasoning PART on tool-call assistant messages.
      //    The runtime builds the outgoing `reasoning_content` ONLY from a part
      //    of type "reasoning"; an `info.reasoning_content` field is ignored.
      //    Scope: OpenAI-compatible reasoning sessions only, never Anthropic
      //    signed-thinking flows.
      if (
        !hasSignedThinkingBlocksInHistory(messages) &&
        hasUnsignedReasoningSignal(messages, sessionID)
      ) {
        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          if (msg.info.role !== "assistant") continue;
          if (!hasToolCallPart(msg.parts)) continue;
          if (hasReasoningPart(msg.parts)) continue;

          const id = (msg.info as { id?: string }).id;
          const restored =
            (id ? reasoningContentCache.retrieveById(sessionID, id) : null) ??
            reasoningContentCache.retrieve(sessionID, i);
          const text = restored ?? SYNTHETIC_REASONING_TEXT;

          if (!msg.parts) msg.parts = [];
          const part = { type: "reasoning", text, synthetic: true } as unknown as AnyPart;
          msg.parts.unshift(part);

          // Keep legacy field in sync for any consumer that reads it.
          (msg.info as unknown as Record<string, unknown>).reasoning_content = text;

          log("[reasoning-content-cache] Guaranteed reasoning part on tool-call message", {
            sessionID,
            messageIndex: i,
            restored: restored !== null,
            contentLength: text.length,
          });
        }
      }

      // 3. Legacy reinject of info.reasoning_content (harmless belt-and-suspenders
      //    for any consumer that reads the field rather than the part).
      output.messages = reasoningContentCache.reinjectIntoMessages(
        sessionID,
        messages as unknown[],
      ) as MessageWithParts[];
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
