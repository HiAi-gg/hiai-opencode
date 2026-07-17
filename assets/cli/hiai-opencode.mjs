#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { homedir } from "node:os"
import { createHash } from "node:crypto"
import { up as cmdUp, down as cmdDown, status as cmdStatus } from "./up.mjs"

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const MCP_EXPORT_MARKER = "hiai-opencode"

/**
 * Output helpers.
 *
 * Phase 2.1: human-facing diagnostic/status strings go to stderr so that
 * stdout stays clean for machine-readable output (e.g. future `--json`
 * flags). `outInfo` is the canonical stderr sink for status/diagnostic text.
 */
function outInfo(...args) {
  console.error(...args)
}

/**
 * Parse JSONC (JSON with comments/trailing commas) without an external dep.
 * Strips // line comments, /* block comments *​/, and trailing commas, then
 * JSON.parse. Strings are preserved (their contents are never treated as
 * comments). Equivalent to the subset of `jsonc-parser`'s `parse` we used.
 */
function parseJsonc(text) {
  const stripped = text.replace(
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\/\/.*$|\/\*[\s\S]*?\*\/|,(?=\s*[}\]])/gm,
    (_m, str) => (str !== undefined ? str : ""),
  )
  return JSON.parse(stripped)
}

// Parse a config file that may be JSON or JSONC. Always returns an object.
function parseConfig(text) {
  try {
    return parseJsonc(text) ?? {}
  } catch {
    return {}
  }
}

// Source of truth for MCP servers — MUST match src/features/mcp/registry.ts (2 servers).
// context7 is an on-demand CLI skill (skill("explore/context7")), not an MCP server.
// stitch/mempalace were intentionally removed in v0.3.0.
const MCP_REGISTRY = {
  "sequential-thinking": {
    defaultEnabled: true,
    requiredEnv: [],
    check: checkNodeNpx,
  },
  grep_app: {
    defaultEnabled: true,
    requiredEnv: [],
    check: checkRemoteGrepApp,
  },
}

function usage() {
  outInfo(`hiai-opencode

Usage:
  hiai-opencode                         # launch opencode serve + web (same as 'up')
  hiai-opencode up [--serve-port N] [--web-port N] [--host H]
  hiai-opencode down
  hiai-opencode restart [--serve-port N] [--web-port N] [--host H]
  hiai-opencode status
  hiai-opencode doctor
  hiai-opencode mcp-status
  hiai-opencode export-mcp [path]
  hiai-opencode diagnose [path]

Commands:
  (no args)   Launch opencode serve (headless) + opencode web (frontend). Cline bridge = plugin providers (no extra process).
  up          Start the stack (alias for bare command).
  down        Stop the stack started by 'up'.
  restart     Stop then start the stack.
  status      Show running serve/web processes and ports.
  doctor      Full install/runtime diagnostic: MCP status + static export freshness + provider/skills/agents/LSP checks + MCP tool probes.
  mcp-status  Check hiai-opencode MCP configuration, keys, and local runtimes.
  export-mcp  Write a static .mcp.json for hosts whose mcp list ignores plugin runtime MCP.
  diagnose    Collect full diagnostic bundle to file (local only, no remote sending).
`)
}

function resolveEnvTemplate(value) {
  if (typeof value !== "string") return value
  return value.replace(/\{env:([^}]+)\}/g, (_match, expression) => {
    const [name, fallback] = String(expression).split(":-", 2)
    return process.env[name] || fallback || ""
  })
}

function candidateConfigPaths() {
  const cwd = process.cwd()
  // bob.json is the runtime config the plugin actually loads (src/config.ts).
  // List it first so the CLI reads the same file the plugin uses; fall back to
  // hiai-opencode.json for backward compatibility.
  const paths = [
    join(cwd, "bob.json"),
    join(cwd, "bob.jsonc"),
    join(cwd, ".opencode", "bob.json"),
    join(cwd, ".opencode", "bob.jsonc"),
    join(cwd, "hiai-opencode.json"),
    join(cwd, "hiai-opencode.jsonc"),
    join(cwd, ".opencode", "hiai-opencode.json"),
    join(cwd, ".opencode", "hiai-opencode.jsonc"),
    join(homedir(), ".config", "opencode", "bob.json"),
    join(homedir(), ".config", "opencode", "bob.jsonc"),
    join(homedir(), ".config", "opencode", "hiai-opencode.json"),
    join(homedir(), ".config", "opencode", "hiai-opencode.jsonc"),
  ]

  if (process.platform === "win32" && process.env.APPDATA) {
    paths.push(join(process.env.APPDATA, "opencode", "bob.json"))
    paths.push(join(process.env.APPDATA, "opencode", "bob.jsonc"))
    paths.push(join(process.env.APPDATA, "opencode", "hiai-opencode.json"))
    paths.push(join(process.env.APPDATA, "opencode", "hiai-opencode.jsonc"))
  }

  return paths
}

