import { expect, test } from "bun:test"
import {
  resolveCanonicalDelegateAgentKey,
  isCanonicalDelegateAgentKey,
  CANONICAL_DELEGATE_AGENT_KEYS,
  SUB_AGENT_CONFIG_KEY,
  CODER_AGENT_CONFIG_KEY,
  CRITIC_AGENT_CONFIG_KEY,
} from "./sub-agent"

test("canonical keys include the 12 expected agents", () => {
  // Note: quality-guardian is registered as an agent but is not a canonical
  // delegate target (callers reach it via task() with subagent_type, but it's
  // not in the legacy alias map either — by design, post-impl review is gated
  // through Critic for plan-time and Quality Guardian for runtime separately).
  for (const key of [
    "bob",
    "coder",
    "sub",
    "strategist",
    "critic",
    "researcher",
    "multimodal",
    "designer",
    "brainstormer",
    "platform-manager",
    "guard",
    "agent-skills",
  ]) {
    expect(CANONICAL_DELEGATE_AGENT_KEYS as readonly string[]).toContain(key)
  }
})

test("config key constants match canonical names", () => {
  expect(SUB_AGENT_CONFIG_KEY).toBe("sub")
  expect(CODER_AGENT_CONFIG_KEY).toBe("coder")
  expect(CRITIC_AGENT_CONFIG_KEY).toBe("critic")
})

test("legacy omo aliases resolve to canonical agents", () => {
  expect(resolveCanonicalDelegateAgentKey("oracle")).toBe("strategist")
  expect(resolveCanonicalDelegateAgentKey("hephaestus")).toBe("coder")
  expect(resolveCanonicalDelegateAgentKey("metis")).toBe("strategist")
  expect(resolveCanonicalDelegateAgentKey("momus")).toBe("critic")
  expect(resolveCanonicalDelegateAgentKey("sisyphus-junior")).toBe("sub")
  expect(resolveCanonicalDelegateAgentKey("multimodal-looker")).toBe("multimodal")
})

test("legacy descriptive aliases resolve to canonical agents", () => {
  expect(resolveCanonicalDelegateAgentKey("librarian")).toBe("researcher")
  expect(resolveCanonicalDelegateAgentKey("explore")).toBe("researcher")
  expect(resolveCanonicalDelegateAgentKey("logician")).toBe("strategist")
  expect(resolveCanonicalDelegateAgentKey("plan")).toBe("strategist")
  expect(resolveCanonicalDelegateAgentKey("code-reviewer")).toBe("critic")
  expect(resolveCanonicalDelegateAgentKey("writer")).toBe("brainstormer")
  expect(resolveCanonicalDelegateAgentKey("copywriter")).toBe("brainstormer")
  expect(resolveCanonicalDelegateAgentKey("subagent")).toBe("sub")
  expect(resolveCanonicalDelegateAgentKey("bob-junior")).toBe("sub")
})

test("canonical names pass through unchanged", () => {
  for (const key of CANONICAL_DELEGATE_AGENT_KEYS) {
    expect(resolveCanonicalDelegateAgentKey(key)).toBe(key)
  }
})

test("unknown names pass through (will be rejected later in resolution chain)", () => {
  expect(resolveCanonicalDelegateAgentKey("totally-made-up")).toBe("totally-made-up")
})

test("name normalization handles whitespace and case", () => {
  expect(resolveCanonicalDelegateAgentKey("  Researcher  ")).toBe("researcher")
  expect(resolveCanonicalDelegateAgentKey("ORACLE")).toBe("strategist")
})

test("isCanonicalDelegateAgentKey accepts canonical and resolves aliases", () => {
  expect(isCanonicalDelegateAgentKey("coder")).toBe(true)
  expect(isCanonicalDelegateAgentKey("oracle")).toBe(true)
  expect(isCanonicalDelegateAgentKey("totally-made-up")).toBe(false)
})
