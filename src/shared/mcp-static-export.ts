import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import type { HiaiOpencodeConfig, McpServerConfig } from "../config/types"
import { resolveEnvVars } from "../config/loader"
import { log } from "./logger"

type StaticMcpServer = {
  type?: "http" | "stdio"
  url?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  headers?: Record<string, string>
}

export const MCP_EXPORT_MARKER = "hiai-opencode"

type StaticMcpJsonPayload = {
  mcpServers: Record<string, StaticMcpServer>
  _meta?: {
    generatedBy: typeof MCP_EXPORT_MARKER
    version: 1
    generatedAt: string
  }
}

function toStaticMcpServer(config: McpServerConfig): StaticMcpServer | null {
  if (config.enabled === false) return null

  if (config.type === "remote") {
    const headers = config.headers
      ? Object.fromEntries(Object.entries(config.headers).map(([key, value]) => [key, resolveEnvVars(value)]))
      : undefined

    return {
      type: "http",
      url: config.url,
      ...(headers ? { headers } : {}),
    }
  }

  const [command, ...args] = config.command ?? []
  if (!command) return null

  const env = config.environment
    ? Object.fromEntries(Object.entries(config.environment).map(([key, value]) => [key, resolveEnvVars(value)]))
    : undefined

  return {
    command,
    ...(args.length > 0 ? { args } : {}),
    ...(env ? { env } : {}),
  }
}

export function buildStaticMcpJson(config: HiaiOpencodeConfig): StaticMcpJsonPayload {
  const mcpServers: Record<string, StaticMcpServer> = {}

  for (const [name, serverConfig] of Object.entries(config.mcp ?? {})) {
    const converted = toStaticMcpServer(serverConfig)
    if (converted) {
      mcpServers[name] = converted
    }
  }

  return {
    _meta: {
      generatedBy: MCP_EXPORT_MARKER,
      version: 1,
      generatedAt: new Date().toISOString(),
    },
    mcpServers,
  }
}

export function isManagedStaticMcpFile(path: string): boolean {
  if (!existsSync(path)) return false

  try {
    const raw = readFileSync(path, "utf-8")
    const parsed = JSON.parse(raw) as StaticMcpJsonPayload
    return parsed?._meta?.generatedBy === MCP_EXPORT_MARKER
  } catch {
    return false
  }
}

export function autoExportStaticMcpJson(directory: string, config: HiaiOpencodeConfig): void {
  const mode = process.env.HIAI_OPENCODE_AUTO_EXPORT_MCP?.trim().toLowerCase() || "if-missing"
  if (mode === "0" || mode === "false" || mode === "no" || mode === "off") {
    return
  }

  const outputPath = process.env.HIAI_OPENCODE_MCP_EXPORT_PATH?.trim() || join(directory, ".mcp.json")
  if (mode === "if-missing" && existsSync(outputPath)) {
    return
  }

  const isForceMode = mode === "force"
  if (mode === "always" && existsSync(outputPath) && !isManagedStaticMcpFile(outputPath) && !isForceMode) {
    console.warn(
      `[hiai-opencode] WARNING: refusing to overwrite non-managed static MCP config at ${outputPath}. `
      + "Set HIAI_OPENCODE_AUTO_EXPORT_MCP=force to override.",
    )
    return
  }

  try {
    mkdirSync(dirname(outputPath), { recursive: true })
    const payload = buildStaticMcpJson(config)
    writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`)
    log("[hiai-opencode] exported static MCP config", {
      outputPath,
      servers: Object.keys(payload.mcpServers),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`[hiai-opencode] WARNING: failed to export static MCP config to ${outputPath}: ${message}`)
  }
}
