import { join } from "node:path"
import { existsSync } from "node:fs"
import type { McpServerConfig } from "../config/types.js"

export type HiaiMcpName =
  | "stitch"
  | "sequential-thinking"
  | "context7"
  | "mempalace"
  | "grep_app"

export type HiaiMcpInstallKind = "bundled" | "npm" | "python" | "remote" | "user-service"

export interface HiaiMcpRegistryEntry {
  name: HiaiMcpName
  enabledByDefault: boolean
  install: HiaiMcpInstallKind
  requiredEnv?: string[]
  optionalEnv?: string[]
  config: McpServerConfig
}

function resolveAssetScript(...segments: string[]): string {
  const candidates = [
    join(import.meta.dirname, "..", "assets", ...segments),
    join(import.meta.dirname, "..", "..", "assets", ...segments),
  ]
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]
}

function createNpmPackageCommand(pkg: string, ...args: string[]): string[] {
  return ["node", resolveAssetScript("runtime", "npm-package-runner.mjs"), pkg, ...args]
}

export const HIAI_MCP_REGISTRY: Record<HiaiMcpName, HiaiMcpRegistryEntry> = {
  stitch: {
    name: "stitch",
    enabledByDefault: true,
    install: "remote",
    requiredEnv: ["STITCH_AI_API_KEY"],
    config: {
      enabled: true,
      type: "remote",
      url: "https://stitch.googleapis.com/mcp",
      headers: { "X-Goog-Api-Key": "{env:STITCH_AI_API_KEY}" },
      timeout: 600000,
    },
  },
  "sequential-thinking": {
    name: "sequential-thinking",
    enabledByDefault: true,
    install: "npm",
    config: {
      enabled: true,
      command: createNpmPackageCommand("@modelcontextprotocol/server-sequential-thinking"),
      timeout: 600000,
    },
  },
  context7: {
    name: "context7",
    enabledByDefault: true,
    install: "remote",
    optionalEnv: ["CONTEXT7_API_KEY"],
    config: {
      enabled: true,
      type: "remote",
      url: "https://mcp.context7.com/mcp",
      headers: { "X-API-KEY": "{env:CONTEXT7_API_KEY}" },
      timeout: 600000,
    },
  },
  mempalace: {
    name: "mempalace",
    enabledByDefault: true,
    install: "python",
    optionalEnv: ["MEMPALACE_PYTHON", "MEMPALACE_PALACE_PATH", "HIAI_MCP_AUTO_INSTALL"],
    config: {
      enabled: true,
      type: "local",
      command: ["node", resolveAssetScript("mcp", "mempalace.mjs"), "--palace", "./.opencode/palace"],
      timeout: 600000,
    },
  },
  grep_app: {
    name: "grep_app",
    enabledByDefault: true,
    install: "remote",
    config: {
      enabled: true,
      type: "remote",
      url: "https://mcp.grep.app",
      timeout: 600000,
    },
  },
}

export function createDefaultMcpConfig(): Record<HiaiMcpName, McpServerConfig> {
  return Object.fromEntries(
    Object.entries(HIAI_MCP_REGISTRY).map(([name, entry]) => [
      name,
      { ...entry.config, enabled: entry.enabledByDefault },
    ]),
  ) as Record<HiaiMcpName, McpServerConfig>
}

export function getKnownMcpNames(): HiaiMcpName[] {
  return Object.keys(HIAI_MCP_REGISTRY) as HiaiMcpName[]
}
