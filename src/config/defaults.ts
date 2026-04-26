/**
 * Runtime defaults for hiai-opencode.
 *
 * The user-facing config owns model choice through 10 primary agent slots.
 * Internal routing derives hidden agents and task categories from those slots.
 */
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, normalize } from "node:path"
import { createDefaultMcpConfig } from "../mcp/registry.js"
import type { HiaiOpencodeConfig, LspServerConfig } from "./types.js"

const REQUIRED_MODEL_SLOTS = [
  "bob",
  "coder",
  "strategist",
  "guard",
  "critic",
  "designer",
  "researcher",
  "manager",
  "brainstormer",
  "vision",
  "sub",
] as const

type ModelSlot = (typeof REQUIRED_MODEL_SLOTS)[number]

const DEFAULT_LSP: Record<string, LspServerConfig> = {
  typescript: {
    enabled: true,
    command: ["typescript-language-server", "--stdio"],
    extensions: [".ts", ".tsx", ".mts", ".cts"],
  },
  svelte: {
    enabled: true,
    command: ["svelteserver", "--stdio"],
    extensions: [".svelte"],
  },
  eslint: {
    enabled: true,
    command: ["node", "{pluginRoot}/assets/runtime/npm-package-runner.mjs", "eslint-lsp", "--stdio"],
    extensions: [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".svelte"],
  },
  bash: {
    enabled: true,
    command: ["node", "{pluginRoot}/assets/runtime/npm-package-runner.mjs", "bash-language-server", "start"],
    extensions: [".sh", ".bash"],
  },
  pyright: {
    enabled: true,
    command: ["pyright-langserver", "--stdio"],
    extensions: [".py"],
  },
}

function findPluginRoot(): string {
  const candidates = [
    join(import.meta.dirname, "..", ".."),
    join(import.meta.dirname, ".."),
    join(import.meta.dirname, "..", ".."),
    dirname(process.argv[1] ?? ""),
    process.cwd(),
  ]

  for (const candidate of candidates) {
    const root = normalize(candidate)
    if (existsSync(join(root, "hiai-opencode.json"))) return root
  }

  throw new Error("[hiai-opencode] Cannot find bundled hiai-opencode.json. The package is incomplete.")
}

function expandPluginRootPlaceholders(value: unknown, pluginRoot: string): unknown {
  if (typeof value === "string") return value.replaceAll("{pluginRoot}", pluginRoot)
  if (Array.isArray(value)) return value.map((item) => expandPluginRootPlaceholders(item, pluginRoot))
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, expandPluginRootPlaceholders(entry, pluginRoot)]),
    )
  }
  return value
}

function requireModelSlots(config: HiaiOpencodeConfig): Record<ModelSlot, string> {
  const models = config.models ?? {}
  const resolved = Object.fromEntries(
    REQUIRED_MODEL_SLOTS.map((slot) => {
      const value = models[slot]
      const model = typeof value === "string" ? value : value?.model
      return [slot, model?.trim() ?? ""]
    }),
  ) as Record<ModelSlot, string>

  const missing = REQUIRED_MODEL_SLOTS.filter((slot) => !resolved[slot])
  if (missing.length > 0) {
    throw new Error(`[hiai-opencode] Missing required model slot(s) in hiai-opencode.json: ${missing.join(", ")}`)
  }
  return resolved
}

function deriveAgents(models: Record<ModelSlot, string>): HiaiOpencodeConfig["agents"] {
  return {
    bob: { model: models.bob },
    coder: { model: models.coder },
    strategist: { model: models.strategist },
    guard: { model: models.guard },
    critic: { model: models.critic },
    designer: { model: models.designer },
    researcher: { model: models.researcher },
    "platform-manager": { model: models.manager },
    brainstormer: { model: models.brainstormer },
    multimodal: { model: models.vision },
    sub: { model: models.sub },
    "quality-guardian": { model: models.critic },
    "agent-skills": { model: models.manager },
  }
}

