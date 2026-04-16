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
export function parseParallelItem(p: unknown): ParallelCommand | null {
  if (typeof p === "string") {
    const trimmed = p.trim();
    if (trimmed.startsWith("/")) {
      // Parse /command {overrides} args syntax
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
  if (typeof p === "object" && p !== null && (p as any).command) {
    return {
      command: (p as any).command,
      arguments: (p as any).arguments,
      prompt: (p as any).prompt,
      model: (p as any).model,
      agent: (p as any).agent,
      loop: (p as any).loop,
      as: (p as any).as,
      inline: (p as any).inline,
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
