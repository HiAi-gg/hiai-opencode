import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "jsonc-parser";
import { HiaiOpencodeConfigSchema } from "./platform-schema.js";
import { defaultConfig } from "./defaults.js";
import type { HiaiOpencodeConfig } from "./types.js";

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

export function loadConfig(projectDir: string): HiaiOpencodeConfig {
  const searchDirs = [
    projectDir,
    join(projectDir, ".opencode"),
    join(process.env.HOME || "", ".config", "opencode"),
  ];

  const configPath = findConfigFile(searchDirs);

  if (!configPath) return defaultConfig;

  const raw = readFileSync(configPath, "utf-8");
  const parsed = parse(raw);
  const validated = HiaiOpencodeConfigSchema.parse(parsed);

  return deepMerge(
    defaultConfig as Record<string, unknown>,
    validated as Record<string, unknown>,
  ) as HiaiOpencodeConfig;
}

export function resolveEnvVars(value: string): string {
  return value.replace(/\{env:([^}]+)\}/g, (_, key) => process.env[key] || "");
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
