/**
 * Workspace awareness context for agent prompts.
 *
 * Uses the active {@link WorkspaceAdapter} to describe the current project's
 * workspace root, monorepo status, package root, and project type so agents
 * can correctly route tasks to the right package directory in a monorepo.
 */

import { getWorkspaceAdapter } from "../features/workspace-adapter";

/**
 * Build a workspace-awareness context block for the current (or given)
 * directory. Returns a markdown string suitable for injection into agent
 * prompts. When no workspace root is detected, a neutral note is returned.
 */
export function getWorkspaceContext(dir?: string): string {
  const adapter = getWorkspaceAdapter();
  const info = adapter.getProjectInfo(dir ?? process.cwd());

  const lines: string[] = ["## Workspace Awareness"];

  if (info.workspaceRoot) {
    lines.push(`- Workspace root: ${info.workspaceRoot}`);
    lines.push(`- Monorepo: ${info.isMonorepo ? "yes" : "no"}`);
    if (info.isMonorepo) {
      lines.push(
        "- This is a monorepo. Route tasks to the correct package directory; resolve workspace-relative paths from the workspace root.",
      );
    }
  } else {
    lines.push(
      "- No workspace root detected (single-package or non-JS project).",
    );
  }

  if (info.packageRoot) {
    lines.push(`- Package root: ${info.packageRoot}`);
  }
  lines.push(`- Project type: ${info.type}`);
  if (info.packageManager) {
    lines.push(`- Package manager: ${info.packageManager}`);
  }

  return lines.join("\n");
}

/** Static awareness note (mirrors WORKTREE_AWARENESS usage). */
export const WORKSPACE_AWARENESS = getWorkspaceContext();
