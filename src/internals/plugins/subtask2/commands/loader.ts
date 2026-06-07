/// <reference types="bun-types" />

import { join } from "path";
import { getOpenCodeConfigDir } from "../../../../shared/opencode-config-dir";
import { logWarn } from "../../../../shared/logger";

/**
 * Commands: File loading
 */

export async function loadCommandFile(
  name: string
): Promise<{ content: string; path: string } | null> {
  const dirs = [
    join(getOpenCodeConfigDir({ binary: "opencode" }), "command"),
    join(Bun.env.PWD ?? ".", ".opencode", "command"),
  ];

  for (const dir of dirs) {
    // Try direct path first, then search subdirs
    const directPath = `${dir}/${name}.md`;
    try {
      const file = Bun.file(directPath);
      if (await file.exists()) {
        return { content: await file.text(), path: directPath };
      }
    } catch (error) {
      // Direct path probe failed (missing dir, EACCES). Move on to glob scan.
      logWarn("[subtask2:loader] direct path probe failed", {
        path: directPath,
        error: String(error),
      });
    }

    // Search subdirs for name.md
    try {
      const glob = new Bun.Glob(`**/${name}.md`);
      for await (const match of glob.scan(dir)) {
        const fullPath = `${dir}/${match}`;
        const content = await Bun.file(fullPath).text();
        return { content, path: fullPath };
      }
    } catch (error) {
      // Glob scan failed (dir doesn't exist, permission). Try the next dir.
      logWarn("[subtask2:loader] glob scan failed", {
        dir,
        error: String(error),
      });
    }
  }
  return null;
}
