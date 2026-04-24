import { createWebsearchConfig } from "./websearch"
import { grep_app } from "./grep-app"
import type { HiaiOpenCodeConfig } from "../config/schema"

export { McpNameSchema, type McpName } from "./types"

type RemoteMcpConfig = {
  type: "remote"
  url: string
  enabled: boolean
  headers?: Record<string, string>
  oauth?: false
}

export function createBuiltinMcps(disabledMcps: string[] = [], config?: HiaiOpenCodeConfig) {
  const mcps: Record<string, RemoteMcpConfig> = {}

  if (!disabledMcps.includes("websearch")) {
    const websearchConfig = createWebsearchConfig(config?.websearch)
    if (websearchConfig) {
      mcps.websearch = websearchConfig
    }
  }

  if (!disabledMcps.includes("grep_app")) {
    mcps.grep_app = grep_app
  }

  return mcps
}
