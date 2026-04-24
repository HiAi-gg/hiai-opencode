import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import type { HiaiOpenCodeConfig, HiaiOpencodeConfig } from "../config"
import { HIAI_MCP_REGISTRY } from "../mcp/registry"
import { parseJsoncSafe } from "./jsonc-parser"
import { getOpenCodeConfigPaths } from "./opencode-config-dir"
import { PLUGIN_NAME } from "./plugin-identity"

interface OpenCodeConfig {
  plugin?: Array<string | [string, ...unknown[]]>
}

function readPlugins(configPath: string): string[] {
  if (!existsSync(configPath)) return []

  try {
    const content = readFileSync(configPath, "utf-8")
    const parsed = parseJsoncSafe<OpenCodeConfig>(content)
    return (parsed.data?.plugin ?? [])
      .map((entry) => typeof entry === "string" ? entry : Array.isArray(entry) ? entry[0] : "")
      .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
  } catch {
    return []
  }
}

export function warnIfListPluginEntry(directory: string): void {
  const globalPaths = getOpenCodeConfigPaths({ binary: "opencode", version: null })
  const candidates = [
    join(directory, ".opencode", "opencode.json"),
    join(directory, ".opencode", "opencode.jsonc"),
    globalPaths.configJson,
    globalPaths.configJsonc,
  ]

  for (const configPath of candidates) {
    const plugins = readPlugins(configPath)
    if (!plugins.includes("list")) continue

    console.warn(`[hiai-opencode] WARNING: ${configPath} contains plugin: ["list"].`)
    console.warn("[hiai-opencode] This can prevent hiai-opencode MCP servers from loading from that config scope.")
    console.warn(`[hiai-opencode] Update it to: plugin: ["${PLUGIN_NAME}"]`)
  }
}

function hasConfigAuthFallback(pluginConfig: HiaiOpenCodeConfig, envName: string): boolean {
  if (envName === "FIRECRAWL_API_KEY") return !!pluginConfig.auth?.firecrawl?.trim()
  if (envName === "STITCH_AI_API_KEY") return !!pluginConfig.auth?.stitch?.trim()
  if (envName === "CONTEXT7_API_KEY") return !!pluginConfig.auth?.context7?.trim()
  return false
}

export function warnMissingRequiredMcpEnv(args: {
  pluginConfig: HiaiOpenCodeConfig
  platformConfig: HiaiOpencodeConfig
}): void {
  const disabled = new Set(args.pluginConfig.disabled_mcps ?? [])
  const mcpConfig = args.platformConfig.mcp ?? {}

  for (const [name, entry] of Object.entries(HIAI_MCP_REGISTRY)) {
    if (disabled.has(name)) continue
    if (mcpConfig[name]?.enabled === false) continue
    if (!entry.requiredEnv || entry.requiredEnv.length === 0) continue

    const missing = entry.requiredEnv.filter((envName) =>
      !process.env[envName]?.trim() && !hasConfigAuthFallback(args.pluginConfig, envName)
    )

    if (missing.length === 0) continue

    console.warn(
      `[hiai-opencode] MCP "${name}" is enabled but missing required env: ${missing.join(", ")}.`
      + " The plugin will continue to load; set the key or disable this MCP in hiai-opencode.json.",
    )
  }
}
