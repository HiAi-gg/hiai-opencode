import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveEnvVars } from "./shared/env";
import type { BobConfig } from "./types";
import { logger } from "./util/log";

// Plugin root: two levels up from src/config.ts (src/ → hiai-opencode/)
const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, "..");

/**
 * Parse an env file and return key-value pairs.
 * Supports both `export KEY=value` and plain `KEY=value` lines.
 * Does NOT clobber existing process.env values.
 */
export function parseEnvFile(
  text: string,
): Array<{ key: string; value: string }> {
  const entries: Array<{ key: string; value: string }> = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    // Match export KEY=value or KEY=value
    const match = trimmed.match(/^(?:export\s+)?(\w+)=(.*)$/);
    if (match) {
      const key = match[1] ?? "";
      const rawValue = match[2] ?? "";
      const value = rawValue.replace(/^['"]|['"]$/g, "");
      entries.push({ key, value });
    }
  }
  return entries;
}

/**
 * Keys that are managed by bob.env and should take precedence over any stale
 * shell-env values. For these keys the project/global bob.env value is the
 * source of truth and will always be written to process.env (overriding a
 * stale shell shadow if one exists), with a one-line log that does NOT include
 * the actual secret value.
 */
const MANAGED_ENV_KEYS = new Set([
  "FIRECRAWL_API_KEY",
  "CONTEXT7_API_KEY",
  "AGENT_BROWSER_SESSION",
  "GREP_APP_API_KEY",
] as const);

/**
 * Load bob.env from multiple paths.
 * Env-file priority (highest first): projectDir → projectDir/.opencode →
 * globalConfigDir → PLUGIN_ROOT (fallback).
 * Among env files: first file that sets a key wins (first-match-wins).
 *
 * For managed keys (FIRECRAWL_API_KEY etc.): the env-file value always wins
 * over any pre-existing shell value, and a one-line override notice is printed.
 * For all other keys: existing process.env values are preserved (no-clobber).
 */
export function loadEnvFiles(projectDir: string): void {
  const globalDir = globalConfigDir();
  const candidates = [
    join(projectDir, "bob.env"),
    join(projectDir, ".opencode", "bob.env"),
    join(globalDir, "bob.env"),
    join(PLUGIN_ROOT, "bob.env"),
  ];

  // Phase 1 – collect first-env-file value for every key (respects file priority)
  const envFileValues = new Map<string, { value: string; path: string }>();
  for (const envPath of candidates) {
    if (!existsSync(envPath)) continue;
    try {
      const text = readFileSync(envPath, "utf-8");
      const entries = parseEnvFile(text);
      for (const { key, value } of entries) {
        // First file wins for each key
        if (!envFileValues.has(key)) {
          envFileValues.set(key, { value, path: envPath });
        }
      }
    } catch (err) {
      logger.warn(
        "[hiai-opencode] Failed to load env from",
        envPath,
        ":",
        err,
      );
    }
  }

  // Phase 2 – apply to process.env
  for (const [key, { value, path }] of envFileValues) {
    const isManaged = (MANAGED_ENV_KEYS as ReadonlySet<string>).has(key);
    const hadShellValue = key in process.env;

    if (isManaged) {
      // Managed key: env-file value is authoritative — override stale shell value
      process.env[key] = value;
      if (hadShellValue) {
        // Log presence + source file only — never the value itself
        logger.log(`[hiai-opencode] env override for ${key} from ${path}`);
      }
    } else {
      // Non-managed key: preserve any existing shell value
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

export const DEFAULT_CONFIG: BobConfig = {
  models: {},
  mcp: {
    "sequential-thinking": { enabled: true },
    grep_app: { enabled: true },
  },
  lsp: {
    typescript: { enabled: true },
    svelte: { enabled: true },
    eslint: { enabled: true },
    pyright: { enabled: true },
  },
  agent_restrictions: {
    bob: {
      write: false,
      edit: false,
      bash: false,
      apply_patch: false,
      grep: false,
      glob: false,
      webfetch: false,
      // LSP tools — bob delegates diagnostics/symbols to subagents
      lsp_diagnostics: false,
      lsp_goto_definition: false,
      lsp_find_references: false,
      lsp_symbols: false,
      lsp_prepare_rename: false,
      lsp_rename: false,
    },
    plan: { bash: false, grep: false, glob: false, webfetch: false },
    critic: {
      write: false,
      edit: false,
      grep: false,
      glob: false,
      // agent_browser_* restrictions are now ENFORCED at the tool-execution layer
      // in src/tools/agent-browser/index.ts via browserGateGuard(context.agent)
    },
    explore: { write: false, edit: false, webfetch: false },
    manager: {
      write: false,
      edit: false,
      bash: false,
      apply_patch: false,
      grep: false,
      glob: false,
      // LSP tools — manager delegates diagnostics/symbols to subagents
      lsp_diagnostics: false,
      lsp_goto_definition: false,
      lsp_find_references: false,
      lsp_symbols: false,
      lsp_prepare_rename: false,
      lsp_rename: false,
    },
    general: { task: false, webfetch: false },
  },
  hooks: { disabled: [] },
  tools: { disabled: [] },
  agent_overrides: {},
  auth: {},
  background_manager: {
    concurrency_limit: 5,
    stale_timeout_ms: 45 * 60 * 1000,
    circuit_breaker: {
      enabled: true,
      max_tool_calls: 4000,
      consecutive_threshold: 20,
    },
  },
  telemetry: { enabled: false, serviceName: "hiai-opencode" },
  disabled_agents: [],
  disabled_hooks: [],
  caveman: {
    enabled: true,
    level: "full",
    bob_internal: true,
    bob_to_agents: true,
    agents_to_bob: true,
    final_user_output: "normal",
    target_agents: [
      "bob",
      "explore",
      "build",
      "critic",
      "general",
      "designer",
      "manager",
    ],
    exclude_agents: ["vision", "writer"],
    min_messages_to_compress: 5,
  },
  completion: {
    enabled: true,
    max_auto_continues: 25,
    require_critic: true,
    ui_globs: [
      "**/*.svelte",
      "**/*.tsx",
      "**/*.jsx",
      "**/*.vue",
      "**/*.css",
      "**/*.scss",
      "**/*.html",
      "**/*.astro",
    ],
    reset_on_user_message: true,
  },
  dream: { auto: true, interval_days: 7 },
  distill: { auto: true, interval_days: 30 },
  worktreeConfig: { enabled: true, base_dir: ".hiai-bob/worktrees" },
};

function stripJsonComments(json: string): string {
  return json.replace(
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\/\/.*$|\/\*[\s\S]*?\*\//gm,
    (_match, string) => {
      if (string) return string;
      return "";
    },
  );
}

const REQUIRED_AGENT_KEYS = [
  "bob",
  "build",
  "plan",
  "manager",
  "critic",
  "designer",
  "explore",
  "writer",
  "vision",
  "general",
] as const;

function validateModels(models: BobConfig["models"]): void {
  const m = models ?? {};
  for (const key of REQUIRED_AGENT_KEYS) {
    const model = m[key]?.model;
    if (typeof model !== "string" || model.trim() === "") {
      logger.warn(
        `[hiai-opencode] agent "${key}" has no model — set models.${key}.model in bob.json`,
      );
      continue;
    }
    const slash = model.trim().indexOf("/");
    if (slash <= 0 || slash === model.trim().length - 1) {
      logger.warn(
        `[hiai-opencode] agent "${key}" model "${model}" is not "<provider>/<model>"`,
      );
    }
  }
  for (const key of Object.keys(m)) {
    if (
      !REQUIRED_AGENT_KEYS.includes(key as (typeof REQUIRED_AGENT_KEYS)[number])
    ) {
      logger.warn(
        `[hiai-opencode] models.${key} is not a known agent — ignored`,
      );
    }
  }
}

function globalConfigDir(): string {
  const home = process.env.HIAI_BOB_HOME;
  if (home && isAbsolute(home)) return join(home, "config");
  const xdg = process.env.XDG_CONFIG_HOME;
  const base =
    xdg && isAbsolute(xdg)
      ? xdg
      : join(process.env.HOME ?? process.env.USERPROFILE ?? "", ".config");
  return join(base, "hiai-opencode");
}

/**
 * Module-level singleton holding the most recently loaded config.
 * Populated by `loadConfig` (the canonical entry point used by the plugin).
 * `getToolSetting` reads tool defaults from here so any module can look up a
 * tunable constant without threading the full `BobConfig` through every call.
 */
let loadedConfig: BobConfig | null = null;

/** Store the active config as the process-wide singleton. */
export function setConfig(config: BobConfig): void {
  loadedConfig = config;
}

/** Read the active config singleton (null before `loadConfig` runs). */
export function getConfig(): BobConfig | null {
  return loadedConfig;
}

/**
 * Read a tunable tool constant from `config.tool_settings`, falling back to
 * `defaultValue` when the key is absent or config has not been loaded yet.
 *
 * This is the single source of truth for runtime-tunable numeric constants
 * that were previously hardcoded across the codebase (buffer sizes, timeouts,
 * agent temperatures, thinking budgets, etc.).
 */
export function getToolSetting(key: string, defaultValue: number): number {
  return loadedConfig?.tool_settings?.[key] ?? defaultValue;
}

export function loadConfig(projectDir: string): BobConfig {
  // Load env files from multiple paths before resolving config
  loadEnvFiles(projectDir);

  const cfgDir = globalConfigDir();
  // NOTE: the plugin's own bob.json is NOT a candidate here. Its values are
  // already the DEFAULT_CONFIG baseline (hardcoded in mergeConfig). User
  // configs below OVERRIDE that baseline. Loading the plugin's bob.json
  // as a candidate would shadow the user's .opencode/bob.json because the
  // old code did `break` on the first match.
  const candidates = [
    join(projectDir, "bob.json"),
    join(projectDir, ".opencode", "bob.json"),
    join(projectDir, "bob.jsonc"),
    join(projectDir, ".opencode", "bob.jsonc"),
    join(cfgDir, "bob.json"),
    join(cfgDir, "bob.jsonc"),
  ];

  // Collect ALL user configs; later entries (more specific / global-last)
  // override earlier ones, and the whole merged result overrides DEFAULT_CONFIG.
  let userConfig: Partial<BobConfig> = {};
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue;
    try {
      const raw = readFileSync(candidate, "utf-8");
      const cleaned = stripJsonComments(raw);
      const parsed = JSON.parse(cleaned) ?? {};
      userConfig = { ...userConfig, ...parsed };
    } catch (err) {
      logger.warn(
        `[hiai-opencode] Failed to parse config: ${candidate} (${err instanceof Error ? err.message : String(err)})`,
      );
    }
  }

  const merged = mergeConfig(userConfig);
  setConfig(merged);
  return merged;
}

export function mergeConfig(userConfig: Partial<BobConfig>): BobConfig {
  const mergedModels = { ...DEFAULT_CONFIG.models, ...userConfig.models };
  validateModels(mergedModels);
  const mergedMcp = { ...DEFAULT_CONFIG.mcp, ...userConfig.mcp };
  const mergedLsp = { ...DEFAULT_CONFIG.lsp, ...userConfig.lsp };
  const mergedAgentRestrictions = {
    ...DEFAULT_CONFIG.agent_restrictions,
    ...userConfig.agent_restrictions,
  };
  const mergedAuth = { ...DEFAULT_CONFIG.auth, ...userConfig.auth };

  const bobModel = mergedModels.bob?.model;
  const pin = bobModel ? { model: bobModel } : {};
  const mergedDream = { ...DEFAULT_CONFIG.dream, ...userConfig.dream, ...pin };
  const mergedDistill = {
    ...DEFAULT_CONFIG.distill,
    ...userConfig.distill,
    ...pin,
  };

  const defaultHooksDisabled = DEFAULT_CONFIG.hooks?.disabled ?? [];
  const userHooksDisabled = userConfig.hooks?.disabled ?? [];
  const legacyDisabledHooks = [
    ...(DEFAULT_CONFIG.disabled_hooks ?? []),
    ...(userConfig.disabled_hooks ?? []),
  ];
  const allHooksDisabled = [
    ...new Set([
      ...defaultHooksDisabled,
      ...userHooksDisabled,
      ...legacyDisabledHooks,
    ]),
  ];

  const defaultToolsDisabled = DEFAULT_CONFIG.tools?.disabled ?? [];
  const userToolsDisabled = userConfig.tools?.disabled ?? [];

  const defaultAgentsDisabled = DEFAULT_CONFIG.disabled_agents ?? [];
  const userAgentsDisabled = userConfig.disabled_agents ?? [];
  const allAgentsDisabled = [
    ...new Set([...defaultAgentsDisabled, ...userAgentsDisabled]),
  ];

  return resolveEnvVars({
    ...DEFAULT_CONFIG,
    ...userConfig,
    models: mergedModels,
    mcp: mergedMcp,
    lsp: mergedLsp,
    agent_restrictions: mergedAgentRestrictions,
    auth: mergedAuth,
    background_manager: {
      ...DEFAULT_CONFIG.background_manager,
      ...userConfig.background_manager,
    },
    telemetry: {
      ...DEFAULT_CONFIG.telemetry,
      ...userConfig.telemetry,
    } as BobConfig["telemetry"],
    hooks: { disabled: allHooksDisabled },
    tools: {
      disabled: [...new Set([...defaultToolsDisabled, ...userToolsDisabled])],
    },
    agent_overrides: {
      ...DEFAULT_CONFIG.agent_overrides,
      ...userConfig.agent_overrides,
    },
    completion: {
      enabled: true,
      max_auto_continues: 25,
      require_critic: true,
      ui_globs: DEFAULT_CONFIG.completion?.ui_globs ?? [
        "**/*.svelte",
        "**/*.tsx",
        "**/*.jsx",
        "**/*.vue",
        "**/*.css",
        "**/*.scss",
        "**/*.html",
        "**/*.astro",
      ],
      reset_on_user_message: true,
      ...userConfig.completion,
    },
    disabled_agents: allAgentsDisabled,
    disabled_hooks: allHooksDisabled,
    dream: mergedDream,
    distill: mergedDistill,
    loop: { ...DEFAULT_CONFIG.loop, ...userConfig.loop },
  });
}
