import type { LspServerConfig } from "../config/types.js";

export function buildLspConfig(lsp: Record<string, LspServerConfig>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [name, server] of Object.entries(lsp)) {
    if (server.enabled === false) continue;
    result[name] = {
      command: server.command,
      extensions: server.extensions,
      ...(server.initialization ? { initialization: server.initialization } : {}),
    };
  }

  return result;
}
