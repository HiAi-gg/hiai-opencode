import { parseOverridesString, type CommandOverrides } from "./overrides";

export interface ParsedCommand {
  command: string;
  arguments?: string;
  overrides: CommandOverrides;
  isInlineSubtask?: boolean; // true for /subtask {...} prompt syntax
}

/**
 * Parse a command string with optional overrides: /cmd {model:provider/model-id} args
 * Also supports inline subtask syntax: /subtask {loop:5,until:condition} prompt text
 * Syntax: /command {key:value,key2:value2} arguments
 * (No-space form is also supported for compatibility.)
 */
export function parseCommandWithOverrides(input: string): ParsedCommand {
  const trimmed = input.trim();

  if (!trimmed.startsWith("/")) {
    return { command: trimmed, overrides: {} };
  }

  // Check for inline subtask syntax: /subtask {...} prompt (case-insensitive)
  const subtaskMatch = trimmed.match(/^\/[sS][uU][bB][tT][aA][sS][kK]\b/s);
  if (subtaskMatch) {
    const rest = trimmed.slice(subtaskMatch[0].length).trimStart();
    if (rest.startsWith("{")) {
      const inlineParsed = parseInlineSubtask(rest);
      if (inlineParsed) {
        return {
          command: "", // No command - inline prompt
          arguments: inlineParsed.prompt,
          overrides: inlineParsed.overrides,
          isInlineSubtask: true,
        };
      }
    }
  }

  // Match: /command {overrides} or /command
  const match = trimmed.match(/^\/([a-zA-Z0-9_\-\/]+)(.*)$/s);

  if (!match) {
    // Fallback: just split on first space
    const [cmd, ...rest] = trimmed.slice(1).split(/\s+/);
    return {
      command: cmd,
      arguments: rest.join(" ") || undefined,
      overrides: {},
    };
  }

  const [, commandName, rawRest] = match;
  const rest = rawRest || "";
  const trimmedRest = rest.trimStart();
  let overrides: CommandOverrides = {};
  let args = trimmedRest;

  if (trimmedRest.startsWith("{")) {
    const extracted = extractOverrideBlock(trimmedRest);
    if (extracted) {
      overrides = parseOverridesString(extracted.overrideStr);
      args = extracted.rest.trimStart();
    }
  }

  return {
    command: commandName,
    arguments: args || undefined,
    overrides,
  };
}

export interface ParsedInlineSubtask {
  prompt: string;
  overrides: CommandOverrides;
}

export interface ParsedArgsWithOverrides {
  overrides: CommandOverrides;
  rest: string;
}

/**
 * Parse /subtask {...} prompt inline subtask syntax
 * Input should NOT include the /subtask prefix
 * Returns null if not valid inline subtask syntax
 */
export function parseInlineSubtask(input: string): ParsedInlineSubtask | null {
  const trimmed = input.trim();

  // Must start with {
  if (!trimmed.startsWith("{")) return null;

  const extracted = extractOverrideBlock(trimmed);
  if (!extracted) return null;

  const overrideStr = extracted.overrideStr;
  const prompt = extracted.rest.trim();

  if (!prompt) return null;

  // Reuse centralized override parsing logic
  const overrides = parseOverridesString(overrideStr);

  return { prompt, overrides };
}

/**
 * Parse a leading override block from arguments ("{...} rest")
 */
export function parseOverridesFromArgs(
  input: string
): ParsedArgsWithOverrides | null {
  const trimmed = input.trimStart();
  if (!trimmed.startsWith("{")) return null;

  const extracted = extractOverrideBlock(trimmed);
  if (!extracted) return null;

  const overrides = parseOverridesString(extracted.overrideStr);
  const rest = extracted.rest.trimStart();
  return { overrides, rest };
}

function extractOverrideBlock(
  input: string
): { overrideStr: string; rest: string } | null {
  if (!input.startsWith("{")) return null;

  // Find matching closing brace (handle nested braces)
  let depth = 0;
  let braceEnd = -1;
  for (let i = 0; i < input.length; i++) {
    if (input[i] === "{") {
      depth++;
    } else if (input[i] === "}") {
      depth--;
      if (depth === 0) {
        braceEnd = i;
        break;
      }
    }
  }

  if (braceEnd === -1) return null;

  const overrideStr = input.substring(1, braceEnd);
  const rest = input.substring(braceEnd + 1);
  return { overrideStr, rest };
}

// Re-export CommandOverrides for convenience
export type { CommandOverrides };
