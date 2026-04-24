export { createBuiltinMcps } from "./omo-mcp-index"
export { McpNameSchema, type McpName, type AnyMcpName } from "./types"

import type { McpServerConfig } from "../config/types.js";
import { resolveEnvVars } from "../config/loader.js";

export function buildMcpConfig(mcp: Record<string, McpServerConfig>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [name, server] of Object.entries(mcp)) {
    if (!server.enabled) continue;

    const entry: Record<string, unknown> = { enabled: true };

    if (server.type === "remote") {
      entry.type = "remote";
      entry.url = server.url;
      if (server.headers) {
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(server.headers)) {
          headers[k] = resolveEnvVars(v);
        }
        entry.headers = headers;
      }
    } else {
      entry.type = "local";
      if (server.command) {
        entry.command = server.command;
      }
    }

    if (server.timeout) entry.timeout = server.timeout;

    if (server.environment) {
      const env: Record<string, string> = {};
      for (const [k, v] of Object.entries(server.environment)) {
        env[k] = resolveEnvVars(v);
      }
      entry.environment = env;
    }

    result[name] = entry;
  }

  return result;
}

export function buildMcpPermissions(mcp: Record<string, McpServerConfig>): Record<string, string> {
  const perms: Record<string, string> = {};
  for (const name of Object.keys(mcp)) {
    perms[`${name}_*`] = "allow";
  }
  return perms;
}
