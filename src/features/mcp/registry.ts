import { resolveEnvVars } from "../../shared/env";
import { logger } from "../../util/log";

// NOTE: DEFAULT_MCP_TIMEOUT is intentionally NOT part of `config.tool_settings`.
// It is a well-named, build-time MCP wiring constant (not a runtime-tunable
// tool default), so it stays here rather than being migrated to bob.json.
const DEFAULT_MCP_TIMEOUT = 60_000; // 60s per request

/**
 * Default MCP registry — the single source of truth for hiai-opencode's
 * always-on MCP servers. The CLI (assets/cli/hiai-opencode.mjs) mirrors this
 * set; keep them in sync.
 *
 * Current set (v0.3.0+):
 *   - sequential-thinking : local npx-backed reasoning server
 *   - grep_app            : remote code-search endpoint (no key required)
 *
 * Removed: context7 (on-demand CLI skill via skill("explore/context7")),
 * stitch (UI gen), mempalace (external memory — host provides native `memory`).
 */
export const MCP_REGISTRY: Record<
  string,
  {
    type: "local" | "remote";
    command?: string[];
    url?: string;
    environment?: Record<string, string>;
    headers?: Record<string, string>;
    requiredEnv?: string[];
    timeout?: number;
  }
> = {
  "sequential-thinking": {
    type: "local",
    command: ["npx", "-y", "@modelcontextprotocol/server-sequential-thinking"],
    requiredEnv: [],
    timeout: DEFAULT_MCP_TIMEOUT,
  },
  grep_app: {
    type: "remote",
    url: "https://mcp.grep.app",
    requiredEnv: [],
    timeout: DEFAULT_MCP_TIMEOUT,
  },
};

export function getMcpConfig(
  enabledMcp: Record<string, { enabled: boolean }>,
  authConfig?: Record<string, string>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [name, registry] of Object.entries(MCP_REGISTRY)) {
    const userToggle = enabledMcp[name];
    // A user entry that omits `enabled` is treated as enabled. Only an explicit
    // `{ enabled: false }` disables a registry server.
    if (userToggle && userToggle.enabled === false) continue;

    if (registry.requiredEnv && registry.requiredEnv.length > 0) {
      const missing = registry.requiredEnv.filter((k) => !process.env[k]);
      if (missing.length > 0) {
        logger.log(
          `[hiai-opencode] MCP ${name} skipped: missing env: ${missing.join(", ")}`,
        );
        continue;
      }
    }

    const headers = resolveEnvVars({ ...registry.headers });
    if (authConfig?.[name] && Object.keys(headers).length > 0) {
      // When auth is configured for a server, inject the token into every
      // declared header key. (No current registry entry uses headers/auth,
      // but this keeps custom remote servers supported.)
      for (const key of Object.keys(headers)) {
        headers[key] = authConfig[name];
      }
    }

    if (registry.type === "local" && registry.command) {
      result[name] = {
        type: "local",
        command: registry.command,
        ...(registry.environment
          ? { environment: resolveEnvVars(registry.environment) }
          : {}),
        ...(registry.timeout ? { timeout: registry.timeout } : {}),
      };
    } else if (registry.type === "remote" && registry.url) {
      result[name] = {
        type: "remote",
        url: registry.url,
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
        ...(registry.timeout ? { timeout: registry.timeout } : {}),
      };
    }
  }
  return result;
}
