#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { homedir } from "node:os"
import { parse } from "jsonc-parser"
import { createHash } from "node:crypto"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"

const DEFAULT_RAG_URL = "http://localhost:9002/tools/search"
const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const MCP_EXPORT_MARKER = "hiai-opencode"

const MCP_REGISTRY = {
  playwright: {
    defaultEnabled: true,
    requiredEnv: [],
    check: checkNodeNpx,
  },
  rag: {
    defaultEnabled: true,
    requiredEnv: [],
    check: checkRag,
  },
  firecrawl: {
    defaultEnabled: true,
    requiredEnv: ["FIRECRAWL_API_KEY"],
    authFallback: "firecrawl",
    check: checkNodeNpx,
  },
  mempalace: {
    defaultEnabled: true,
    requiredEnv: [],
    check: checkMempalace,
  },
  stitch: {
    defaultEnabled: true,
    requiredEnv: ["STITCH_AI_API_KEY"],
    authFallback: "stitch",
    check: checkRemoteKeyOnly,
  },
  context7: {
    defaultEnabled: true,
    requiredEnv: [],
    check: checkRemoteOptionalKey,
  },
  "sequential-thinking": {
    defaultEnabled: true,
    requiredEnv: [],
    check: checkNodeNpx,
  },
}

function usage() {
  console.log(`hiai-opencode

Usage:
  hiai-opencode doctor
  hiai-opencode mcp-status
  hiai-opencode export-mcp [path]
  hiai-opencode diagnose [path]

Commands:
  doctor       Full install/runtime diagnostic: MCP status + static export freshness + provider/skills/agents/LSP checks + MCP tool probes.
  mcp-status   Check hiai-opencode MCP configuration, keys, and local runtimes.
  export-mcp   Write a static .mcp.json for hosts whose mcp list ignores plugin runtime MCP.
  diagnose     Collect full diagnostic bundle to file (local only, no remote sending).
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
  const paths = [
    join(cwd, "hiai-opencode.json"),
    join(cwd, "hiai-opencode.jsonc"),
    join(cwd, ".opencode", "hiai-opencode.json"),
    join(cwd, ".opencode", "hiai-opencode.jsonc"),
    join(homedir(), ".config", "opencode", "hiai-opencode.json"),
    join(homedir(), ".config", "opencode", "hiai-opencode.jsonc"),
  ]

  if (process.platform === "win32" && process.env.APPDATA) {
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
        config: parse(readFileSync(path, "utf-8")) ?? {},
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

function checkOpenCodePluginRegistration() {
  for (const path of candidateOpenCodeConfigPaths()) {
    if (!existsSync(path)) continue
    try {
      const parsed = parse(readFileSync(path, "utf-8")) ?? {}
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

      if (plugins.includes("@hiai-gg/hiai-opencode")) {
        return {
          level: "ok",
          detail: `plugin registered in ${path}`,
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

  if (enabled(config, "playwright")) {
    servers.playwright = {
      command: "node",
      args: [assetPath("mcp", "playwright.mjs")],
    }
  }

  if (enabled(config, "stitch")) {
    servers.stitch = {
      type: "http",
      url: "https://stitch.googleapis.com/mcp",
      headers: {
        "X-Goog-Api-Key": config?.auth?.stitch || "${STITCH_AI_API_KEY}",
      },
    }
  }

  if (enabled(config, "sequential-thinking")) {
    servers["sequential-thinking"] = {
      command: "node",
      args: [
        assetPath("runtime", "npm-package-runner.mjs"),
        "@modelcontextprotocol/server-sequential-thinking",
      ],
    }
  }

  if (enabled(config, "firecrawl")) {
    servers.firecrawl = {
      command: "node",
      args: [assetPath("runtime", "npm-package-runner.mjs"), "firecrawl-mcp"],
      env: {
        FIRECRAWL_API_KEY: config?.auth?.firecrawl || "${FIRECRAWL_API_KEY}",
      },
    }
  }

  if (enabled(config, "rag")) {
    servers.rag = {
      command: "node",
      args: [assetPath("mcp", "rag.mjs")],
      env: {
        OPENCODE_RAG_URL:
          process.env.OPENCODE_RAG_URL
          || resolveEnvTemplate(config?.mcp?.rag?.environment?.OPENCODE_RAG_URL)
          || DEFAULT_RAG_URL,
      },
    }
  }

  if (enabled(config, "mempalace")) {
    const mempalacePython =
      process.env.MEMPALACE_PYTHON?.trim()
      || resolveEnvTemplate(config?.mcp?.mempalace?.pythonPath?.trim())

    servers.mempalace = {
      command: "node",
      args: [assetPath("mcp", "mempalace.mjs"), "--palace", "./.opencode/palace"],
      env: mempalacePython
        ? { MEMPALACE_PYTHON: mempalacePython }
        : undefined,
    }
  }

  if (enabled(config, "context7")) {
    servers.context7 = {
      type: "http",
      url: "https://mcp.context7.com/mcp",
      headers: config?.auth?.context7 || process.env.CONTEXT7_API_KEY
        ? { "X-API-KEY": config?.auth?.context7 || "${CONTEXT7_API_KEY}" }
        : undefined,
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

function exportMcp(outputPath = join(process.cwd(), ".mcp.json")) {
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
  console.log(`Wrote ${outputPath}`)
  console.log(`Source config: ${path ?? "defaults"}`)
  console.log(`Servers: ${Object.keys(output.mcpServers).join(", ") || "(none)"}`)
}

function hasCommand(command, args = ["--version"]) {
  const result = spawnSync(command, args, {
    stdio: "ignore",
    timeout: 10000,
    shell: process.platform === "win32",
  })
  return result.status === 0
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

function resolveVenvPythonCandidates(basePath) {
  if (!basePath) return []
  if (process.platform === "win32") {
    return [
      join(basePath, ".venv", "Scripts", "python.exe"),
      join(basePath, "venv", "Scripts", "python.exe"),
    ]
  }

  return [
    join(basePath, ".venv", "bin", "python"),
    join(basePath, ".venv", "bin", "python3"),
    join(basePath, "venv", "bin", "python"),
    join(basePath, "venv", "bin", "python3"),
  ]
}

function pythonCandidates(config) {
  const configured = process.env.MEMPALACE_PYTHON?.trim()
    || resolveEnvTemplate(config?.mcp?.mempalace?.pythonPath?.trim())
  const candidates = []
  if (configured) candidates.push(configured)

  for (const candidate of resolveVenvPythonCandidates(process.cwd())) {
    if (existsSync(candidate)) candidates.push(candidate)
  }

  for (const candidate of resolveVenvPythonCandidates(PACKAGE_ROOT)) {
    if (existsSync(candidate)) candidates.push(candidate)
  }

  for (const candidate of resolveVenvPythonCandidates(join(homedir(), ".config", "opencode", "plugins", "hiai-opencode"))) {
    if (existsSync(candidate)) candidates.push(candidate)
  }

  if (process.platform === "win32") {
    candidates.push("py", "python", "python3")
  } else {
    candidates.push("python3", "python")
  }
  return [...new Set(candidates)]
}

function canImportMempalace(command) {
  const args =
    command === "py"
      ? ["-3", "-c", "import mempalace.mcp_server"]
      : ["-c", "import mempalace.mcp_server"]
  const result = spawnSync(command, args, {
    stdio: "ignore",
    timeout: 10000,
    shell: process.platform === "win32",
  })
  return result.status === 0
}

function checkMempalace(config) {
  if (hasCommand(process.platform === "win32" ? "uv.exe" : "uv")) {
    return { level: "ok", detail: "uv available" }
  }

  for (const candidate of pythonCandidates(config)) {
    if (canImportMempalace(candidate)) {
      return { level: "ok", detail: `${candidate} with mempalace available` }
    }
  }

  const hasPython = pythonCandidates(config).some((candidate) =>
    hasCommand(candidate, candidate === "py" ? ["-3", "--version"] : ["--version"]),
  )

  return {
    level: "error",
    detail: hasPython ? "mempalace Python package not found" : "python not found",
  }
}

async function checkRag(config) {
  const url =
    process.env.OPENCODE_RAG_URL?.trim()
    || resolveEnvTemplate(config?.mcp?.rag?.environment?.OPENCODE_RAG_URL)
    || DEFAULT_RAG_URL

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2500)
    const response = await fetch(url, { method: "GET", signal: controller.signal })
    clearTimeout(timeout)

    if (response.status < 500) {
      return { level: "ok", detail: `enabled, ${url} reachable` }
    }
    return { level: "warn", detail: `enabled, ${url} returned ${response.status}` }
  } catch {
    return { level: "warn", detail: `enabled, ${url} not reachable` }
  }
}

function checkRemoteKeyOnly() {
  return { level: "ok", detail: "remote endpoint configured" }
}

function checkRemoteOptionalKey(_config, name) {
  if (name === "context7" && !process.env.CONTEXT7_API_KEY?.trim()) {
    return { level: "ok", detail: "remote endpoint configured, API key optional/missing" }
  }
  return { level: "ok", detail: "remote endpoint configured" }
}

function detectMempalacePythonSource(config) {
  const envPython = process.env.MEMPALACE_PYTHON?.trim()
  if (envPython) {
    return { source: "env:MEMPALACE_PYTHON", value: envPython }
  }

  const cfgPython = resolveEnvTemplate(config?.mcp?.mempalace?.pythonPath?.trim())
  if (cfgPython) {
    return { source: "config:mcp.mempalace.pythonPath", value: cfgPython }
  }

  const candidates = pythonCandidates(config)
  if (candidates.length > 0) {
    const resolved = candidates.find((candidate) =>
      hasCommand(candidate, candidate === "py" ? ["-3", "--version"] : ["--version"]),
    )
    if (resolved) {
      return { source: "auto-detect", value: resolved }
    }
  }

  return { source: "none", value: "" }
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

function getAgentSummary(config) {
  const visible = [
    "Bob",
    "Coder",
    "Strategist",
    "Guard",
    "Critic",
    "Designer",
    "Researcher",
    "Manager",
    "Brainstormer",
    "Vision",
  ]
  const hidden = ["Agent Skills", "Sub", "build", "plan"]
  const modelCount = Object.keys(config?.models ?? {}).length
  return {
    level: modelCount >= 10 ? "ok" : "warn",
    detail: `visible=${visible.length} [${visible.join(", ")}]; hidden=${hidden.length} [${hidden.join(", ")}]; model slots configured=${modelCount}/10`,
  }
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
    const args = binary === "node" ? ["--version"] : ["--version"]
    const ok = hasCommand(binary, args)
    results.push(`${ok ? "✅" : "⚠️ "} ${name}: ${ok ? "runtime available" : `${binary} not found`}`)
  }

  return {
    level: results.some((line) => line.startsWith("⚠️")) ? "warn" : "ok",
    detail: results.join(" | "),
  }
}

async function probeStdioMcp(serverName, serverConfig) {
  const command = serverConfig?.command
  const args = serverConfig?.args ?? []
  if (!command) {
    return { level: "warn", detail: `${serverName}: missing command` }
  }

  const env = { ...process.env, ...(serverConfig?.env ?? {}) }
  const client = new Client(
    { name: "hiai-opencode-doctor", version: "0.1.0" },
    { capabilities: { tools: {}, prompts: {}, resources: {} } },
  )

  const transport = new StdioClientTransport({
    command,
    args,
    env,
    stderr: "pipe",
  })

  const timeoutMs = 12000
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

async function mcpStatus(options = {}) {
  const { path, config, error } = loadConfig()
  const staticMcpPath = join(process.cwd(), ".mcp.json")
  console.log(options.doctor ? "hiai-opencode doctor" : "hiai-opencode mcp-status")
  console.log(`Config: ${path ?? "not found; using defaults"}`)
  if (error) console.log(`Config parse warning: ${error}`)
  console.log(`Static MCP export: ${staticMcpPath}`)
  console.log("")
  console.log("MCP Servers:")

  for (const [name, entry] of Object.entries(MCP_REGISTRY)) {
    const userEntry = config?.mcp?.[name]
    const enabled = userEntry?.enabled ?? entry.defaultEnabled
    if (!enabled) {
      console.log(`⚪ ${name.padEnd(20)} - disabled`)
      continue
    }

    const missingEnv = entry.requiredEnv.filter((envName) =>
      !hasEnvOrAuth(config, envName, entry.authFallback),
    )

    if (missingEnv.length > 0) {
      console.log(`⚠️  ${name.padEnd(20)} - enabled, API key missing (${missingEnv.join(", ")})`)
      continue
    }

    const result = await entry.check(config, name)
    console.log(`${statusIcon(result.level)} ${name.padEnd(20)} - ${result.detail}`)
  }

  if (options.doctor) {
    console.log("")
    console.log("Doctor Checks:")

    const freshness = checkStaticMcpFreshness(staticMcpPath, config)
    const freshIcon = freshness.status === "fresh" ? "✅" : freshness.status === "missing" ? "⚠️ " : "❌"
    console.log(`${freshIcon} static .mcp.json freshness - ${freshness.detail}`)

    const connect = checkOpenCodeConnectVisibility(config)
    console.log(`${statusIcon(connect.level)} OpenCode Connect visibility - ${connect.detail}`)

    const pluginRegistration = checkOpenCodePluginRegistration()
    console.log(`${statusIcon(pluginRegistration.level)} OpenCode plugin registration - ${pluginRegistration.detail}`)

    const skills = checkSkillMaterialization()
    console.log(`${statusIcon(skills.level)} Skill materialization - ${skills.detail}`)

    const agents = getAgentSummary(config)
    console.log(`${statusIcon(agents.level)} Agent count and naming - ${agents.detail}`)

    const lsp = checkLspAvailability(config)
    console.log(`${statusIcon(lsp.level)} LSP runtime availability - ${lsp.detail}`)

    const mempalacePython = detectMempalacePythonSource(config)
    const mempalacePythonIcon = mempalacePython.value ? "✅" : "⚠️ "
    console.log(`${mempalacePythonIcon} MemPalace python selection - ${mempalacePython.source}${mempalacePython.value ? ` (${mempalacePython.value})` : ""}`)

    console.log("")
    console.log("MCP Tool Probes:")
    const probeResults = await probeMcpServers(config)
    for (const probe of probeResults) {
      console.log(`${statusIcon(probe.level)} ${probe.detail}`)
    }

    console.log("")
    console.log("Recommended follow-ups:")
    console.log("  - hiai-opencode export-mcp .mcp.json")
    console.log("  - opencode debug config")
    console.log("  - opencode mcp list --print-logs --log-level INFO")
  }
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
  const envKeys = [
    "FIRECRAWL_API_KEY", "STITCH_AI_API_KEY", "CONTEXT7_API_KEY",
    "EXA_API_KEY", "TAVILY_API_KEY", "OPENCODE_RAG_URL",
    "MEMPALACE_PYTHON", "HIAI_PLAYWRIGHT_INSTALL_BROWSERS", "HIAI_MCP_AUTO_INSTALL",
  ]
  for (const key of envKeys) {
    const hasValue = !!process.env[key]?.trim()
    sections.push(`  ${key}: ${hasValue ? "(set)" : "(not set)"}`)
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
  const toolCount = 26
  sections.push(`  ~${toolCount} tools (from tool-registry.ts)`)
  sections.push("")

  sections.push("AGENTS:")
  const agents = ["bob", "coder", "strategist", "guard", "critic", "designer", "researcher", "manager", "brainstormer", "vision"]
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
  sections.push(`  Static MCP: ${join(process.cwd(), ".mcp.json")}`)
  sections.push("")

  sections.push("=".repeat(60))
  sections.push("Diagnose complete. File written to: " + defaultPath)
  sections.push("NO secrets or API keys are included in this output.")
  sections.push("=".repeat(60))

  mkdirSync(dirname(defaultPath), { recursive: true })
  writeFileSync(defaultPath, sections.join("\n") + "\n")
  console.log(`Diagnose written to: ${defaultPath}`)
}

async function main() {
  const command = process.argv[2]
  if (!command || command === "-h" || command === "--help") {
    usage()
    return
  }

  if (command === "mcp-status") {
    await mcpStatus()
    return
  }

  if (command === "doctor") {
    await mcpStatus({ doctor: true })
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

  console.error(`Unknown command: ${command}`)
  usage()
  process.exit(1)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
