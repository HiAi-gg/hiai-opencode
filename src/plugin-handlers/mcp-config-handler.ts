import type { HiaiOpenCodeConfig } from "../config";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { loadMcpConfigs } from "../features/claude-code-mcp-loader";
import { createBuiltinMcps } from "../mcp";
import type { PluginComponents } from "./plugin-components-loader";
import { log } from "../shared";
import { getPlatformMcpDefaults } from "../shared/runtime-plugin-config";
import { resolveEnvVars } from "../config";

type McpEntry = Record<string, unknown>;

function resolveHeaderAuthFallback(
  pluginConfig: HiaiOpenCodeConfig,
  name: string,
): Record<string, string> | undefined {
  if (name === "stitch" && pluginConfig.auth?.stitch?.trim()) {
    return { "X-Goog-Api-Key": pluginConfig.auth.stitch.trim() };
  }

  return undefined;
}

function resolveEnvironmentAuthFallback(
  pluginConfig: HiaiOpenCodeConfig,
  name: string,
): Record<string, string> | undefined {
  if (name === "firecrawl" && pluginConfig.auth?.firecrawl?.trim()) {
    return { FIRECRAWL_API_KEY: pluginConfig.auth.firecrawl.trim() };
  }

  return undefined;
}

function isDisabledMcpEntry(value: unknown): value is McpEntry & { enabled: false } {
  return typeof value === "object" && value !== null && (value as McpEntry).enabled === false;
}

function captureUserDisabledMcps(
  userMcp: Record<string, unknown> | undefined
): Set<string> {
  const disabled = new Set<string>();
  if (!userMcp) return disabled;

  for (const [name, value] of Object.entries(userMcp)) {
    if (isDisabledMcpEntry(value)) {
      disabled.add(name);
    }
  }

  return disabled;
}

function expandStringRecord(
  record: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!record) return undefined;

  const expanded = Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, resolveEnvVars(value)]),
  );

  return Object.keys(expanded).length > 0 ? expanded : undefined;
}

function hasMissingResolvedValue(record: Record<string, string> | undefined): boolean {
  if (!record) return false;
  return Object.values(record).some((value) => value.trim().length === 0);
}

function hasUsableLocalMcpRuntime(name: string, entry: McpEntry): boolean {
  const command = entry.command;
  if (!Array.isArray(command) || command.length === 0) {
    return true;
  }

  const [binary, ...args] = command;
  if (typeof binary !== "string" || binary.trim().length === 0) {
    return false;
  }

  if (binary === "node" && typeof args[0] === "string" && args[0].endsWith(".mjs")) {
    if (!existsSync(args[0])) {
      return false;
    }

    const probe = spawnSync(binary, ["--version"], {
      stdio: "ignore",
      timeout: 5000,
    });
    return probe.status === 0;
  }

  const probeArgs =
    binary === "npx"
      ? ["--version"]
      : [...args.slice(0, 1), "--help"];
  const probe = spawnSync(binary, probeArgs, {
    stdio: "ignore",
    timeout: 5000,
  });
  return probe.status === 0;
}

function normalizePlatformMcpDefaults(
  defaults: Record<string, unknown>,
  pluginConfig: HiaiOpenCodeConfig,
): Record<string, McpEntry> {
  const normalized: Record<string, McpEntry> = {};

  for (const [name, entry] of Object.entries(defaults)) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }

    const nextEntry: McpEntry = { ...(entry as McpEntry) };
    const headers = expandStringRecord(
      (nextEntry.headers as Record<string, string> | undefined),
    );
    const environment = expandStringRecord(
      (nextEntry.environment as Record<string, string> | undefined),
    );
    const headerFallback = resolveHeaderAuthFallback(pluginConfig, name);
    const environmentFallback = resolveEnvironmentAuthFallback(pluginConfig, name);
    const headersWithFallback =
      headers && headerFallback
        ? { ...headerFallback, ...headers }
        : headers ?? headerFallback;
    const environmentWithFallback =
      environment && environmentFallback
        ? { ...environmentFallback, ...environment }
        : environment ?? environmentFallback;

    const missingResolvedValues =
      hasMissingResolvedValue(headersWithFallback) ||
      hasMissingResolvedValue(environmentWithFallback);

    if (missingResolvedValues) {
      log(`MCP server "${name}" is missing environment-backed auth; keeping it visible in config`);
    }

    if (!hasUsableLocalMcpRuntime(name, nextEntry)) {
      log(`Skipping MCP server "${name}" because its local runtime is unavailable`);
      continue;
    }

    if (headersWithFallback && !hasMissingResolvedValue(headersWithFallback)) {
      nextEntry.headers = headersWithFallback;
    }

    if (environmentWithFallback && !hasMissingResolvedValue(environmentWithFallback)) {
      nextEntry.environment = environmentWithFallback;
    }

    normalized[name] = nextEntry;
  }

  return normalized;
}

export async function applyMcpConfig(params: {
  config: Record<string, unknown>;
  pluginConfig: HiaiOpenCodeConfig;
  pluginComponents: PluginComponents;
}): Promise<void> {
  const disabledMcps = params.pluginConfig.disabled_mcps ?? [];
  const userMcp = params.config.mcp as Record<string, unknown> | undefined;
  const userDisabledMcps = captureUserDisabledMcps(userMcp);

  const mcpResult = params.pluginConfig.claude_code?.mcp ?? true
    ? await loadMcpConfigs(disabledMcps)
    : { servers: {} };

  if (userMcp) {
    for (const name of Object.keys(userMcp)) {
      if (name in mcpResult.servers) {
        log(`warning: MCP server "${name}" from user config overrides Claude Code .mcp.json`);
      }
    }
  }

  const merged = {
    ...normalizePlatformMcpDefaults(
      getPlatformMcpDefaults(params.pluginConfig) as unknown as Record<string, unknown>,
      params.pluginConfig,
    ),
    ...createBuiltinMcps(disabledMcps, params.pluginConfig),
    ...mcpResult.servers,
    ...(userMcp ?? {}),
    ...params.pluginComponents.mcpServers,
  } as Record<string, McpEntry>;

  for (const name of userDisabledMcps) {
    if (merged[name]) {
      merged[name] = { ...merged[name], enabled: false };
    }
  }

  const disabledSet = new Set(disabledMcps);
  for (const name of disabledSet) {
    delete merged[name];
  }

  params.config.mcp = merged;
}
