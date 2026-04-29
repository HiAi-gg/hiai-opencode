import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { createCleanMcpEnvironment } from "./env-cleaner"

const TEST_VARS = [
  "FIRECRAWL_API_KEY",
  "STITCH_AI_API_KEY",
  "ANTHROPIC_API_KEY",
  "NPM_CONFIG_REGISTRY",
  "MY_NORMAL_VAR",
  "PATH_TO_NOWHERE",
] as const

const originalValues: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const key of TEST_VARS) {
    originalValues[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of TEST_VARS) {
    if (originalValues[key] === undefined) delete process.env[key]
    else process.env[key] = originalValues[key]
  }
})

describe("createCleanMcpEnvironment", () => {
  test("filters npm/pnpm config vars from process.env", () => {
    process.env.NPM_CONFIG_REGISTRY = "https://registry.npmjs.org/"
    process.env.MY_NORMAL_VAR = "keepme"
    const env = createCleanMcpEnvironment()
    expect(env.NPM_CONFIG_REGISTRY).toBeUndefined()
    expect(env.MY_NORMAL_VAR).toBe("keepme")
  })

  test("filters secret-shaped names from process.env when not explicitly allowed", () => {
    process.env.FIRECRAWL_API_KEY = "leaked-from-process-env"
    const env = createCleanMcpEnvironment()
    expect(env.FIRECRAWL_API_KEY).toBeUndefined()
  })

  test("customEnv overrides the secret filter (explicit allowlist)", () => {
    // Regression test: previously customEnv was assigned before filtering,
    // so an explicitly configured FIRECRAWL_API_KEY would be stripped by
    // the generic /_API_KEY$/i pattern.
    const env = createCleanMcpEnvironment({
      FIRECRAWL_API_KEY: "user-configured-value",
    })
    expect(env.FIRECRAWL_API_KEY).toBe("user-configured-value")
  })

  test("customEnv beats both process.env value and the secret filter", () => {
    process.env.FIRECRAWL_API_KEY = "ambient-value"
    const env = createCleanMcpEnvironment({
      FIRECRAWL_API_KEY: "explicit-value",
    })
    expect(env.FIRECRAWL_API_KEY).toBe("explicit-value")
  })

  test("customEnv passes through non-secret keys unchanged", () => {
    const env = createCleanMcpEnvironment({
      PLAYWRIGHT_MCP_EXECUTABLE_PATH: "/usr/bin/chromium",
    })
    expect(env.PLAYWRIGHT_MCP_EXECUTABLE_PATH).toBe("/usr/bin/chromium")
  })

  test("ANTHROPIC_API_KEY in process.env is still filtered", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-leaked"
    const env = createCleanMcpEnvironment()
    expect(env.ANTHROPIC_API_KEY).toBeUndefined()
  })
})
