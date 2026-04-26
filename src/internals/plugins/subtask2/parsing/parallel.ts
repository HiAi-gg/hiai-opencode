import type { ParallelCommand, LoopConfig } from "../types";
import { parseCommandWithOverrides } from "./commands";

/**
 * Parse loop config from frontmatter
 * Supports:
 *   loop: 10  (just max)
 *   loop: { max: 10, until: "condition" }
 */
export function parseLoopConfig(loop: unknown): LoopConfig | undefined {
  if (loop === undefined || loop === null) return undefined;

  if (typeof loop === "number" && loop > 0) {
    return { max: loop, until: "" };
  }

  if (typeof loop === "object") {
    const obj = loop as Record<string, unknown>;
    const max = typeof obj.max === "number" ? obj.max : 10;
    const until = typeof obj.until === "string" ? obj.until : "";
    if (max > 0) {
      return { max, until };
    }
  }

  return undefined;
}

// Parse a parallel item - handles "/cmd {model:...} args" syntax, plain "cmd", or {command, arguments} object
function isParallelCommandLike(p: unknown): p is { command: unknown; arguments?: unknown; prompt?: unknown; model?: unknown; agent?: unknown; loop?: unknown; as?: unknown; inline?: unknown } {
  return typeof p === "object" && p !== null && "command" in p
}

export function parseParallelItem(p: unknown): ParallelCommand | null {
  if (typeof p === "string") {
    const trimmed = p.trim();
    if (trimmed.startsWith("/")) {
      const parsed = parseCommandWithOverrides(trimmed);
      if (parsed.isInlineSubtask) {
        return {
          command: "_inline_subtask_",
          inline: true,
          prompt: parsed.arguments,
          model: parsed.overrides.model,
          agent: parsed.overrides.agent,
          loop: parsed.overrides.loop,
          as: parsed.overrides.as,
        };
      }
      return {
        command: parsed.command,
        arguments: parsed.arguments,
        model: parsed.overrides.model,
        agent: parsed.overrides.agent,
        loop: parsed.overrides.loop,
        as: parsed.overrides.as,
      };
    }
    return { command: trimmed };
  }
  if (isParallelCommandLike(p)) {
    return {
      command: String(p.command),
      arguments: p.arguments !== undefined ? String(p.arguments) : undefined,
      prompt: p.prompt !== undefined ? String(p.prompt) : undefined,
      model: p.model !== undefined ? String(p.model) : undefined,
      agent: p.agent !== undefined ? String(p.agent) : undefined,
      loop: p.loop !== undefined ? parseLoopConfig(p.loop) : undefined,
      as: p.as !== undefined ? String(p.as) : undefined,
      inline: p.inline !== undefined ? Boolean(p.inline) : undefined,
    };
  }
  return null;
}

export function parseParallelConfig(parallel: unknown): ParallelCommand[] {
  if (!parallel) return [];
  if (Array.isArray(parallel)) {
    return parallel
      .map(parseParallelItem)
      .filter((p): p is ParallelCommand => p !== null);
  }
  if (typeof parallel === "string") {
    // Split by comma, parse each
    return parallel
      .split(",")
      .map(parseParallelItem)
      .filter((p): p is ParallelCommand => p !== null);
  }
  return [];
}
