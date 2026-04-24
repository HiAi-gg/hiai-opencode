#!/usr/bin/env node

import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { homedir } from "node:os"
import { parse } from "jsonc-parser"

const DEFAULT_RAG_URL = "http://localhost:9002/tools/search"

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
  hiai-opencode mcp-status

Commands:
  mcp-status   Check hiai-opencode MCP configuration, keys, and local runtimes.
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

function pythonCandidates() {
  const configured = process.env.MEMPALACE_PYTHON?.trim()
  const candidates = []
  if (configured) candidates.push(configured)
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

function checkMempalace() {
  if (hasCommand(process.platform === "win32" ? "uv.exe" : "uv")) {
    return { level: "ok", detail: "uv available" }
  }

  for (const candidate of pythonCandidates()) {
    if (canImportMempalace(candidate)) {
      return { level: "ok", detail: `${candidate} with mempalace available` }
    }
  }

  const hasPython = pythonCandidates().some((candidate) =>
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

async function mcpStatus() {
  const { path, config, error } = loadConfig()
  console.log("hiai-opencode mcp-status")
  console.log(`Config: ${path ?? "not found; using defaults"}`)
  if (error) console.log(`Config parse warning: ${error}`)
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

  console.error(`Unknown command: ${command}`)
  usage()
  process.exit(1)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
