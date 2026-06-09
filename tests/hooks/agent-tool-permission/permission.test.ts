/**
 * Tests for the agent-tool-permission hook.
 *
 * The hook is the security gate that prevents agents from using tools
 * they shouldn't (e.g., Bob using write/edit/bash). It is the runtime
 * enforcement for the canonical agent tool restrictions declared in
 * `src/shared/agent-tool-restrictions.ts`.
 *
 * `normalizeToolName` and `isToolDenied` are private helpers inside
 * `hook.ts` and are not exported. These tests cover them indirectly by
 * driving the public `createAgentToolPermissionHook` factory with
 * controlled agent+tool combinations and a mocked `getAgentFromSession`.
 *
 * Run with: bun test tests/hooks/agent-tool-permission/permission.test.ts
 */

import { describe, it, expect, mock, beforeAll } from "bun:test";

let resolvedAgent: string | undefined = "bob";

mock.module(
  "../../../src/hooks/strategist-md-only/agent-resolution",
  () => ({
    getAgentFromSession: mock(async () => resolvedAgent),
  }),
);

const hookMod = await import("../../../src/hooks/agent-tool-permission/hook");
const constantsMod = await import(
  "../../../src/hooks/agent-tool-permission/constants"
);
const createAgentToolPermissionHook = hookMod.createAgentToolPermissionHook;
const BLOCK_MESSAGE_PREFIX = constantsMod.BLOCK_MESSAGE_PREFIX;
const HOOK_NAME = constantsMod.HOOK_NAME;

const ctx = {
  directory: "/tmp/hiai-opencode-tests",
  client: undefined,
} as unknown as Parameters<typeof createAgentToolPermissionHook>[0];

function setResolvedAgent(name: string | undefined): void {
  resolvedAgent = name;
}

function makeHook() {
  const hooks = createAgentToolPermissionHook(ctx);
  return hooks["tool.execute.before"];
}

const baseInput = { tool: "write", sessionID: "ses_test", callID: "call_test" };
const baseOutput = { args: {} };

beforeAll(() => {
  expect(BLOCK_MESSAGE_PREFIX).toContain(HOOK_NAME);
  expect(BLOCK_MESSAGE_PREFIX).toContain("Runtime tool-level enforcement");
});

// ---------------------------------------------------------------------------
// normalizeToolName (2 cases)
// ---------------------------------------------------------------------------

describe("normalizeToolName (via hook)", () => {
  it("lowercases mixed-case tool names", async () => {
    setResolvedAgent("bob");
    const handler = makeHook();
    await expect(
      handler({ ...baseInput, tool: "WriTe" }, baseOutput),
    ).rejects.toThrow(BLOCK_MESSAGE_PREFIX);
  });

  it("trims surrounding whitespace before matching", async () => {
    setResolvedAgent("bob");
    const handler = makeHook();
    await expect(
      handler({ ...baseInput, tool: "  WRITE  " }, baseOutput),
    ).rejects.toThrow(BLOCK_MESSAGE_PREFIX);
  });
});

// ---------------------------------------------------------------------------
// isToolDenied (3 cases)
// ---------------------------------------------------------------------------

describe("isToolDenied (via hook)", () => {
  it("returns true (blocks) when a tool is explicitly denied", async () => {
    setResolvedAgent("bob");
    const handler = makeHook();
    await expect(
      handler({ ...baseInput, tool: "write" }, baseOutput),
    ).rejects.toThrow(BLOCK_MESSAGE_PREFIX);
  });

  it("returns false (allows) when a tool is not in the restrictions map", async () => {
    setResolvedAgent("bob");
    const handler = makeHook();
    await expect(
      handler(
        { ...baseInput, tool: "nonexistent_tool" },
        baseOutput,
      ),
    ).resolves.toBeUndefined();
  });

  it("returns false (allows) for tools not flagged as denied", async () => {
    setResolvedAgent("bob");
    const handler = makeHook();
    await expect(
      handler({ ...baseInput, tool: "read" }, baseOutput),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// createAgentToolPermissionHook (3 cases)
// ---------------------------------------------------------------------------

describe("createAgentToolPermissionHook", () => {
  it("blocks denied tools with the BLOCK_MESSAGE_PREFIX", async () => {
    setResolvedAgent("bob");
    const handler = makeHook();
    let caught: Error | undefined;
    try {
      await handler(
        { ...baseInput, tool: "bash" },
        baseOutput,
      );
    } catch (e) {
      caught = e as Error;
    }
    expect(caught).toBeDefined();
    expect(caught?.message).toContain(BLOCK_MESSAGE_PREFIX);
    expect(caught?.message).toContain('"bob"');
    expect(caught?.message).toContain('"bash"');
  });

  it("allows unrestricted agents through without modification", async () => {
    setResolvedAgent("coder");
    const handler = makeHook();
    await expect(
      handler({ ...baseInput, tool: "bash" }, baseOutput),
    ).resolves.toBeUndefined();
  });

  it("no-ops for sessions where the agent cannot be resolved", async () => {
    setResolvedAgent(undefined);
    const handler = makeHook();
    await expect(
      handler({ ...baseInput, tool: "bash" }, baseOutput),
    ).resolves.toBeUndefined();
  });
});
