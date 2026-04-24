import type { CommandConfig } from "../types";

/**
 * Commands: Command resolution
 */

// Normalize command name - try multiple variations to find a match
export function getConfig(
  configs: Record<string, CommandConfig>,
  cmd: string
): CommandConfig | undefined {
  // Direct match
  if (configs[cmd]) return configs[cmd];

  // Try filename-only (last segment of path)
  const filenameOnly = cmd.split("/").pop()!;
  if (configs[filenameOnly]) return configs[filenameOnly];

  // Try with slashes replaced by hyphens
  const hyphenated = cmd.replace(/\//g, "-");
  if (configs[hyphenated]) return configs[hyphenated];

  // Try converting hyphens back to slashes
  const slashed = cmd.replace(/-/g, "/");
  if (configs[slashed]) return configs[slashed];

  return undefined;
}
