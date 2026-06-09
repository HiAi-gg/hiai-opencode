import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { PluginInput } from "@opencode-ai/plugin";
import type { SkillMcpManager } from "../../../src/features/skill-mcp-manager";
import { createMemPalaceAutoSaveHandler } from "../../../src/hooks/mempalace-auto-save/handler";

interface CallRecord {
  serverName: string;
  skillName: string;
  sessionID: string;
  scope: string;
  config: unknown;
  toolName: string;
  args: Record<string, unknown>;
}

function createMockSkillMcpManager(opts: {
  throwOnCall?: boolean;
} = {}): {
  manager: SkillMcpManager;
  calls: CallRecord[];
} {
  const calls: CallRecord[] = [];

  const callTool = mock(async (...args: unknown[]) => {
    const [info, context, name, toolArgs] = args as [
      { serverName: string; skillName: string; sessionID: string; scope: string },
      { config: unknown; skillName: string },
      string,
      Record<string, unknown>,
    ];
    if (opts.throwOnCall) {
      throw new Error("mempalace call failed");
    }
    calls.push({
      serverName: info.serverName,
      skillName: info.skillName,
      sessionID: info.sessionID,
      scope: info.scope,
      config: context.config,
      toolName: name,
      args: toolArgs,
    });
    return { ok: true };
  });

  const manager = {
    callTool,
  } as unknown as SkillMcpManager;

  return { manager, calls };
}

function createMockCtx(todos: Array<{ id: string; content: string; status: string }> = []): PluginInput {
  return {
    client: {
      session: {
        todo: mock(async () => ({ todos })),
      },
    },
  } as unknown as PluginInput;
}

function makeEvent(type: string, sessionID: string, info: Record<string, unknown> = {}) {
  return {
    event: {
      type,
      properties: { sessionID, info: { id: sessionID, title: `title-${sessionID}`, ...info } },
    },
  };
}

