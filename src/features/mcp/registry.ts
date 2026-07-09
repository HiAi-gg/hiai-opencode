import { resolveEnvVars } from '../../shared/env';

const DEFAULT_MCP_TIMEOUT = 60_000; // 60s per request

export const MCP_REGISTRY: Record<
  string,
  {
    type: 'local' | 'remote';
    command?: string[];
    url?: string;
    environment?: Record<string, string>;
    headers?: Record<string, string>;
    install?: 'bundled' | 'npm' | 'python' | 'remote';
    requiredEnv?: string[];
    optionalEnv?: string[];
    timeout?: number;
  }
> = {
  'sequential-thinking': {
    type: 'local',
    command: ['npx', '-y', '@modelcontextprotocol/server-sequential-thinking'],
    requiredEnv: [],
    optionalEnv: [],
    timeout: DEFAULT_MCP_TIMEOUT,
  },
  grep_app: {
    type: 'remote',
    url: 'https://mcp.grep.app',
    requiredEnv: [],
    optionalEnv: [],
    timeout: DEFAULT_MCP_TIMEOUT,
  },
  // NOTE: context7 was removed from the MCP registry (per the original fork plan).
  // Library docs lookups are now on-demand via the `context7` skill/CLI
  // (see bob/skills/context7/SKILL.md) — no always-on MCP process.
  //
  // NOTE: Stitch (UI gen) and MemPalace (external memory) were intentionally removed.
  // The host runtime provides a native `memory` tool (persistent + FTS-indexed);
  // design uses the bundled design-systems/. Do not re-add a memory MCP.
};

export function getMcpConfig(
  enabledMcp: Record<string, { enabled: boolean }>,
  authConfig?: Record<string, string>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [name, registry] of Object.entries(MCP_REGISTRY)) {
    const userToggle = enabledMcp[name];
    if (userToggle && !userToggle.enabled) continue;

    if (registry.requiredEnv && registry.requiredEnv.length > 0) {
      const missing = registry.requiredEnv.filter((k) => !process.env[k]);
      if (missing.length > 0) {
        console.log(`[bob] MCP ${name} skipped: missing env: ${missing.join(', ')}`);
        continue;
      }
    }

    const headers = { ...registry.headers };
    if (authConfig?.[name]) {
      if (Object.keys(headers).length === 0) {
        console.log(`[bob] MCP ${name} has auth but no header template`);
      } else {
        for (const key of Object.keys(headers)) {
          headers[key] = authConfig[name];
        }
      }
    }

    if (registry.type === 'local' && registry.command) {
      result[name] = {
        type: 'local',
        command: registry.command,
        ...(registry.environment ? { environment: resolveEnvVars(registry.environment) } : {}),
        ...(registry.timeout ? { timeout: registry.timeout } : {}),
      };
    } else if (registry.type === 'remote' && registry.url) {
      result[name] = {
        type: 'remote',
        url: registry.url,
        ...(Object.keys(headers).length > 0 ? { headers: resolveEnvVars(headers) } : {}),
        ...(registry.timeout ? { timeout: registry.timeout } : {}),
      };
    }
  }
  return result;
}
