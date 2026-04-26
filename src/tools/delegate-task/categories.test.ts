import { expect, test } from "bun:test"
import { resolveCategoryConfig } from "./categories"

test("resolveCategoryConfig returns null for unknown category with no config", () => {
  const result = resolveCategoryConfig("nonexistent-category", {
    userCategories: {},
    availableModels: new Set(["openrouter/minimax/minimax-m2.7"]),
  })
  expect(result).toBeNull()
})

test("resolveCategoryConfig returns null when category is disabled", () => {
  const result = resolveCategoryConfig("quick", {
    userCategories: { quick: { disable: true } },
  })
  expect(result).toBeNull()
})

test("resolveCategoryConfig merges default config with user config", () => {
  const result = resolveCategoryConfig("quick", {
    userCategories: { quick: { temperature: 0.9 } },
    availableModels: new Set(["openrouter/minimax/minimax-m2.7"]),
  })
  expect(result).not.toBeNull()
  expect(result!.config.temperature).toBe(0.9)
})

test("resolveCategoryConfig user model takes precedence over default", () => {
  const result = resolveCategoryConfig("quick", {
    userCategories: { quick: { model: "openrouter/deepseek/deepseek-v4-flash" } },
    availableModels: new Set(["openrouter/deepseek/deepseek-v4-flash"]),
  })
  expect(result).not.toBeNull()
  expect(result!.model).toBe("openrouter/deepseek/deepseek-v4-flash")
})

test("resolveCategoryConfig returns promptAppend for category", () => {
  const result = resolveCategoryConfig("deep", {
    userCategories: {},
    availableModels: new Set(["openrouter/minimax/minimax-m2.7"]),
  })
  expect(result).not.toBeNull()
  expect(result!.promptAppend).toBeDefined()
})

test("resolveCategoryConfig isUserConfiguredModel true when user provides model", () => {
  const result = resolveCategoryConfig("quick", {
    userCategories: { quick: { model: "openrouter/deepseek/deepseek-v4-flash" } },
    availableModels: new Set(["openrouter/deepseek/deepseek-v4-flash"]),
  })
  expect(result).not.toBeNull()
  expect(result!.isUserConfiguredModel).toBe(true)
})

test("resolveCategoryConfig isUserConfiguredModel false when no user model", () => {
  const result = resolveCategoryConfig("quick", {
    userCategories: { quick: {} },
    availableModels: new Set(["openrouter/minimax/minimax-m2.7"]),
  })
  expect(result).not.toBeNull()
  expect(result!.isUserConfiguredModel).toBe(false)
})

test("resolveCategoryConfig concatenates prompt_append with default", () => {
  const result = resolveCategoryConfig("quick", {
    userCategories: { quick: { prompt_append: "Extra instructions" } },
    availableModels: new Set(["openrouter/minimax/minimax-m2.7"]),
  })
  expect(result).not.toBeNull()
  expect(result!.promptAppend).toContain("Extra instructions")
})

test("resolveCategoryConfig returns null when category not in defaults or user config", () => {
  const result = resolveCategoryConfig("nonexistent", {
    userCategories: {},
  })
  expect(result).toBeNull()
})

test("resolveCategoryConfig applies user variant over default variant", () => {
  const result = resolveCategoryConfig("deep", {
    userCategories: { deep: { variant: "high" } },
    availableModels: new Set(["openrouter/minimax/minimax-m2.7"]),
  })
  expect(result).not.toBeNull()
  expect(result!.config.variant).toBe("high")
})