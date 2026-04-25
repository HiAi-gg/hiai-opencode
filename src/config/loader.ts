import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "jsonc-parser";
import { HiaiOpencodeConfigSchema } from "./platform-schema.js";
import { applyModelSlots, defaultConfig } from "./defaults.js";
import {
  LEGACY_AGENT_ALIAS_TO_CANONICAL,
  type CanonicalAgentName,
  type HiaiOpencodeConfig,
} from "./types.js";

const LEGACY_AGENT_ALIAS_LOOKUP = new Map<string, CanonicalAgentName>(
  Object.entries(LEGACY_AGENT_ALIAS_TO_CANONICAL).map(([alias, canonical]) => [
    alias.toLowerCase(),
    canonical,
  ]),
);

const BASE_CONFIG = normalizeAgentAliases(defaultConfig);

const CONFIG_FILENAMES = [
  "hiai-opencode.json",
  "hiai-opencode.jsonc",
];

function deepMerge<T extends Record<string, unknown>>(base: T, override: Partial<T>): T {
  const result = { ...base };
  for (const key of Object.keys(override) as Array<keyof T>) {
    const val = override[key];
    if (
      val !== null &&
      val !== undefined &&
      typeof val === "object" &&
      !Array.isArray(val) &&
      typeof base[key] === "object" &&
      base[key] !== null &&
      !Array.isArray(base[key])
    ) {
      result[key] = deepMerge(
        base[key] as Record<string, unknown>,
        val as Record<string, unknown>,
      ) as T[keyof T];
    } else if (val !== undefined) {
      result[key] = val as T[keyof T];
    }
  }
  return result;
}

function findConfigFile(searchDirs: string[]): string | null {
  for (const dir of searchDirs) {
    for (const filename of CONFIG_FILENAMES) {
      const candidate = join(dir, filename);
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function toCanonicalAgentName(name: string): string {
  return LEGACY_AGENT_ALIAS_LOOKUP.get(name.toLowerCase()) ?? name;
}

function normalizeAgentKeyedRecord<T>(
  record?: Record<string, T>,
): Record<string, T> | undefined {
  if (!record) return record;

  const normalized: Record<string, T> = {};
  const aliasEntries: Array<[string, T]> = [];

  for (const [rawName, config] of Object.entries(record)) {
    const canonicalName = toCanonicalAgentName(rawName);
    if (canonicalName === rawName) {
      normalized[rawName] = config;
      continue;
    }
    aliasEntries.push([canonicalName, config]);
  }

  // Explicit canonical/custom entries win over deprecated aliases.
  for (const [canonicalName, config] of aliasEntries) {
    if (!(canonicalName in normalized)) {
      normalized[canonicalName] = config;
    }
  }

  return normalized;
}

function normalizeAgentAliases(config: HiaiOpencodeConfig): HiaiOpencodeConfig {
  const normalizedAgents = normalizeAgentKeyedRecord(config.agents);
  const normalizedRequirements = normalizeAgentKeyedRecord(
    config.agentRequirements,
  );

  return {
    ...config,
    ...(normalizedAgents ? { agents: normalizedAgents } : {}),
    ...(normalizedRequirements
      ? { agentRequirements: normalizedRequirements }
      : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeCompactLspConfig(rawConfig: unknown): unknown {
  if (!isRecord(rawConfig)) return rawConfig;
  const rawLsp = rawConfig.lsp;
  if (!isRecord(rawLsp)) return rawConfig;

  const normalizedLsp: Record<string, unknown> = {};
  const baseLsp = BASE_CONFIG.lsp ?? {};

  for (const [serverId, rawEntry] of Object.entries(rawLsp)) {
    if (!isRecord(rawEntry)) continue;

    const normalizedEntry: Record<string, unknown> = { ...rawEntry };
    const baseEntry = baseLsp[serverId];

    if (!Array.isArray(normalizedEntry.command) && baseEntry?.command) {
      normalizedEntry.command = [...baseEntry.command];
    }

    if (!Array.isArray(normalizedEntry.extensions) && baseEntry?.extensions) {
      normalizedEntry.extensions = [...baseEntry.extensions];
    }

    if (Array.isArray(normalizedEntry.command) && Array.isArray(normalizedEntry.extensions)) {
      normalizedLsp[serverId] = normalizedEntry;
    }
  }

  return {
    ...rawConfig,
    lsp: normalizedLsp,
  };
}

export function loadConfig(projectDir: string): HiaiOpencodeConfig {
  const searchDirs = [
    projectDir,
    join(projectDir, ".opencode"),
    join(process.env.HOME || "", ".config", "opencode"),
  ];

  const configPath = findConfigFile(searchDirs);

  if (!configPath) return BASE_CONFIG;

  const raw = readFileSync(configPath, "utf-8");
  const parsed = parse(raw);
  const normalizedParsed = normalizeCompactLspConfig(parsed);
  const validated = HiaiOpencodeConfigSchema.parse(normalizedParsed);
  const normalized = normalizeAgentAliases(validated);

  const merged = deepMerge(
    BASE_CONFIG as unknown as Record<string, unknown>,
    normalized as unknown as Record<string, unknown>,
  ) as HiaiOpencodeConfig;

  return applyModelSlots(merged);
}

export function resolveEnvVars(value: string): string {
  return value.replace(/\{env:([^}]+)\}/g, (_, expression) => {
    const [key, fallback] = String(expression).split(":-", 2);
    return process.env[key] || fallback || "";
  });
}

export function resolveMcpEnv(config: HiaiOpencodeConfig): HiaiOpencodeConfig {
  if (!config.mcp) return config;
  const mcp = { ...config.mcp };
  for (const [name, server] of Object.entries(mcp)) {
    if (server.environment) {
      const env: Record<string, string> = {};
      for (const [k, v] of Object.entries(server.environment)) {
        env[k] = resolveEnvVars(v);
      }
      mcp[name] = { ...server, environment: env };
    }
  }
  return { ...config, mcp };
}
