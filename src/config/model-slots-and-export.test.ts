import { expect, test } from "bun:test"

import { applyModelSlots } from "./defaults"
import type { HiaiOpencodeConfig } from "./types"
import { buildStaticMcpJson, MCP_EXPORT_MARKER } from "../shared/mcp-static-export"
import { buildHiaiIntegrationPrimerSection } from "../agents/dynamic-agent-core-sections"

const baseConfig: HiaiOpencodeConfig = {
  models: {
    bob: { model: "openrouter/test/bob", recommended: "xhigh" },
    coder: { model: "openrouter/test/coder", recommended: "high" },
    strategist: { model: "openrouter/test/strategist", recommended: "high" },
    guard: { model: "openrouter/test/guard", recommended: "middle" },
    critic: { model: "openrouter/test/critic", recommended: "high" },
    designer: { model: "openrouter/test/designer", recommended: "design" },
    researcher: { model: "openrouter/test/researcher", recommended: "fast" },
    manager: { model: "openrouter/test/manager", recommended: "fast" },
    brainstormer: { model: "openrouter/test/brainstormer", recommended: "writing" },
    vision: { model: "openrouter/test/vision", recommended: "vision" },
  },
  mcp: {
    mempalace: { enabled: true, pythonPath: "/opt/venv/bin/python" },
  },
}

test("model slots derive canonical agents and categories", () => {
  const resolved = applyModelSlots(baseConfig)
  expect(resolved.agents?.bob?.model).toBe("openrouter/test/bob")
  expect(resolved.agents?.coder?.model).toBe("openrouter/test/coder")
  expect(resolved.agents?.["platform-manager"]?.model).toBe("openrouter/test/manager")
  expect(resolved.agents?.sub?.model).toBe("openrouter/test/coder")
  expect(resolved.categories?.artistry?.model).toBe("openrouter/test/designer")
  expect(resolved.categories?.ultrabrain?.model).toBe("openrouter/test/strategist")
  expect(resolved.categories?.writing?.model).toBe("openrouter/test/brainstormer")
})

test("compact MCP mempalace pythonPath is materialized into environment", () => {
  const resolved = applyModelSlots(baseConfig)
  expect(resolved.mcp?.mempalace?.environment?.MEMPALACE_PYTHON).toBe("/opt/venv/bin/python")
})

test("static MCP export includes marker metadata and servers", () => {
  const resolved = applyModelSlots(baseConfig)
  const exported = buildStaticMcpJson(resolved)

  expect(exported._meta?.generatedBy).toBe(MCP_EXPORT_MARKER)
  expect(exported._meta?.version).toBe(1)
  expect(exported.mcpServers.playwright).toBeDefined()
  expect(exported.mcpServers.mempalace).toBeDefined()
})

test("integration primer does not request model provider API keys", () => {
  const primer = buildHiaiIntegrationPrimerSection()
  expect(primer).toContain("Do not ask for `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY`")
})
