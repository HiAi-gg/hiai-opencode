import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnvFile } from "../../config";
import type { BobConfig } from "../../types";
import { logger } from "../../util/log";

/** Log prefix for this plugin's runtime messages. */
const LOG_PREFIX = "[hiai-opencode]";

/** Shape of the `shell_env` block in bob.json. */
export interface ShellEnvConfig {
  variables?: string[];
  inject_in?: string[];
  env_file?: string;
}

/**
 * Ordered list of .env files scanned by `loadEnvFiles()`.
 * `config.env_file` (if set) is consulted first, then bob.env, .env.local, .env.
 * First file to set a key wins (first-match-wins per key).
 */
const DEFAULT_ENV_FILES = ["bob.env", ".env.local", ".env"] as const;

/**
 * ShellEnvContext reads project-specific environment variables from bob.json
 * (`shell_env.variables`) and from .env files on disk, then exposes them for
 * injection into subprocesses spawned by agent-browser, firecrawl, and bash.
 *
 * SECURITY: this module never logs or returns secret VALUES. Debug output only
 * ever prints variable NAMES (e.g. "injecting env vars: DATABASE_URL, REDIS_URL").
 */
export class ShellEnvContext {
  private readonly config: ShellEnvConfig;
  private readonly projectDir: string;
  private envCache: Record<string, string> | null = null;
  private loaded = false;

  constructor(config: ShellEnvConfig | undefined, projectDir: string) {
    this.config = config ?? {};
    this.projectDir = projectDir;
  }

  /**
   * Read .env files from disk and cache the merged key/value pairs.
   * Does NOT mutate process.env — values are only exposed via getShellEnv().
   * Idempotent: safe to call multiple times.
   */
  loadEnvFiles(): void {
    if (this.loaded) return;

    const fileOrder: string[] = this.config.env_file
      ? [this.config.env_file, ...DEFAULT_ENV_FILES]
      : [...DEFAULT_ENV_FILES];

    const merged: Record<string, string> = {};
    const loadedFrom: string[] = [];

    for (const name of fileOrder) {
      const path = join(this.projectDir, name);
      if (!existsSync(path)) continue;
      try {
        const text = readFileSync(path, "utf-8");
        for (const { key, value } of parseEnvFile(text)) {
          // First file to set a key wins.
          if (!(key in merged)) merged[key] = value;
        }
        loadedFrom.push(name);
      } catch (err) {
        logger.warn(
          `${LOG_PREFIX} shell-env: failed to read ${path}: ${(err as Error).message}`,
        );
      }
    }

    this.envCache = merged;
    this.loaded = true;

    // SECURITY: log only file NAMES, never contents/values.
    if (loadedFrom.length > 0) {
      logger.log(
        `${LOG_PREFIX} shell-env: loaded env files: ${loadedFrom.join(", ")}`,
      );
    }
  }

  /**
   * Returns the merged environment variables to inject into a subprocess.
   *
   * Only variables listed in `config.variables` are considered. For each one,
   * the value is taken from process.env first (precedence), falling back to the
   * loaded .env files. Variables not present anywhere are skipped.
   *
   * SECURITY: only variable NAMES are logged, never values.
   */
  getShellEnv(): Record<string, string> {
    this.loadEnvFiles();
    const variables = this.config.variables ?? [];
    const result: Record<string, string> = {};
    const injected: string[] = [];

    for (const name of variables) {
      const fromEnv = process.env[name];
      const fromFile = this.envCache?.[name];
      // process.env takes precedence over .env file values.
      const value = fromEnv ?? fromFile;
      if (value !== undefined) {
        result[name] = value;
        injected.push(name);
      }
    }

    // SECURITY: log only variable NAMES, never values.
    if (injected.length > 0) {
      logger.log(
        `${LOG_PREFIX} shell-env: injecting env vars: ${injected.join(", ")}`,
      );
    }

    return result;
  }

  /**
   * Whether a given integration target (e.g. "agent-browser", "firecrawl",
   * "bash") is enabled for env injection per `config.inject_in`.
   */
  shouldInjectInto(target: string): boolean {
    const injectIn = this.config.inject_in ?? [];
    return injectIn.includes(target);
  }

  /**
   * Returns a full subprocess env object (`process.env` merged with the
   * injected shell vars) when injection is enabled for `target`, otherwise
   * `undefined` so callers can fall back to their own default env handling.
   */
  getSubprocessEnv(target: string): Record<string, string> | undefined {
    if (!this.shouldInjectInto(target)) return undefined;
    // process.env is Record<string, string | undefined> in modern @types/node;
    // copy entries with defined values into a clean Record<string, string>.
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) env[key] = value;
    }
    return { ...env, ...this.getShellEnv() };
  }
}

// ── Module-level singleton ──
let shellEnvContext: ShellEnvContext | null = null;

/** Initialize the process-wide ShellEnvContext. Call once at plugin load. */
export function initShellEnv(
  config: BobConfig["shell_env"],
  projectDir: string,
): ShellEnvContext {
  shellEnvContext = new ShellEnvContext(config, projectDir);
  return shellEnvContext;
}

/** Read the active ShellEnvContext singleton (null before init). */
export function getShellEnvContext(): ShellEnvContext | null {
  return shellEnvContext;
}

/**
 * Convenience accessor: returns the merged env vars to inject, or {} when the
 * feature is not configured. Optionally gated by an integration `target`
 * (only returns non-empty when `shouldInjectInto(target)` is true).
 */
export function getShellEnv(target?: string): Record<string, string> {
  if (!shellEnvContext) return {};
  if (target && !shellEnvContext.shouldInjectInto(target)) return {};
  return shellEnvContext.getShellEnv();
}

/**
 * Returns a full subprocess env object for `target`, or `undefined` when
 * injection is disabled for that target. Callers should fall back to their
 * own default env (typically `{ ...process.env }`) when this returns undefined.
 */
export function getSubprocessEnv(
  target: string,
): Record<string, string> | undefined {
  if (!shellEnvContext) return undefined;
  return shellEnvContext.getSubprocessEnv(target);
}
