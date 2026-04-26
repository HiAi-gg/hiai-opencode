import { expect, test } from "bun:test"
import { normalizeMode, resolveModeAgent, MODE_TO_AGENT, MODE_NAMES } from "./mode-routing"

test("normalizeMode returns legacy aliases mapped to new names", () => {
  expect(normalizeMode("unspecified-low")).toBe("bounded")
  expect(normalizeMode("unspecified-high")).toBe("cross-module")
})

test("normalizeMode returns same name when not a legacy alias", () => {
  expect(normalizeMode("quick")).toBe("quick")
  expect(normalizeMode("deep")).toBe("deep")
  expect(normalizeMode("writing")).toBe("writing")
})

test("resolveModeAgent maps quick to sub", () => {
  expect(resolveModeAgent("quick")).toBe("sub")
})

test("resolveModeAgent maps writing to brainstormer", () => {
  expect(resolveModeAgent("writing")).toBe("brainstormer")
})

test("resolveModeAgent maps deep to coder", () => {
  expect(resolveModeAgent("deep")).toBe("coder")
})

test("resolveModeAgent maps ultrabrain to strategist", () => {
  expect(resolveModeAgent("ultrabrain")).toBe("strategist")
})

test("resolveModeAgent maps visual-engineering to designer", () => {
  expect(resolveModeAgent("visual-engineering")).toBe("designer")
})

test("resolveModeAgent maps artistry to designer", () => {
  expect(resolveModeAgent("artistry")).toBe("designer")
})

test("resolveModeAgent maps git to platform-manager", () => {
  expect(resolveModeAgent("git")).toBe("platform-manager")
})

test("resolveModeAgent maps git-ops to platform-manager", () => {
  expect(resolveModeAgent("git-ops")).toBe("platform-manager")
})

test("resolveModeAgent maps bounded to sub", () => {
  expect(resolveModeAgent("bounded")).toBe("sub")
})

test("resolveModeAgent maps cross-module to coder", () => {
  expect(resolveModeAgent("cross-module")).toBe("coder")
})

test("resolveModeAgent falls back to coder for unknown mode", () => {
  expect(resolveModeAgent("unknown-mode")).toBe("coder")
})

test("resolveModeAgent handles legacy aliases", () => {
  expect(resolveModeAgent("unspecified-low")).toBe("sub")
  expect(resolveModeAgent("unspecified-high")).toBe("coder")
})

test("MODE_NAMES contains all mode names", () => {
  expect(MODE_NAMES).toContain("quick")
  expect(MODE_NAMES).toContain("writing")
  expect(MODE_NAMES).toContain("deep")
  expect(MODE_NAMES).toContain("ultrabrain")
  expect(MODE_NAMES).toContain("visual-engineering")
  expect(MODE_NAMES).toContain("artistry")
  expect(MODE_NAMES).toContain("git")
  expect(MODE_NAMES).toContain("git-ops")
  expect(MODE_NAMES).toContain("bounded")
  expect(MODE_NAMES).toContain("cross-module")
})

test("MODE_TO_AGENT has correct mapping", () => {
  expect(MODE_TO_AGENT.quick).toBe("sub")
  expect(MODE_TO_AGENT.writing).toBe("brainstormer")
  expect(MODE_TO_AGENT.deep).toBe("coder")
  expect(MODE_TO_AGENT.ultrabrain).toBe("strategist")
  expect(MODE_TO_AGENT["visual-engineering"]).toBe("designer")
  expect(MODE_TO_AGENT.artistry).toBe("designer")
  expect(MODE_TO_AGENT.git).toBe("platform-manager")
  expect(MODE_TO_AGENT["git-ops"]).toBe("platform-manager")
  expect(MODE_TO_AGENT.bounded).toBe("sub")
  expect(MODE_TO_AGENT["cross-module"]).toBe("coder")
})