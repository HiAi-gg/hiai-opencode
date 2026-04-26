import { expect, test, describe } from "bun:test"
import { sanitizeSubagentType, findPrimaryAgentMatch, findCallableAgentMatch, listCallableAgentNames, isTaskCallableAgentMode } from "./subagent-discovery"

describe("sanitizeSubagentType", () => {
  test("trims whitespace", () => {
    expect(sanitizeSubagentType("  researcher  ")).toBe("researcher")
  })

  test("removes surrounding quotes", () => {
    expect(sanitizeSubagentType('"researcher"')).toBe("researcher")
    expect(sanitizeSubagentType("'researcher'")).toBe("researcher")
  })

  test("removes surrounding slashes", () => {
    expect(sanitizeSubagentType("/researcher/")).toBe("researcher")
  })

  test("removes backslashes", () => {
    expect(sanitizeSubagentType("\\researcher\\")).toBe("researcher")
  })

  test("handles mixed characters", () => {
    expect(sanitizeSubagentType('  /"researcher"\\ ')).toBe("researcher")
  })
})

describe("isTaskCallableAgentMode", () => {
  test("returns true for subagent mode", () => {
    expect(isTaskCallableAgentMode("subagent")).toBe(true)
  })

  test("returns true for all mode", () => {
    expect(isTaskCallableAgentMode("all")).toBe(true)
  })

  test("returns false for primary mode", () => {
    expect(isTaskCallableAgentMode("primary")).toBe(false)
  })

  test("returns false for undefined", () => {
    expect(isTaskCallableAgentMode(undefined)).toBe(false)
  })
})

describe("findPrimaryAgentMatch", () => {
  const agents = [
    { name: "Bob", mode: "primary" as const, model: "openrouter/test/bob" },
    { name: "Coder", mode: "primary" as const, model: "openrouter/test/coder" },
    { name: "Researcher", mode: "primary" as const, model: "openrouter/test/researcher" },
    { name: "SubAgent", mode: "subagent" as const, model: "openrouter/test/sub" },
  ]

  test("finds primary agent by exact name", () => {
    const result = findPrimaryAgentMatch(agents, "Bob")
    expect(result?.name).toBe("Bob")
  })

  test("finds primary agent by canonical key", () => {
    const result = findPrimaryAgentMatch(agents, "researcher")
    expect(result?.name).toBe("Researcher")
  })

  test("returns undefined for non-existent agent", () => {
    const result = findPrimaryAgentMatch(agents, "Nonexistent")
    expect(result).toBeUndefined()
  })

  test("returns undefined when searching for subagent mode", () => {
    const result = findPrimaryAgentMatch(agents, "SubAgent")
    expect(result).toBeUndefined()
  })
})

describe("findCallableAgentMatch", () => {
  const agents = [
    { name: "Bob", mode: "primary" as const, model: "openrouter/test/bob" },
    { name: "Coder", mode: "primary" as const, model: "openrouter/test/coder" },
    { name: "Researcher", mode: "subagent" as const, model: "openrouter/test/researcher" },
    { name: "SubAgent", mode: "subagent" as const, model: "openrouter/test/sub" },
    { name: "Vision", mode: "all" as const, model: "openrouter/test/vision" },
  ]

  test("finds callable agent by subagent mode", () => {
    const result = findCallableAgentMatch(agents, "SubAgent")
    expect(result?.name).toBe("SubAgent")
  })

  test("finds callable agent by all mode", () => {
    const result = findCallableAgentMatch(agents, "Vision")
    expect(result?.name).toBe("Vision")
  })

  test("finds callable agent by canonical researcher (subagent mode)", () => {
    const result = findCallableAgentMatch(agents, "researcher")
    expect(result?.name).toBe("Researcher")
  })

  test("returns undefined for primary-only agent", () => {
    const result = findCallableAgentMatch(agents, "Bob")
    expect(result).toBeUndefined()
  })
})

describe("listCallableAgentNames", () => {
  test("lists callable agents sorted alphabetically (subagent and all modes)", () => {
    const agents = [
      { name: "Vision", mode: "all" as const },
      { name: "Researcher", mode: "subagent" as const },
      { name: "Bob", mode: "primary" as const },
    ]
    const result = listCallableAgentNames(agents)
    expect(result).toBe("Researcher, Vision")
  })

  test("returns empty string for no callable agents", () => {
    const agents = [
      { name: "Bob", mode: "primary" as const },
      { name: "Coder", mode: "primary" as const },
    ]
    const result = listCallableAgentNames(agents)
    expect(result).toBe("")
  })
})