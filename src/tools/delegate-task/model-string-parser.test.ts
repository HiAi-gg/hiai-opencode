import { expect, test, describe } from "bun:test"
import { parseModelString, parseVariantFromModelID } from "./model-string-parser"

describe("parseModelString", () => {
  test("parses model with variant", () => {
    const result = parseModelString("openai/gpt-5.3-codex medium")
    expect(result?.modelID).toBe("gpt-5.3-codex")
    expect(result?.providerID).toBe("openai")
    expect(result?.variant).toBe("medium")
  })

  test("parses model without variant", () => {
    const result = parseModelString("openai/gpt-5.3-codex")
    expect(result?.modelID).toBe("gpt-5.3-codex")
    expect(result?.providerID).toBe("openai")
    expect(result?.variant).toBeUndefined()
  })

  test("handles whitespace trimming", () => {
    const result = parseModelString("  openai/gpt-5.3-codex  high  ")
    expect(result?.modelID).toBe("gpt-5.3-codex")
    expect(result?.variant).toBe("high")
  })

  test("handles empty string", () => {
    const result = parseModelString("")
    expect(result).toBeUndefined()
  })

  test("handles model with multiple spaces before variant", () => {
    const result = parseModelString("anthropic/claude-3.5-sonnet  high")
    expect(result?.modelID).toBe("claude-3.5-sonnet")
    expect(result?.variant).toBe("high")
  })

  test("handles provider/model with multiple slashes", () => {
    const result = parseModelString("openrouter/anthropic/claude-3.5-sonnet ultra")
    expect(result?.providerID).toBe("openrouter")
    expect(result?.modelID).toBe("anthropic/claude-3.5-sonnet ultra")
  })

  test("returns model when no variant", () => {
    const result = parseModelString("openrouter/google/gemini-2.0-flash")
    expect(result?.modelID).toBe("google/gemini-2.0-flash")
    expect(result?.providerID).toBe("openrouter")
    expect(result?.variant).toBeUndefined()
  })

  test("single slash model returns undefined", () => {
    const result = parseModelString("claude-medium")
    expect(result).toBeUndefined()
  })

  test("model with xhigh variant", () => {
    const result = parseModelString("openai/gpt-5.3-codex xhigh")
    expect(result?.modelID).toBe("gpt-5.3-codex")
    expect(result?.variant).toBe("xhigh")
  })

  test("model with max variant", () => {
    const result = parseModelString("anthropic/claude-3.5-opus max")
    expect(result?.modelID).toBe("claude-3.5-opus")
    expect(result?.variant).toBe("max")
  })
})

describe("parseVariantFromModelID", () => {
  test("extracts parenthesized variant", () => {
    const result = parseVariantFromModelID("gpt-5.3-codex (medium)")
    expect(result.modelID).toBe("gpt-5.3-codex")
    expect(result.variant).toBe("medium")
  })

  test("extracts space variant", () => {
    const result = parseVariantFromModelID("gpt-5.3-codex medium")
    expect(result.modelID).toBe("gpt-5.3-codex")
    expect(result.variant).toBe("medium")
  })

  test("no variant when not recognized", () => {
    const result = parseVariantFromModelID("gpt-5.3-codex unknownvariant")
    expect(result.modelID).toBe("gpt-5.3-codex unknownvariant")
    expect(result.variant).toBeUndefined()
  })

  test("handles empty string", () => {
    const result = parseVariantFromModelID("")
    expect(result.modelID).toBe("")
  })
})