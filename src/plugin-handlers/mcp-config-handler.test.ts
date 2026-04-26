import { expect, test } from "bun:test"

import { applyMcpConfig } from "./mcp-config-handler"

const emptyPluginComponents = {
  commands: {},
  skills: {},
  agents: {},
  mcpServers: {},
  hooksConfigs: [],
  plugins: [],
  errors: [],
}

test("context7 auth fallback from hiai-opencode config is used when env placeholder is empty", async () => {
  const config: Record<string, unknown> = {}

  await applyMcpConfig({
    config,
    pluginConfig: {
      auth: { context7: "ctx-test-key" },
      claude_code: { mcp: false },
      __platformDefaults: {
        mcp: {
          context7: {
            enabled: true,
            type: "remote",
            url: "https://mcp.context7.com/mcp",
            headers: { "X-API-KEY": "{env:CONTEXT7_API_KEY}" },
          },
        },
      },
    } as any,
    pluginComponents: emptyPluginComponents,
  })

  expect((config.mcp as any).context7.headers).toEqual({ "X-API-KEY": "ctx-test-key" })
})

test("firecrawl auth fallback from hiai-opencode config is used when env placeholder is empty", async () => {
  const config: Record<string, unknown> = {}

  await applyMcpConfig({
    config,
    pluginConfig: {
      auth: { firecrawl: "fc-test-key" },
      claude_code: { mcp: false },
      __platformDefaults: {
        mcp: {
          firecrawl: {
            enabled: true,
            type: "remote",
            url: "http://localhost/firecrawl",
            environment: { FIRECRAWL_API_KEY: "{env:FIRECRAWL_API_KEY}" },
          },
        },
      },
    } as any,
    pluginComponents: emptyPluginComponents,
  })

  expect((config.mcp as any).firecrawl.environment).toEqual({ FIRECRAWL_API_KEY: "fc-test-key" })
})
