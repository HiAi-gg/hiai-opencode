import { expect, test } from "bun:test";
import type { ToolContext } from "@opencode-ai/plugin/tool";

import { createSkillMcpTool } from "./tools";

test("skill_mcp falls back to enabled builtin MCP when skill MCP is absent", async () => {
  let callCaptured: { serverName: string; toolName: string } | null = null;

  const toolDef = createSkillMcpTool({
    manager: {
      async callTool(info, _context, toolName) {
        callCaptured = { serverName: info.serverName, toolName };
        return { ok: true };
      },
      async readResource() {
        return { ok: true };
      },
      async getPrompt() {
        return { ok: true };
      },
    } as any,
    getLoadedSkills: () => [],
    getSessionID: () => "session-test",
    builtinMcp: {
      context7: {
        enabled: true,
        type: "remote",
        url: "https://mcp.context7.com/mcp",
      },
    },
  });

  const result = await toolDef.execute(
    {
      mcp_name: "context7",
      tool_name: "context7_search",
      arguments: { query: "test" },
    } as any,
    { sessionID: "session-test" } as ToolContext,
  );

  expect(callCaptured).toEqual({
    serverName: "context7",
    toolName: "context7_search",
  });
  expect(result).toContain('"ok": true');
});
