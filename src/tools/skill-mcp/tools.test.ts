import { expect, test } from "bun:test"
import type { ToolContext } from "@opencode-ai/plugin/tool"

import { createSkillMcpTool } from "./tools"

test("skill_mcp falls back to enabled builtin MCP when skill MCP is absent", async () => {
  let callCaptured: { serverName: string; toolName: string } | null = null

  const toolDef = createSkillMcpTool({
    manager: {
      async callTool(info, _context, toolName) {
        callCaptured = { serverName: info.serverName, toolName }
        return { ok: true }
      },
      async readResource() {
        return { ok: true }
      },
      async getPrompt() {
        return { ok: true }
      },
    } as any,
    getLoadedSkills: () => [],
    getSessionID: () => "session-test",
    builtinMcp: {
      firecrawl: {
        enabled: true,
        type: "local",
        command: ["node", "firecrawl.mjs"],
      },
    },
  })

  const result = await toolDef.execute(
    {
      mcp_name: "firecrawl",
      tool_name: "firecrawl_search",
      arguments: { query: "test" },
    } as any,
    { sessionID: "session-test" } as ToolContext,
  )

  expect(callCaptured).toEqual({ serverName: "firecrawl", toolName: "firecrawl_search" })
  expect(result).toContain("\"ok\": true")
})
