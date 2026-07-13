import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import type { BobConfig } from "../../types";
import { getMcpConfig } from "./registry";
import { logger } from "../../util/log";

const MCP_EXPORT_MARKER = "hiai-opencode";

/**
 * Build the static `.mcp.json` payload from the merged runtime config.
 *
 * The payload mirrors what `assets/cli/hiai-opencode.mjs createMcpExport` emits,
 * so the auto-export at startup and the manual `export-mcp` command stay in
 * sync. Registry servers are emitted first, then any user-defined MCP servers
 * (under `config.mcp`) that carry a `command`/`url` are passed through.
 */
export function buildStaticMcpPayload(config: BobConfig): Record<string, unknown> {
  const validated = getMcpConfig(config.mcp ?? {}, config.auth);
  const servers: Record<string, Record<string, unknown>> = {};

  for (const [name, entry] of Object.entries(validated)) {
    const e = entry as Record<string, unknown>;
    if (e.type === "local" && Array.isArray(e.command) && e.command.length > 0) {
      // Registry local commands are full argv arrays (e.g.
      // ["npx","-y","@modelcontextprotocol/server-sequential-thinking"]).
      // Split into command + args for the static .mcp.json shape.
      const cmd = e.command as string[];
      servers[name] = { command: cmd[0], args: cmd.slice(1) };
    } else if (e.type === "remote" && typeof e.url === "string") {
      const remote: Record<string, unknown> = { type: "http", url: e.url };
      if (e.headers) remote.headers = e.headers;
      servers[name] = remote;
    }
  }

  // Pass through user-defined MCP servers not in the registry, as long as they
  // carry a valid command or url (a bare { enabled: true } is not a valid spec
  // and is ignored rather than forwarded to the host broken).
  for (const [name, entry] of Object.entries(config.mcp ?? {})) {
    if (servers[name]) continue;
    if (!entry || entry.enabled === false) continue;
    const userEntry = entry as Record<string, unknown>;
    if (typeof userEntry.command === "string") {
      servers[name] = {
        command: userEntry.command,
        ...(Array.isArray(userEntry.args) ? { args: userEntry.args } : {}),
      };
    } else if (typeof userEntry.url === "string") {
      servers[name] = { type: "http", url: userEntry.url };
    }
  }

  return {
    _meta: {
      generatedBy: MCP_EXPORT_MARKER,
      version: 1,
      generatedAt: new Date().toISOString(),
    },
    mcpServers: servers,
  };
}

function isManagedStaticMcpFile(path: string): boolean {
  if (!existsSync(path)) return false;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8"));
    return parsed?._meta?.generatedBy === MCP_EXPORT_MARKER;
  } catch {
    return false;
  }
}

/**
 * Resolve the export path. Priority:
 *   1. HIAI_OPENCODE_MCP_EXPORT_PATH (absolute or relative to projectDir)
 *   2. <projectDir>/.opencode/.mcp.json
 */
function resolveExportPath(projectDir: string): string {
  const envPath = process.env.HIAI_OPENCODE_MCP_EXPORT_PATH?.trim();
  if (envPath) {
    return isAbsolute(envPath) ? envPath : join(projectDir, envPath);
  }
  return join(projectDir, ".opencode", ".mcp.json");
}

/**
 * Auto-export a static `.opencode/.mcp.json` at plugin startup so that hosts
 * whose `opencode mcp list` only reads static config (not runtime plugin MCP)
 * can still see the hiai-managed servers.
 *
 * Controlled by env:
 *   - HIAI_OPENCODE_AUTO_EXPORT_MCP:
 *       "if-missing" (default) — write only when the file does not exist
 *       "always"               — refresh; in `safe` mode overwrites only
 *                                hiai-managed exports, in `force` mode any file
 *       "off" / "0" / "false"  — disable auto-export entirely
 *   - HIAI_OPENCODE_MCP_EXPORT_PATH: override the output path
 *   - HIAI_OPENCODE_EXPORT_MCP_MODE: "safe" (default) | "force"
 *       In `always` mode, `safe` refuses to overwrite a non-managed file;
 *       `force` overwrites it.
 *
 * Never throws — auto-export is best-effort and must not break plugin load.
 */
export function autoExportStaticMcp(
  config: BobConfig,
  projectDir: string,
): void {
  const rawMode = process.env.HIAI_OPENCODE_AUTO_EXPORT_MCP?.trim().toLowerCase();
  const mode =
    rawMode === "" || rawMode === undefined ? "if-missing" : rawMode;
  if (mode === "off" || mode === "0" || mode === "false" || mode === "disabled") {
    return;
  }

  const outputPath = resolveExportPath(projectDir);
  const exists = existsSync(outputPath);

  if (mode === "if-missing" && exists) {
    return;
  }

  // `always` mode: respect safe/force overwrite policy.
  if (mode === "always" && exists) {
    const overwriteMode = process.env.HIAI_OPENCODE_EXPORT_MCP_MODE?.trim().toLowerCase() || "safe";
    if (overwriteMode !== "force" && !isManagedStaticMcpFile(outputPath)) {
      logger.log(
        `[hiai-opencode] auto-export: refusing to overwrite non-managed ${outputPath} (set HIAI_OPENCODE_EXPORT_MCP_MODE=force to override)`,
      );
      return;
    }
  }

  try {
    const payload = buildStaticMcpPayload(config);
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
    const servers = payload.mcpServers as Record<string, unknown>;
    const count = Object.keys(servers).length;
    logger.log(
      `[hiai-opencode] auto-export: wrote ${outputPath} (${count} servers, mode=${mode})`,
    );
  } catch (err) {
    logger.error(
      `[hiai-opencode] auto-export: failed to write ${outputPath}:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}