function deriveCategories(models: Record<ModelSlot, string>): Record<string, import("./types").CategoryConfig> {
  const categories: Record<string, import("./types").CategoryConfig> = {}
  const entries: [string, Record<string, unknown>][] = [
    ["visual-engineering", { variant: "high" }],
    ["artistry", { variant: "high" }],
    ["ultrabrain", { variant: "xhigh" }],
    ["deep", { variant: "medium" }],
    ["quick", {}],
    ["writing", {}],
    ["git", {}],
    ["unspecified-low", {}],
    ["unspecified-high", { variant: "max" }],
  ]
  for (const [name, cfg] of entries) {
    categories[name] = cfg as import("./types").CategoryConfig
  }
  return categories
}

function deriveMcp(config: HiaiOpencodeConfig): HiaiOpencodeConfig["mcp"] {
  const defaults = createDefaultMcpConfig()
  const userMcp = config.mcp ?? {}
  return Object.fromEntries(
    Object.entries(defaults).map(([name, entry]) => {
      const override = userMcp[name] ?? {}
      const merged = { ...entry, ...override }

      if (name === "mempalace" && typeof merged.pythonPath === "string" && merged.pythonPath.trim()) {
        merged.environment = {
          ...(entry.environment ?? {}),
          ...(merged.environment ?? {}),
          MEMPALACE_PYTHON: merged.pythonPath.trim(),
        }
      }

      if (name === "websearch") {
        const provider = merged.provider === "tavily" ? "tavily" : "exa"
        merged.provider = provider
        merged.type = "remote"
        if (provider === "tavily") {
          merged.url = "https://mcp.tavily.com/mcp/"
          merged.headers = { Authorization: "Bearer {env:TAVILY_API_KEY}" }
        } else {
          merged.url = "https://mcp.exa.ai/mcp?tools=web_search_exa"
          merged.headers = { "x-api-key": "{env:EXA_API_KEY}" }
        }
      }

      // Internal launcher hint; do not leak unknown keys into final OpenCode MCP server config.
      delete merged.pythonPath

      return [name, merged]
    }),
  )
}

function deriveLsp(config: HiaiOpencodeConfig): HiaiOpencodeConfig["lsp"] {
  const userLsp = config.lsp ?? {}
  return Object.fromEntries(
    Object.entries(DEFAULT_LSP).map(([name, entry]) => {
      const override = userLsp[name] ?? {}
      return [name, { ...entry, ...override }]
    }),
  )
}

function materializeConfig(rawConfig: HiaiOpencodeConfig): HiaiOpencodeConfig {
  const models = requireModelSlots(rawConfig)
  return {
    ...rawConfig,
    agents: deriveAgents(models),
    agentRequirements: {},
    categories: deriveCategories(models),
    categoryRequirements: {},
    modelFamilies: [],
    mcp: deriveMcp(rawConfig),
    lsp: deriveLsp(rawConfig),
    subtask2: {
      replace_generic: true,
      generic_return: null,
      ...(rawConfig.subtask2 ?? {}),
    },
    skills: {
      enabled: true,
      disabled: [],
      ...(rawConfig.skills ?? {}),
    },
    permissions: {
      read: { "*": "allow", "*.env": "deny", "*.env.*": "deny", "*.env.example": "allow" },
      edit: { "*": "allow" },
      bash: { "*": "allow" },
      deny_paths: ["**/backup/**", "**/secrets.*", "**/.env", "**/.env.*"],
      ...(rawConfig.permissions ?? {}),
    },
  }
}

function loadBundledDefaultConfig(): HiaiOpencodeConfig {
  const pluginRoot = findPluginRoot()
  const configPath = join(pluginRoot, "hiai-opencode.json")
  const raw = readFileSync(configPath, "utf-8")
  const parsed = JSON.parse(raw) as HiaiOpencodeConfig
  const materialized = materializeConfig(parsed)

  return expandPluginRootPlaceholders(materialized, pluginRoot) as HiaiOpencodeConfig
}

export function applyModelSlots(config: HiaiOpencodeConfig): HiaiOpencodeConfig {
  return materializeConfig(config)
}

export const defaultConfig: HiaiOpencodeConfig = loadBundledDefaultConfig()
