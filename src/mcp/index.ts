export { createBuiltinMcps } from "./omo-mcp-index"
export { McpNameSchema, type McpName, type AnyMcpName } from "./types"

import { existsSync } from "node:fs";
import { join } from "node:path";
import type { McpServerConfig } from "../config/types.js";
import { resolveEnvVars } from "../config/loader.js";

const ASSETS_DIR = join(import.meta.dirname || __dirname, "..", "assets", "mcp");

function resolveBundledMcp(name: string): string {
  const script = join(ASSETS_DIR, name);
  if (existsSync(script)) return script;
  return "";
}

export function buildMcpConfig(mcp: Record<string, McpServerConfig>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  const defaults: Record<string, McpServerConfig> = {
    rag: {
      enabled: true,
      type: "local",
      command: ["node", resolveBundledMcp("rag.mjs")].filter(Boolean),
      environment: {
        OPENCODE_RAG_URL: "http://localhost:9002/tools/search",
      },
    },
    mempalace: {
      enabled: true,
      type: "local",
      command: ["node", resolveBundledMcp("mempalace.mjs"), "--palace", "./.opencode/palace"].filter(Boolean),
      timeout: 60000,
    },
  };

  for (const [name, server] of Object.entries(defaults)) {
    if (!(name in mcp) && server.command && server.command.length >= 2) {
      mcp[name] = server;
    }
  }

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
