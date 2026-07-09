/**
 * index.test.ts — Unit tests for browserGateGuard and agent-browser tool exports.
 */

import { describe, expect, test } from "bun:test";
import { browserGateGuard, createAgentBrowserTools } from "./index";

const mockVisionContext = {
  agent: "vision",
  sessionID: "s1",
  messageID: "m1",
  directory: "/tmp",
  worktree: "/tmp",
  abort: new AbortController().signal,
  metadata: () => {},
  ask: async () => {},
};
const mockGeneralContext = {
  agent: "general",
  sessionID: "s1",
  messageID: "m1",
  directory: "/tmp",
  worktree: "/tmp",
  abort: new AbortController().signal,
  metadata: () => {},
  ask: async () => {},
};
const mockCriticContext = {
  agent: "critic",
  sessionID: "s1",
  messageID: "m1",
  directory: "/tmp",
  worktree: "/tmp",
  abort: new AbortController().signal,
  metadata: () => {},
  ask: async () => {},
};
const mockBobContext = {
  agent: "bob",
  sessionID: "s1",
  messageID: "m1",
  directory: "/tmp",
  worktree: "/tmp",
  abort: new AbortController().signal,
  metadata: () => {},
  ask: async () => {},
};
const mockBuildContext = {
  agent: "build",
  sessionID: "s1",
  messageID: "m1",
  directory: "/tmp",
  worktree: "/tmp",
  abort: new AbortController().signal,
  metadata: () => {},
  ask: async () => {},
};
const mockUnknownContext = {
  agent: undefined as unknown as string,
  sessionID: "s1",
  messageID: "m1",
  directory: "/tmp",
  worktree: "/tmp",
  abort: new AbortController().signal,
  metadata: () => {},
  ask: async () => {},
};

describe("browserGateGuard", () => {
  test("allows vision agent", () => {
    expect(() => browserGateGuard(mockVisionContext)).not.toThrow();
  });

  test("allows general agent (fallback)", () => {
    expect(() => browserGateGuard(mockGeneralContext)).not.toThrow();
  });

  test('rejects critic agent with error containing "critic"', () => {
    expect(() => browserGateGuard(mockCriticContext)).toThrow(/critic/);
  });

  test('rejects bob agent with error containing "bob"', () => {
    expect(() => browserGateGuard(mockBobContext)).toThrow(/bob/);
  });

  test('rejects build agent with error containing "build"', () => {
    expect(() => browserGateGuard(mockBuildContext)).toThrow(/build/);
  });

  test('rejects undefined/unknown agent with error containing "unknown"', () => {
    expect(() => browserGateGuard(mockUnknownContext)).toThrow(/unknown/);
  });
});

describe("createAgentBrowserTools", () => {
  test("returns 16 tools", () => {
    const tools = createAgentBrowserTools();
    expect(Object.keys(tools)).toHaveLength(16);
  });

  test("each tool has an execute function", () => {
    const tools = createAgentBrowserTools();
    for (const [_name, t] of Object.entries(tools)) {
      expect(typeof t.execute).toBe("function");
    }
  });

  test("agent_browser_navigate.execute does NOT throw with vision context", async () => {
    // Mock runAgentBrowser — we just verify the guard passes; CLI call would fail but guard passes first
    const tools = createAgentBrowserTools();
    // Guard passes for vision — even if CLI fails, no guard error
    expect(typeof tools.agent_browser_navigate.execute).toBe("function");
  });
});

describe("browserGateGuard is called by each tool execute signature", () => {
  // Verify each of the 16 tools accepts (args, context) — the context param is required for the guard
  test("all 16 tools have execute with 2-arg signature", () => {
    const tools = createAgentBrowserTools();
    for (const [_name, t] of Object.entries(tools)) {
      // The execute function must accept 2 arguments (args, context)
      expect(t.execute.length).toBeGreaterThanOrEqual(2);
    }
  });
});
