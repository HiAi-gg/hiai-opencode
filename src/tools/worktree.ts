import { tool } from "@opencode-ai/plugin";
import { WorktreeManager } from "../features/worktree/index";

/**
 * Create a WorktreeManager rooted at the current project directory.
 * The plugin passes the session's project directory via the tool context,
 * which we use as the baseDir for resolving the worktrees location.
 */
function managerFor(ctx: { directory: string }): WorktreeManager {
  return new WorktreeManager({ baseDir: ctx.directory });
}

export const hiai_worktree_create = tool({
  description:
    "Create a new git worktree with a dedicated branch for isolated parallel work. Returns the worktree path, branch, and name.",
  args: {
    name: tool.schema
      .string()
      .optional()
      .describe(
        "Optional worktree name (used for the directory and branch slug)",
      ),
    plan: tool.schema
      .string()
      .optional()
      .describe("Optional plan name used to derive the branch slug"),
  },
  async execute(args, ctx) {
    try {
      const manager = managerFor(ctx);
      const info = await manager.create({
        name: args.name,
        planName: args.plan,
      });
      return {
        title: "Worktree created",
        output: `Created worktree "${info.name}" at ${info.path} on branch ${info.branch}`,
        metadata: {
          path: info.path,
          branch: info.branch,
          name: info.name,
        },
      };
    } catch (err) {
      return {
        title: "Worktree creation failed",
        output: `Error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
});

export const hiai_worktree_remove = tool({
  description:
    "Remove a git worktree by its directory path. Returns whether the worktree was removed.",
  args: {
    path: tool.schema
      .string()
      .describe("Absolute path of the worktree directory to remove"),
  },
  async execute(args, ctx) {
    try {
      const manager = managerFor(ctx);
      const removed = await manager.remove(args.path);
      return {
        title: removed ? "Worktree removed" : "Worktree removal incomplete",
        output: removed
          ? `Removed worktree at ${args.path}`
          : `Could not fully remove worktree at ${args.path}`,
        metadata: { removed },
      };
    } catch (err) {
      return {
        title: "Worktree removal failed",
        output: `Error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
});

export const hiai_worktree_list = tool({
  description:
    "List all git worktrees for the current project, including the main checkout.",
  args: {},
  async execute(_args, ctx) {
    try {
      const manager = managerFor(ctx);
      const worktrees = await manager.list();
      const lines = worktrees
        .map(
          (w) =>
            `${w.isMain ? "(main) " : ""}${w.name} -> ${w.path} [${w.branch}]`,
        )
        .join("\n");
      return {
        title: `${worktrees.length} worktree(s)`,
        output: lines || "No worktrees found.",
        metadata: { worktrees },
      };
    } catch (err) {
      return {
        title: "Worktree list failed",
        output: `Error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
});

export const hiai_worktree_status = tool({
  description:
    "Get the status of a worktree (or the main checkout if no path is given). Reports whether it is a linked worktree, whether it is pristine, its branch, and its directory.",
  args: {
    path: tool.schema
      .string()
      .optional()
      .describe("Optional worktree directory; defaults to the main checkout"),
  },
  async execute(args, ctx) {
    try {
      const manager = managerFor(ctx);
      const status = await manager.status(args.path);

      // Determine whether the resolved directory is a linked worktree.
      let inside_worktree = false;
      try {
        const worktrees = await manager.list();
        const target = status.directory;
        inside_worktree =
          worktrees.find((w) => w.path === target && w.isLinked) !== undefined;
      } catch {
        // If listing fails, fall back to assuming the main checkout.
      }

      const pristine =
        !status.dirty &&
        !status.hasConflicts &&
        status.ahead === 0 &&
        status.behind === 0;

      return {
        title: "Worktree status",
        output:
          `directory: ${status.directory}\n` +
          `branch: ${status.branch}\n` +
          `inside_worktree: ${inside_worktree}\n` +
          `pristine: ${pristine}`,
        metadata: {
          inside_worktree,
          pristine,
          branch: status.branch,
          directory: status.directory,
        },
      };
    } catch (err) {
      return {
        title: "Worktree status failed",
        output: `Error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
});