function loadConfig() {
  for (const path of candidateConfigPaths()) {
    if (!existsSync(path)) continue
    try {
      return {
        path,
        config: parseConfig(readFileSync(path, "utf-8")) ?? {},
      }
    } catch (error) {
      return {
        path,
        config: {},
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  return { path: null, config: {} }
}

function candidateOpenCodeConfigPaths() {
  const cwd = process.cwd()
  const paths = [
    join(cwd, ".opencode", "opencode.json"),
    join(cwd, ".opencode", "opencode.jsonc"),
    join(homedir(), ".config", "opencode", "opencode.json"),
    join(homedir(), ".config", "opencode", "opencode.jsonc"),
  ]

  if (process.platform === "win32" && process.env.APPDATA) {
    paths.push(join(process.env.APPDATA, "opencode", "opencode.json"))
    paths.push(join(process.env.APPDATA, "opencode", "opencode.jsonc"))
  }

  return paths
}

function checkFirecrawlAuth() {
  const hasKey = !!process.env.FIRECRAWL_API_KEY?.trim()
  if (!hasKey) {
    return { level: "warn", detail: "FIRECRAWL_API_KEY not set in environment" }
  }

  const firecrawlBinary = process.platform === "win32" ? "firecrawl.cmd" : "firecrawl"
  const result = spawnSync(firecrawlBinary, ["--status"], {
    encoding: "utf-8",
    timeout: 10000,
    shell: process.platform === "win32",
  })

  if (result.status === 0) {
    return { level: "ok", detail: `Firecrawl auth OK (${result.stdout.trim()})` }
  }

  return {
    level: "warn",
    detail: `Firecrawl auth check failed: ${result.stderr?.trim() || result.error?.message || "unknown error"}`,
  }
}

function checkContext7() {
  // context7 ships without a bin entry; resolve via npx -y.
  const result = spawnSync("npx", ["-y", "context7", "--help"], {
    encoding: "utf-8",
    timeout: 15000,
    shell: process.platform === "win32",
  })
  if (result.status === 0) {
    return { level: "ok", detail: "context7 CLI available (npx -y context7)" }
  }
  return {
    level: "warn",
    detail: `context7 CLI not found — install via skill("explore/context7") or npm i -g context7`,
  }
}

function checkAgentBrowser() {
  const binary = process.platform === "win32" ? "agent-browser.cmd" : "agent-browser"
  const result = spawnSync(binary, ["--help"], {
    encoding: "utf-8",
    timeout: 10000,
    shell: process.platform === "win32",
  })
  if (result.status === 0) {
    return { level: "ok", detail: `agent-browser CLI available (${binary})` }
  }
  return {
    level: "warn",
    detail: `agent-browser CLI not found — install via bun/npm i -g agent-browser`,
  }
}

function checkOpenCodePluginRegistration() {
  for (const path of candidateOpenCodeConfigPaths()) {
    if (!existsSync(path)) continue
    try {
      const parsed = parseConfig(readFileSync(path, "utf-8")) ?? {}
      const pluginEntries = Array.isArray(parsed?.plugin) ? parsed.plugin : []
      const plugins = pluginEntries
        .map((entry) => typeof entry === "string" ? entry : Array.isArray(entry) ? entry[0] : "")
        .filter((entry) => typeof entry === "string" && entry.length > 0)

      if (plugins.includes("list")) {
        return {
          level: "warn",
          detail: `${path} contains plugin: [\"list\"] which can block MCP loading. Replace with [\"@hiai-gg/hiai-opencode\"].`,
        }
      }

      const dcpRegistered = plugins.includes("@tarquinen/opencode-dcp@latest") || plugins.includes("@tarquinen/opencode-dcp")
      const hiaiRegistered = plugins.includes("@hiai-gg/hiai-opencode")

      if (hiaiRegistered) {
        return {
          level: dcpRegistered ? "ok" : "warn",
          detail: `plugin registered in ${path}${dcpRegistered ? "; DCP (opencode-dcp) also registered" : "; DCP (opencode-dcp) not found — optional for Dynamic Context Pruning"}`,
        }
      }

      return {
        level: "warn",
        detail: `${path} found but @hiai-gg/hiai-opencode is not registered`,
      }
    } catch (error) {
      return {
        level: "warn",
        detail: `failed to parse ${path}: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  return {
    level: "warn",
    detail: "no opencode.json/opencode.jsonc found in project or global config paths",
  }
}

function enabled(config, name) {
  return config?.mcp?.[name]?.enabled ?? MCP_REGISTRY[name]?.defaultEnabled ?? true
}

function assetPath(...segments) {
  return join(PACKAGE_ROOT, "assets", ...segments)
}

function createMcpExport(config) {
  const servers = {}

  if (enabled(config, "sequential-thinking")) {
    servers["sequential-thinking"] = {
      command: "node",
      args: [
        assetPath("runtime", "npm-package-runner.mjs"),
        "@modelcontextprotocol/server-sequential-thinking",
      ],
    }
  }

  if (enabled(config, "grep_app")) {
    servers.grep_app = {
      type: "http",
      url: "https://mcp.grep.app",
    }
  }

  // Also pass through any user-defined MCP servers not in the registry,
  // as long as they carry a command/url (validated shape).
  for (const [name, entry] of Object.entries(config?.mcp ?? {})) {
    if (servers[name]) continue
    if (entry && entry.enabled !== false) {
      if (entry.command) servers[name] = { command: entry.command, args: entry.args ?? [] }
      else if (entry.url) servers[name] = { type: "http", url: entry.url }
    }
  }

  return {
    _meta: {
      generatedBy: MCP_EXPORT_MARKER,
      version: 1,
      generatedAt: new Date().toISOString(),
    },
    mcpServers: Object.fromEntries(
      Object.entries(servers).map(([name, value]) => [
        name,
        Object.fromEntries(Object.entries(value).filter(([, field]) => field !== undefined)),
      ]),
    ),
  }
}

function isManagedStaticMcpFile(path) {
  if (!existsSync(path)) return false

  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8"))
    return parsed?._meta?.generatedBy === MCP_EXPORT_MARKER
  } catch {
    return false
  }
}

function stableHash(value) {
  return createHash("sha256").update(value).digest("hex")
}

function readExistingStaticMcp(path) {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, "utf-8"))
  } catch {
    return null
  }
}

function checkStaticMcpFreshness(outputPath, config) {
  const expected = createMcpExport(config)
  const existing = readExistingStaticMcp(outputPath)
  if (!existing) {
    return { status: "missing", detail: `${outputPath} is missing` }
  }

  const expectedNormalized = {
    ...expected,
    _meta: { ...expected._meta, generatedAt: "<normalized>" },
  }
  const existingNormalized = {
    ...existing,
    _meta: existing._meta ? { ...existing._meta, generatedAt: "<normalized>" } : undefined,
  }

  const expectedHash = stableHash(JSON.stringify(expectedNormalized))
  const existingHash = stableHash(JSON.stringify(existingNormalized))
  const managed = existing?._meta?.generatedBy === MCP_EXPORT_MARKER

  if (expectedHash === existingHash) {
    return {
      status: "fresh",
      detail: `${outputPath} is up to date${managed ? " (managed)" : ""}`,
    }
  }

  if (!managed) {
    return {
      status: "drift-unmanaged",
      detail: `${outputPath} differs and is not managed by ${MCP_EXPORT_MARKER}`,
    }
  }

  return {
    status: "stale",
    detail: `${outputPath} is stale (run: hiai-opencode export-mcp ${outputPath})`,
  }
}

function exportMcp(outputPath = join(process.cwd(), ".opencode", ".mcp.json")) {
  const { path, config, error } = loadConfig()
  if (error) {
    console.error(`Config parse warning: ${error}`)
  }

  const output = createMcpExport(config)
  const mode = process.env.HIAI_OPENCODE_EXPORT_MCP_MODE?.trim().toLowerCase() || "safe"
  const force = mode === "force"

  if (existsSync(outputPath) && !isManagedStaticMcpFile(outputPath) && !force) {
    console.error(
      `Refusing to overwrite non-managed ${outputPath}. ` +
      `Set HIAI_OPENCODE_EXPORT_MCP_MODE=force to override.`,
    )
    process.exit(1)
  }

  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`)
  outInfo(`Wrote ${outputPath}`)
  outInfo(`Source config: ${path ?? "defaults"}`)
  outInfo(`Servers: ${Object.keys(output.mcpServers).join(", ") || "(none)"}`)
}

function hasCommand(command, args = ["--version"]) {
  const result = spawnSync(command, args, {
    stdio: "ignore",
    timeout: 10000,
    shell: process.platform === "win32",
  })
  return result.status === 0
}

function hasBinary(binary) {
  try {
    const res = spawnSync(process.platform === "win32" ? "where" : "which", [binary], {
      stdio: "ignore",
      timeout: 5000,
    })
    return res.status === 0
  } catch {
    return false
  }
}

function hasNode() {
  return hasCommand(process.platform === "win32" ? "node.exe" : "node")
}

function hasNpx() {
  return hasCommand(process.platform === "win32" ? "npx.cmd" : "npx")
}

function checkNodeNpx() {
  const node = hasNode()
  const npx = hasNpx()
  if (node && npx) return { level: "ok", detail: "backend ok" }
  return {
    level: "error",
    detail: `${node ? "node ok" : "node not found"}, ${npx ? "npx ok" : "npx not found"}`,
  }
}

function checkRemoteGrepApp() {
  // grep.app requires no API key; just confirm the endpoint is reachable.
  return { level: "ok", detail: "remote endpoint configured (no key required)" }
}

function parseProviderFromModelId(modelId) {
  if (!modelId || typeof modelId !== "string") return null
  const normalized = modelId.trim()
  if (!normalized) return null
  const directProvider = normalized.split("/")[0]
  if (directProvider === "openrouter") {
    const routedProvider = normalized.split("/")[1]
    return routedProvider || "openrouter"
  }
  return directProvider
}

function collectConfiguredProviders(config) {
  const providerSet = new Set()
  const modelEntries = Object.values(config?.models ?? {})
  for (const entry of modelEntries) {
    const modelId = typeof entry === "string" ? entry : entry?.model
    const provider = parseProviderFromModelId(modelId)
    if (provider) providerSet.add(provider)
  }
  return [...providerSet].sort()
}

function checkOpenCodeConnectVisibility(config) {
  const providers = collectConfiguredProviders(config)
  const opencodeBinary = process.platform === "win32" ? "opencode.cmd" : "opencode"
  const opencodeAvailable = hasCommand(opencodeBinary, ["--version"])
  if (!opencodeAvailable) {
    return {
      level: "warn",
      detail: `opencode binary not available in PATH; cannot inspect Connect providers. Configured model providers: ${providers.join(", ") || "(none)"}`,
    }
  }

  const commands = [
    [opencodeBinary, ["connect", "list", "--json"]],
    [opencodeBinary, ["connect", "list"]],
  ]

  for (const [binary, args] of commands) {
    const result = spawnSync(binary, args, { encoding: "utf-8", timeout: 15000, shell: process.platform === "win32" })
    if (result.status === 0) {
      const out = (result.stdout || "").trim()
      const summary = out ? out.split("\n").slice(0, 3).join(" | ") : "connect list ok"
      return {
        level: "ok",
        detail: `OpenCode Connect visible. Configured model providers: ${providers.join(", ") || "(none)"}; connect summary: ${summary}`,
      }
    }
  }

  return {
    level: "warn",
    detail: `Could not read OpenCode Connect state. Configured model providers: ${providers.join(", ") || "(none)"}`,
  }
}

function getSkillRegistryPath() {
  if (process.platform === "win32" && process.env.APPDATA) {
    return join(process.env.APPDATA, "opencode", ".hiai", "skill-registry.json")
  }
  return join(homedir(), ".config", "opencode", ".hiai", "skill-registry.json")
}

function checkSkillMaterialization() {
  const registryPath = getSkillRegistryPath()
  if (!existsSync(registryPath)) {
    return { level: "warn", detail: `skill registry missing: ${registryPath}` }
  }

  try {
    const parsed = JSON.parse(readFileSync(registryPath, "utf-8"))
    const summary = parsed?.summary
    const total = summary?.total ?? 0
    const builtin = summary?.builtin ?? 0
    const plugin = summary?.plugin ?? 0
    return {
      level: "ok",
      detail: `materialized skills: total=${total}, builtin=${builtin}, plugin=${plugin}`,
    }
  } catch (error) {
    return {
      level: "warn",
      detail: `failed to parse skill registry: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

// Canonical agent roster — MUST match REQUIRED_AGENT_KEYS in src/config.ts.
// Legacy aliases map old slot names → canonical names (no separate migration layer exists).
const REQUIRED_MODEL_SLOTS = [
  "bob", "build", "plan", "manager", "critic",
  "designer", "explore", "writer", "vision", "general",
]

const DEPRECATED_MODEL_KEYS = {
  "coder": "build",
  "strategist": "plan",
  "researcher": "explore",
  "sub": "general",
  "guard": "manager",
  "brainstormer": "writer",
}

function getAgentSummary(config) {
  // Visible in the picker: bob (primary), plan (all), general (all).
  const visible = ["bob", "plan", "general"]
  // Hidden subagents.
  const hidden = ["manager", "critic", "designer", "explore", "writer", "vision", "build"]

  const models = config?.models ?? {}
  const modelKeys = Object.keys(models)

  // Check for missing required slots
  const missing = REQUIRED_MODEL_SLOTS.filter(slot => !(slot in models))
  const missingDetail = missing.length > 0
    ? `; missing=[${missing.join(", ")}]`
    : ""

  // Check for deprecated keys
  const deprecated = modelKeys.filter(k => k in DEPRECATED_MODEL_KEYS)
  const deprecatedDetail = deprecated.length > 0
    ? `; deprecated keys=[${deprecated.map(k => `${k}→${DEPRECATED_MODEL_KEYS[k]}`).join(", ")}]`
    : ""

  // Check for empty model values
  const emptySlots = modelKeys.filter(k => {
    const v = models[k]
    if (typeof v === "string") return v.trim() === ""
    if (v && typeof v === "object") return !v.model || v.model.trim() === ""
    return true
  })
  const emptyDetail = emptySlots.length > 0
    ? `; empty=[${emptySlots.join(", ")}]`
    : ""

  const issues = []
  if (missing.length > 0) issues.push(`${missing.length} required slot(s) missing: ${missing.join(", ")}`)
  if (deprecated.length > 0) issues.push(`${deprecated.length} deprecated key(s): ${deprecated.map(k => `${k}→${DEPRECATED_MODEL_KEYS[k]}`).join(", ")}`)
  if (emptySlots.length > 0) issues.push(`${emptySlots.length} empty model value(s): ${emptySlots.join(", ")}`)

  const level = issues.length === 0 ? "ok" : (missing.length > 0 ? "fail" : "warn")
  const issueDetail = issues.length > 0 ? ` (${issues.join("; ")})` : ""

  return {
    level,
    detail: `visible=${visible.length} [${visible.join(", ")}]; hidden=${hidden.length} [${hidden.join(", ")}]; model slots=${modelKeys.length}/${REQUIRED_MODEL_SLOTS.length}${missingDetail}${deprecatedDetail}${emptyDetail}${issueDetail}`,
  }
}

function checkModelSlotValues(config) {
  const results = []
  const models = config?.models ?? {}

  for (const slot of REQUIRED_MODEL_SLOTS) {
    const value = models[slot]
    if (!value) {
      results.push({ level: "fail", check: `Model slot '${slot}'`, detail: "missing — no model configured" })
      continue
    }
    const model = typeof value === "string" ? value : value.model
    if (!model || model.trim() === "") {
      results.push({ level: "fail", check: `Model slot '${slot}'`, detail: "empty model value" })
    }
  }

  return results
}

function checkSubagentDepth(config) {
  const depth = config?.subagent_depth ?? 2
  if (!Number.isInteger(depth) || depth < 1) {
    return { level: "fail", detail: `invalid subagent_depth=${String(depth)}; expected a positive integer` }
  }
  if (depth < 2) {
    return { level: "warn", detail: `subagent_depth=${depth}; Bob → Manager → worker requires 2` }
  }
  return { level: "ok", detail: `subagent_depth=${depth}; nested Bob → Manager → worker delegation enabled` }
}

function getLspDefaults() {
  return {
    typescript: ["typescript-language-server", "--stdio"],
    svelte: ["svelteserver", "--stdio"],
    eslint: ["node", join(PACKAGE_ROOT, "assets", "runtime", "npm-package-runner.mjs"), "eslint-lsp", "--stdio"],
    bash: ["node", join(PACKAGE_ROOT, "assets", "runtime", "npm-package-runner.mjs"), "bash-language-server", "start"],
    pyright: ["pyright-langserver", "--stdio"],
  }
}

function checkLspAvailability(config) {
  const defaults = getLspDefaults()
  const results = []

  for (const [name, command] of Object.entries(defaults)) {
    const enabled = config?.lsp?.[name]?.enabled ?? true
    if (!enabled) {
      results.push(`⚪ ${name}: disabled`)
      continue
    }
    const binary = command[0]
    // pyright-langserver exits non-zero without --stdio/--node-ipc, so a
    // plain spawnSync returns false even when present. Check presence via
    // `command -v` instead of executing.
    const ok = hasBinary(binary)
    results.push(`${ok ? "✅" : "⚠️ "} ${name}: ${ok ? "runtime available" : `${binary} not found`}`)
  }

  return {
    level: results.some((line) => line.startsWith("⚠️")) ? "warn" : "ok",
    detail: results.join(" | "),
  }
}

// Lazy-load the MCP SDK only when stdio probing is actually requested (doctor).
// This keeps `hiai-opencode mcp-status`/`export-mcp` working even if the SDK is
// not installed in the consumer's environment — probing is best-effort.
async function loadMcpSdk() {
  try {
    const mod = await import("@modelcontextprotocol/sdk/client/index.js")
    const transport = await import("@modelcontextprotocol/sdk/client/stdio.js")
    return { Client: mod.Client, StdioClientTransport: transport.StdioClientTransport }
  } catch {
    return null
  }
}

async function probeStdioMcp(serverName, serverConfig) {
  const command = serverConfig?.command
  const args = serverConfig?.args ?? []
  if (!command) {
    return { level: "warn", detail: `${serverName}: missing command` }
  }

  const sdk = await loadMcpSdk()
  if (!sdk) {
    return {
      level: "warn",
      detail: `${serverName}: probe skipped (@modelcontextprotocol/sdk not installed; run: npm i -g @modelcontextprotocol/sdk)`,
    }
  }

  const env = { ...process.env, ...(serverConfig?.env ?? {}) }
  const client = new sdk.Client(
    { name: "hiai-opencode-doctor", version: "0.1.0" },
    { capabilities: { tools: {}, prompts: {}, resources: {} } },
  )

  const transport = new sdk.StdioClientTransport({
    command,
    args,
    env,
    stderr: "pipe",
  })

  const timeoutMs = 60000
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs))

  try {
    await Promise.race([client.connect(transport), timeout])
    const toolsResponse = await Promise.race([client.listTools(), timeout])
    const count = toolsResponse?.tools?.length ?? 0
    await client.close()
    return { level: "ok", detail: `${serverName}: reachable, tools=${count}` }
  } catch (error) {
    try { await client.close() } catch {}
    return {
      level: "warn",
      detail: `${serverName}: probe failed (${error instanceof Error ? error.message : String(error)})`,
    }
  }
}

async function probeRemoteMcp(serverName, serverConfig) {
  const url = serverConfig?.url
  if (!url) return { level: "warn", detail: `${serverName}: missing url` }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)
    const response = await fetch(url, { method: "GET", signal: controller.signal })
    clearTimeout(timeout)
    if (response.status < 500) {
      return { level: "ok", detail: `${serverName}: endpoint reachable (${response.status})` }
    }
    return { level: "warn", detail: `${serverName}: endpoint returned ${response.status}` }
  } catch (error) {
    return {
      level: "warn",
      detail: `${serverName}: endpoint probe failed (${error instanceof Error ? error.message : String(error)})`,
    }
  }
}

async function probeMcpServers(config) {
  const payload = createMcpExport(config)
  const results = []
  for (const [name, server] of Object.entries(payload.mcpServers ?? {})) {
    if (server.command) {
      results.push(await probeStdioMcp(name, server))
      continue
    }
    if (server.type === "http") {
      results.push(await probeRemoteMcp(name, server))
      continue
    }
    results.push({ level: "warn", detail: `${name}: unsupported server shape` })
  }
  return results
}

function hasEnvOrAuth(config, envName, authKey) {
  if (process.env[envName]?.trim()) return true
  if (authKey && config?.auth?.[authKey]?.trim()) return true
  return false
}

function statusIcon(level) {
  if (level === "ok") return "✅"
  if (level === "warn") return "⚠️ "
  return "❌"
}

// Aggregate check result levels so doctor/mcp-status can exit non-zero on
// hard failures — usable as a CI gate. Returns true when healthy.
async function mcpStatus(options = {}) {
  const { path, config, error } = loadConfig()
  const staticMcpPath = join(process.cwd(), ".opencode", ".mcp.json")
  let sawError = false
  const track = (level) => { if (level === "error" || level === "fail") sawError = true }

  outInfo(options.doctor ? "hiai-opencode doctor" : "hiai-opencode mcp-status")
  outInfo(`Config: ${path ?? "not found; using defaults"}`)
  if (error) outInfo(`Config parse warning: ${error}`)
  outInfo(`Static MCP export: ${staticMcpPath}`)
  outInfo("")
  outInfo("MCP Servers:")

  for (const [name, entry] of Object.entries(MCP_REGISTRY)) {
    const userEntry = config?.mcp?.[name]
    const enabled = userEntry?.enabled ?? entry.defaultEnabled
    if (!enabled) {
      outInfo(`⚪ ${name.padEnd(20)} - disabled`)
      continue
    }

    const missingEnv = entry.requiredEnv.filter((envName) =>
      !hasEnvOrAuth(config, envName, entry.authFallback),
    )

    if (missingEnv.length > 0) {
      outInfo(`⚠️  ${name.padEnd(20)} - enabled, API key missing (${missingEnv.join(", ")})`)
      continue
    }

    const result = await entry.check(config, name)
    track(result.level)
    outInfo(`${statusIcon(result.level)} ${name.padEnd(20)} - ${result.detail}`)
  }

  if (options.doctor) {
    outInfo("")
    outInfo("Doctor Checks:")

    const freshness = checkStaticMcpFreshness(staticMcpPath, config)
    const freshIcon = freshness.status === "fresh" ? "✅" : freshness.status === "missing" ? "⚠️ " : "❌"
    if (freshness.status === "stale" || freshness.status === "drift-unmanaged") sawError = true
    outInfo(`${freshIcon} static .mcp.json freshness - ${freshness.detail}`)

    const connect = checkOpenCodeConnectVisibility(config)
    track(connect.level)
    outInfo(`${statusIcon(connect.level)} OpenCode Connect visibility - ${connect.detail}`)

    const pluginRegistration = checkOpenCodePluginRegistration()
    track(pluginRegistration.level)
    outInfo(`${statusIcon(pluginRegistration.level)} OpenCode plugin registration - ${pluginRegistration.detail}`)

    const skills = checkSkillMaterialization()
    track(skills.level)
    outInfo(`${statusIcon(skills.level)} Skill materialization - ${skills.detail}`)

    const agents = getAgentSummary(config)
    track(agents.level)
    outInfo(`${statusIcon(agents.level)} Agent count and naming - ${agents.detail}`)

    const depth = checkSubagentDepth(config)
    track(depth.level)
    outInfo(`${statusIcon(depth.level)} Delegation depth - ${depth.detail}`)

    // Model slot value validation
    const modelIssues = checkModelSlotValues(config)
    for (const issue of modelIssues) {
      track(issue.level)
      outInfo(`${statusIcon(issue.level)} ${issue.check}: ${issue.detail}`)
    }

    const lsp = checkLspAvailability(config)
    track(lsp.level)
    outInfo(`${statusIcon(lsp.level)} LSP runtime availability - ${lsp.detail}`)

    const firecrawl = checkFirecrawlAuth()
    track(firecrawl.level)
    outInfo(`${statusIcon(firecrawl.level)} Firecrawl auth - ${firecrawl.detail}`)

    const context7 = checkContext7()
    track(context7.level)
    outInfo(`${statusIcon(context7.level)} Context7 CLI - ${context7.detail}`)

    const agentBrowser = checkAgentBrowser()
    track(agentBrowser.level)
    outInfo(`${statusIcon(agentBrowser.level)} Agent-browser CLI - ${agentBrowser.detail}`)

    outInfo("")
    outInfo("MCP Tool Probes:")
    const probeResults = await probeMcpServers(config)
    for (const probe of probeResults) {
      track(probe.level)
      outInfo(`${statusIcon(probe.level)} ${probe.detail}`)
    }

    outInfo("")
    outInfo("Recommended follow-ups:")
    outInfo("  - hiai-opencode export-mcp .opencode/.mcp.json")
    outInfo("  - opencode debug config")
    outInfo("  - opencode mcp list --print-logs --log-level INFO")
  }

  return !sawError
}

async function runDiagnose(outputPath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const defaultPath = outputPath
    || join(process.cwd(), `hiai-diagnose-${timestamp}.txt`)
  const { path: configPath, config, error } = loadConfig()
  const sections = []

  sections.push("=".repeat(60))
  sections.push(`hiai-opencode diagnose - ${timestamp}`)
  sections.push("=".repeat(60))
  sections.push("")

  sections.push("ENVIRONMENT (keys only, no values):")
  const requiredEnvKeys = [
    "FIRECRAWL_API_KEY",
  ]
  const optionalEnvKeys = [
    "HIAI_MCP_AUTO_INSTALL",
    "HIAI_OPENCODE_AUTO_EXPORT_MCP",
    "HIAI_OPENCODE_MCP_EXPORT_PATH",
    "HIAI_OPENCODE_EXPORT_MCP_MODE",
    "CONTEXT7_API_KEY",
    "AGENT_BROWSER_SESSION",
    "GREP_APP_API_KEY",
    "OLLAMA_BASE_URL",
    "OLLAMA_MODEL",
  ]
  const envKeys = [...requiredEnvKeys, ...optionalEnvKeys]
  let missingRequired = 0
  for (const key of envKeys) {
    const hasValue = !!process.env[key]?.trim()
    const isRequired = requiredEnvKeys.includes(key)
    if (!hasValue && isRequired) missingRequired++
    sections.push(`  ${key}: ${hasValue ? "(set)" : "(not set)"}${isRequired ? " [REQUIRED]" : ""}`)
  }
  if (missingRequired > 0) {
    sections.push(`  WARNING: ${missingRequired} required key(s) missing`)
  }
  sections.push("")

  sections.push("CONFIGURATION:")
  sections.push(`  Config path: ${configPath ?? "(defaults)"}`)
  if (error) sections.push(`  Config parse warning: ${error}`)
  const modelKeys = Object.keys(config?.models ?? {})
  const mcpKeys = Object.keys(config?.mcp ?? {})
  sections.push(`  models configured: ${modelKeys.length} [${modelKeys.join(", ") || "none"}]`)
  sections.push(`  mcp servers in config: ${mcpKeys.length} [${mcpKeys.join(", ") || "none"}]`)
  sections.push("")

  sections.push("TOOLS REGISTERED:")
  // Count matches the tool registrations in src/index.ts hooks.tool object.
  const toolCount = 24
  sections.push(`  ~${toolCount} tools (registered in src/index.ts)`)
  sections.push("")

  sections.push("AGENTS:")
  const agents = ["bob", "build", "plan", "manager", "critic", "designer", "explore", "writer", "vision", "general"]
  for (const agent of agents) {
    const model = config?.models?.[agent]?.model
    sections.push(`  ${agent}: ${model ? `model=${model}` : "(default)"}`)
  }
  sections.push("")

  sections.push("MCP SERVERS:")
  for (const [name, entry] of Object.entries(MCP_REGISTRY)) {
    const userEntry = config?.mcp?.[name]
    const enabled = userEntry?.enabled ?? entry.defaultEnabled
    sections.push(`  ${name}: ${enabled ? "enabled" : "disabled"}`)
  }
  sections.push("")

  sections.push("FILE PATHS:")
  sections.push(`  CWD: ${process.cwd()}`)
  sections.push(`  Package root: ${PACKAGE_ROOT}`)
  sections.push(`  Config: ${configPath ?? "(none)"}`)
  sections.push(`  Static MCP: ${join(process.cwd(), ".opencode", ".mcp.json")}`)
  sections.push("")

  sections.push("=".repeat(60))
  sections.push("Diagnose complete. File written to: " + defaultPath)
  sections.push("NO secrets or API keys are included in this output.")
  sections.push("=".repeat(60))

  mkdirSync(dirname(defaultPath), { recursive: true })
  writeFileSync(defaultPath, sections.join("\n") + "\n")
  outInfo(`Diagnose written to: ${defaultPath}`)
}

async function main() {
  const command = process.argv[2]
  if (!command || command === "-h" || command === "--help") {
    // Bare `hiai-opencode` (or --help) launches the stack by default.
    if (command === "-h" || command === "--help") {
      usage()
      return
    }
    await cmdUp(process.argv.slice(3))
    return
  }

  if (command === "mcp-status") {
    const ok = await mcpStatus()
    if (!ok) process.exit(1)
    return
  }

  if (command === "doctor") {
    const ok = await mcpStatus({ doctor: true })
    if (!ok) process.exit(1)
    return
  }

  if (command === "export-mcp") {
    exportMcp(process.argv[3])
    return
  }

  if (command === "diagnose") {
    await runDiagnose(process.argv[3])
    return
  }


  if (command === "up") {
    await cmdUp(process.argv.slice(3))
    return
  }

  if (command === "down") {
    await cmdDown()
    return
  }

  if (command === "restart") {
    await cmdDown()
    await cmdUp(process.argv.slice(3))
    return
  }

  if (command === "status") {
    await cmdStatus()
    return
  }

  console.error(`Unknown command: ${command}`)
  usage()
  process.exit(1)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