describe("createMemPalaceAutoSaveHandler", () => {
  const realDateNow = Date.now;
  let currentTime: number;

  beforeEach(() => {
    currentTime = 1_700_000_000_000;
    Date.now = () => currentTime;
  });

  afterEach(() => {
    Date.now = realDateNow;
  });

  function advanceTime(ms: number) {
    currentTime += ms;
  }

  // Test 1: canSave returns true on first call
  test("canSave returns true on first call (lastSaveAt is undefined)", async () => {
    const { manager, calls } = createMockSkillMcpManager();
    const handler = createMemPalaceAutoSaveHandler({
      ctx: createMockCtx(),
      skillMcpManager: manager,
    });

    await handler(makeEvent("session.created", "ses-first"));

    expect(calls.length).toBe(1);
    expect(calls[0]?.toolName).toBe("mempalace_add_drawer");
  });

  // Test 2: canSave returns false within debounce window
  test("canSave returns false within debounce window (60s default)", async () => {
    const { manager, calls } = createMockSkillMcpManager();
    const handler = createMemPalaceAutoSaveHandler({
      ctx: createMockCtx(),
      skillMcpManager: manager,
    });

    await handler(makeEvent("session.created", "ses-debounce"));
    expect(calls.length).toBe(1);

    advanceTime(30_000);
    await handler(makeEvent("session.error", "ses-debounce"));

    expect(calls.length).toBe(1);
  });

  // Test 3: canSave returns true after debounce window
  test("canSave returns true after debounce window elapses", async () => {
    const { manager, calls } = createMockSkillMcpManager();
    const handler = createMemPalaceAutoSaveHandler({
      ctx: createMockCtx(),
      skillMcpManager: manager,
    });

    await handler(makeEvent("session.created", "ses-window"));
    expect(calls.length).toBe(1);

    advanceTime(61_000);
    await handler(makeEvent("session.error", "ses-window"));

    expect(calls.length).toBe(2);
  });

  // Test 4: saveToMemPalace calls skillMcpManager with the correct pattern
  test("saveToMemPalace invokes skillMcpManager.callTool with mempalace_add_drawer", async () => {
    const { manager, calls } = createMockSkillMcpManager();
    const ctx = createMockCtx();
    const handler = createMemPalaceAutoSaveHandler({
      ctx,
      skillMcpManager: manager,
    });

    await handler(makeEvent("session.created", "ses-save-pattern"));

    expect(calls.length).toBe(1);
    const call = calls[0]!;
    expect(call.serverName).toBe("mempalace");
    expect(call.skillName).toBe("hiai-opencode");
    expect(call.scope).toBe("user");
    expect(call.toolName).toBe("mempalace_add_drawer");
    expect(call.args.wing).toBe("hiai-opencode");
    expect(call.args.room).toBe("plans");
    expect(typeof call.args.content).toBe("string");
    expect(call.args.added_by).toBe("strategist");
  });

  // Test 5: Handler processes different event types correctly
  test("handler routes different event types to the correct MemPalace room", async () => {
    const { manager, calls } = createMockSkillMcpManager();
    const ctx = createMockCtx([
      { id: "t1", content: "design the landing page", status: "completed" },
      { id: "t2", content: "review the implementation", status: "completed" },
      { id: "t3", content: "plan the release", status: "completed" },
    ]);
    const handler = createMemPalaceAutoSaveHandler({
      ctx,
      skillMcpManager: manager,
    });

    await handler(makeEvent("session.created", "ses-routing"));
    expect(calls[0]?.args.room).toBe("plans");
    expect(calls[0]?.args.added_by).toBe("strategist");

    advanceTime(61_000);
    await handler(makeEvent("session.idle", "ses-routing"));
    const idleCalls = calls.slice(1);
    const rooms = idleCalls.map((c) => c.args.room).sort();
    expect(rooms).toEqual(["designs", "plans", "reviews"]);
    const agents = idleCalls.map((c) => c.args.added_by).sort();
    expect(agents).toEqual(["critic", "designer", "strategist"]);

    advanceTime(61_000);
    await handler(makeEvent("session.deleted", "ses-routing"));
    const deletedCall = calls[calls.length - 1]!;
    expect(deletedCall.args.room).toBe("sessions");
    expect(deletedCall.args.added_by).toBe("system");

    advanceTime(61_000);
    await handler(makeEvent("session.compacted", "ses-routing"));
    const lastTwo = calls.slice(-2);
    const compactRooms = lastTwo.map((c) => c.args.room).sort();
    expect(compactRooms).toEqual(["designs", "reviews"]);
    const compactAgents = lastTwo.map((c) => c.args.added_by).sort();
    expect(compactAgents).toEqual(["critic", "designer"]);

    advanceTime(61_000);
    await handler({
      event: {
        type: "session.error",
        properties: {
          sessionID: "ses-routing",
          error: { name: "TestError", message: "boom" },
        },
      },
    });
    const errorCall = calls[calls.length - 1]!;
    expect(errorCall.args.room).toBe("errors");
    expect(errorCall.args.added_by).toBe("system");
  });

  // Test 6: Session state is isolated per sessionID
  test("session state is isolated per sessionID (separate debounce, separate todos)", async () => {
    const { manager, calls } = createMockSkillMcpManager();
    const ctx = createMockCtx([
      { id: "tx", content: "build feature", status: "completed" },
    ]);
    const handler = createMemPalaceAutoSaveHandler({
      ctx,
      skillMcpManager: manager,
    });

    await handler(makeEvent("session.created", "ses-A"));
    expect(calls.length).toBe(1);

    await handler(makeEvent("session.created", "ses-B"));
    expect(calls.length).toBe(2);
    expect(calls[0]?.args.content).toContain("ses-A");
    expect(calls[1]?.args.content).toContain("ses-B");

    advanceTime(10_000);
    await handler(makeEvent("session.error", "ses-A"));
    expect(calls.length).toBe(2);

    await handler(makeEvent("session.error", "ses-B"));
    expect(calls.length).toBe(2);

    advanceTime(61_000);
    await handler(makeEvent("session.error", "ses-A"));
    await handler(makeEvent("session.error", "ses-B"));
    expect(calls.length).toBe(4);
  });
});
