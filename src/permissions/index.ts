import type { PermissionsConfig } from "../config/types.js";
import { buildMcpPermissions } from "../mcp/index.js";
import type { McpServerConfig } from "../config/types.js";

export function buildPermissions(
  perms: PermissionsConfig,
  mcp: Record<string, McpServerConfig>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (perms.read) result.read = perms.read;
  if (perms.edit) result.edit = perms.edit;
  if (perms.bash) result.bash = perms.bash;

  const mcpPerms = buildMcpPermissions(mcp);
  if (Object.keys(mcpPerms).length > 0) {
    result.bash = { ...(result.bash as Record<string, string> || {}), ...mcpPerms };
  }

  if (perms.deny_paths && perms.deny_paths.length > 0) {
    result.deny_paths = perms.deny_paths;
  }

  return result;
}
