import { getClient, getFirstReturnPrompt } from "../core/state";
import { log } from "../utils/logger";
import {
  hasTurnReferences,
  extractTurnReferences,
  replaceTurnReferences,
} from "../parsing";

/**
 * Feature: $TURN[n] reference resolution
 * Fetches and formats session messages for injection into commands
 */

/**
 * Fetch and format session messages
 * @param sessionID - The session to fetch from
 * @param lastN - Get the last N messages (optional)
 * @param specificIndices - Get specific messages by index from end, 1-based (optional)
 */
export async function fetchSessionMessages(
  sessionID: string,
  lastN?: number,
  specificIndices?: number[]
): Promise<string> {
  const client = getClient();
  if (!client) {
    log("fetchSessionMessages: no client available");
    return "[TURN: client not available]";
  }

  try {
    const result = await client.session.messages({
      path: { id: sessionID },
    });

    const messages = result.data;
    log(
      `fetchSessionMessages: got ${
        messages?.length ?? 0
      } messages from ${sessionID}`
    );

    if (!messages?.length) {
      return "[TURN: no messages found]";
    }

    // Log all messages for debugging
    log(
      `All messages:`,
      messages.map((m: any, i: number) => ({
        idx: i,
        role: m.info.role,
        partsCount: m.parts?.length,
        textParts: m.parts
          ?.filter((p: any) => p.type === "text")
          .map((p: any) => p.text?.substring(0, 30)),
      }))
    );

    // Filter out trailing empty messages (from current command being initiated)
    let effectiveMessages = messages;
    while (effectiveMessages.length > 0) {
      const last = effectiveMessages[effectiveMessages.length - 1];
      const hasContent = last.parts?.some(
        (p: any) =>
          (p.type === "text" && p.text?.trim()) ||
          (p.type === "tool" &&
            p.state?.status === "completed" &&
            p.state?.output)
      );
      if (!hasContent) {
        effectiveMessages = effectiveMessages.slice(0, -1);
      } else {
        break;
      }
    }
    log(
      `After filtering empty trailing messages: ${effectiveMessages.length} (was ${messages.length})`
    );

    // Select messages based on mode
    let selectedMessages: any[];
    if (specificIndices && specificIndices.length > 0) {
      // Specific indices mode: $TURN[:2:5:8] - indices are 1-based from end
      selectedMessages = specificIndices
        .map(idx => effectiveMessages[effectiveMessages.length - idx])
        .filter(Boolean);
      log(
        `Using specific indices [${specificIndices.join(",")}] -> ${
          selectedMessages.length
        } messages`
      );
    } else if (lastN) {
      // Last N mode: $TURN[5]
      selectedMessages = effectiveMessages.slice(-lastN);
      log(`Using last ${lastN} messages`);
    } else {
      selectedMessages = effectiveMessages;
      log(`Using all ${selectedMessages.length} messages`);
    }

    // Format each message with its parts
    const formatted = selectedMessages.map((msg: any) => {
      const role = msg.info.role.toUpperCase();
      const parts: string[] = [];

      for (const part of msg.parts) {
        // Skip ignored parts
        if (part.ignored) continue;

        if (part.type === "text" && part.text) {
          // Replace the generic opencode summarize prompt with our first return prompt
          if (part.text.startsWith("Summarize the task tool output")) {
            const replacement = getFirstReturnPrompt(sessionID);
            if (replacement) {
              parts.push(replacement);
            }
            // If no replacement, skip it entirely
            continue;
          }
          parts.push(part.text);
        } else if (part.type === "tool" && part.state?.status === "completed") {
          // Include completed tool results (especially task tool for subtask content)
          const toolName = part.tool;
          let output = part.state.output;
          if (output && typeof output === "string") {
            // Strip <task_metadata> tags from task tool output
            output = output
              .replace(/<task_metadata>[\s\S]*?<\/task_metadata>/g, "")
              .trim();
            if (output && output.length < 2000) {
              // For task tool, just include the content directly (it's the subtask's response)
              if (toolName === "task") {
                parts.push(output);
              } else {
                parts.push(`[Tool: ${toolName}]\n${output}`);
              }
            }
          }
        }
      }

      return `--- ${role} ---\n${parts.join("\n")}`;
    });

    return formatted.join("\n\n");
  } catch (e) {
    log("fetchSessionMessages error:", e);
    return `[TURN: error fetching messages - ${e}]`;
  }
}

/**
 * Process a string and replace all $TURN references with actual session content
 */
export async function resolveTurnReferences(
  text: string,
  sessionID: string
): Promise<string> {
  if (!hasTurnReferences(text)) {
    return text;
  }

  const refs = extractTurnReferences(text);
  if (!refs.length) return text;

  const replacements = new Map<string, string>();

  for (const ref of refs) {
    if (ref.type === "lastN") {
      const content = await fetchSessionMessages(sessionID, ref.count);
      replacements.set(ref.match, content);
      log(`Resolved ${ref.match}: ${content.length} chars`);
    } else if (ref.type === "specific") {
      const content = await fetchSessionMessages(
        sessionID,
        undefined,
        ref.indices
      );
      replacements.set(ref.match, content);
      log(`Resolved ${ref.match}: ${content.length} chars`);
    } else if (ref.type === "all") {
      const content = await fetchSessionMessages(sessionID, Infinity);
      replacements.set(ref.match, content);
      log(`Resolved ${ref.match}: ${content.length} chars`);
    }
  }

  return replaceTurnReferences(text, replacements);
}
