/**
 * worktree-lifecycle.ts — Track worktrees created via hiai_worktree_* tools.
 *
 * Auto-create on user phrases like "implement plan" is disabled: it does not
 * fire in autonomous Bob loops and it tore down trees on any CLOSURE.
 *
 * When `config.worktreeConfig.enabled`, this hook:
 *  - records paths from successful `hiai_worktree_create` calls
 *  - removes those recorded worktrees on session.deleted / dispose
 *
 * Agents must call `hiai_worktree_create` explicitly for disjoint parallel writes.
 */

import { WorktreeManager } from "../features/worktree";
import type { BobConfig, HookSet } from "../types";
import { logger } from "../util/log";

function createdPathFromOutput(output: string): string | null {
  const m =
    output.match(/path["']?\s*[:=]\s*["']([^"']+)/i) ||
    output.match(/directory["']?\s*[:=]\s*["']([^"']+)/i) ||
    output.match(/Created worktree[^\n]*?(\/\S+)/i);
  return m ? m[1] : null;
}

export function createWorktreeLifecycleHook(config: BobConfig): HookSet {
  const wtConfig = config.worktreeConfig;
  if (!wtConfig?.enabled) {
    return {};
  }

  const manager = new WorktreeManager({ baseDir: wtConfig.base_dir });
  const sessionWorktrees = new Map<string, string[]>();

  const track = (sessionID: string, dir: string) => {
    const list = sessionWorktrees.get(sessionID) ?? [];
    if (!list.includes(dir)) list.push(dir);
    sessionWorktrees.set(sessionID, list);
  };

  const removeAll = async (sessionID: string, reason: string) => {
    const dirs = sessionWorktrees.get(sessionID) ?? [];
    for (const dir of dirs) {
      try {
        const removed = await manager.remove(dir);
        if (removed) {
          logger.log(
            `[hiai-opencode] worktree-lifecycle: removed worktree ${dir} for session ${sessionID} (${reason})`,
          );
        }
      } catch (err) {
        logger.error(
          `[hiai-opencode] worktree-lifecycle: failed to remove worktree ${dir} for session ${sessionID}:`,
          err,
        );
      }
    }
    sessionWorktrees.delete(sessionID);
  };

  return {
    "tool.execute.after": async (input, output) => {
      const sessionID = input.sessionID;
      if (!sessionID) return;
      if (input.tool !== "hiai_worktree_create") return;
      const text = typeof output?.output === "string" ? output.output : "";
      const args = (input.args ?? {}) as { path?: string; directory?: string };
      const dir = args.path ?? args.directory ?? createdPathFromOutput(text);
      if (dir) track(sessionID, dir);
    },

    event: async ({ event }: { event: unknown }) => {
      const evt = event as {
        type?: string;
        properties?: { sessionID?: string };
      };
      if (evt?.type !== "session.deleted") return;
      const sessionID = evt.properties?.sessionID;
      if (!sessionID) return;
      await removeAll(sessionID, "session.deleted");
    },

    dispose: async () => {
      for (const sessionID of [...sessionWorktrees.keys()]) {
        await removeAll(sessionID, "dispose");
      }
    },
  };
}
