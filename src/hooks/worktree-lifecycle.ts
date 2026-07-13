/**
 * worktree-lifecycle.ts — Auto-create and auto-clean git worktrees around a plan.
 *
 * Lifecycle:
 *  - `chat.message`: when the user message signals the start of a plan/phase
 *    (e.g. "implement plan", "start phase"), a linked worktree is created and
 *    associated with the session.
 *  - `tool.execute.after`: when a CLOSURE block is detected in tool output, the
 *    worktree associated with that session is removed.
 *
 * Only active when `config.worktreeConfig?.enabled === true`.
 */

import { WorktreeManager } from "../features/worktree";
import type { BobConfig, HookSet } from "../types";
import { logger } from "../util/log";

/** Phrases that signal the start of a plan / phase and should spawn a worktree. */
const PLAN_START_PATTERNS: RegExp[] = [
  /\bimplement\s+(the\s+)?plan\b/i,
  /\bstart\s+(the\s+)?plan\b/i,
  /\bbegin\s+(the\s+)?plan\b/i,
  /\bexecute\s+(the\s+)?plan\b/i,
  /\bstart\s+(a\s+)?phase\b/i,
  /\bbegin\s+(a\s+)?phase\b/i,
  /\bstart\s+(a\s+)?new\s+task\b/i,
];

/** Marker that the plan is complete and the worktree can be torn down. */
const CLOSURE_PATTERN = /<CLOSURE>[\s\S]*?<\/CLOSURE>/i;

function extractMessageText(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .map((p) => {
      const part = p as { type?: string; text?: string };
      return part?.type === "text" && typeof part.text === "string"
        ? part.text
        : "";
    })
    .join("\n");
}

function isPlanStart(message: string): boolean {
  return PLAN_START_PATTERNS.some((re) => re.test(message));
}

export function createWorktreeLifecycleHook(config: BobConfig): HookSet {
  const wtConfig = config.worktreeConfig;
  if (!wtConfig?.enabled) {
    return {};
  }

  const manager = new WorktreeManager({ baseDir: wtConfig.base_dir });
  const sessionWorktrees = new Map<string, string>();

  return {
    "chat.message": async (_input, output) => {
      const sessionID = _input.sessionID;
      if (!sessionID) return;
      // Already tracking a worktree for this session.
      if (sessionWorktrees.has(sessionID)) return;

      const text = extractMessageText(output?.parts);
      if (!isPlanStart(text)) return;

      try {
        const info = await manager.create({ planName: text.slice(0, 64) });
        sessionWorktrees.set(sessionID, info.path);
        logger.log(
          `[hiai-opencode] worktree-lifecycle: created worktree ${info.path} for session ${sessionID}`,
        );
      } catch (err) {
        logger.error(
          `[hiai-opencode] worktree-lifecycle: failed to create worktree for session ${sessionID}:`,
          err,
        );
      }
    },

    "tool.execute.after": async (input, output) => {
      const sessionID = input.sessionID;
      if (!sessionID) return;
      const dir = sessionWorktrees.get(sessionID);
      if (!dir) return;

      const toolOutput =
        typeof output?.output === "string" ? output.output : "";
      if (!CLOSURE_PATTERN.test(toolOutput)) return;

      try {
        const removed = await manager.remove(dir);
        if (removed) {
          logger.log(
            `[hiai-opencode] worktree-lifecycle: removed worktree ${dir} for session ${sessionID}`,
          );
        }
        sessionWorktrees.delete(sessionID);
      } catch (err) {
        logger.error(
          `[hiai-opencode] worktree-lifecycle: failed to remove worktree ${dir} for session ${sessionID}:`,
          err,
        );
      }
    },

    dispose: async () => {
      // Best-effort cleanup of any worktrees still tracked at shutdown.
      for (const [sessionID, dir] of sessionWorktrees) {
        try {
          await manager.remove(dir);
          logger.log(
            `[hiai-opencode] worktree-lifecycle: removed worktree ${dir} for session ${sessionID} on dispose`,
          );
        } catch {
          // ignore individual removal failures
        }
      }
      sessionWorktrees.clear();
    },
  };
}
