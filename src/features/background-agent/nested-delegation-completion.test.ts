import { expect, test, describe, beforeEach, afterEach } from "bun:test";
import { BackgroundManager } from "./manager";

// A delegating sub-agent (e.g. Manager) that itself launches background child
// tasks must not be torn down while those children are still running — otherwise
// it can never receive/"catch" their completion notifications. Bob (the root
// session) is never wrapped in a background task, so only nested delegators hit
// this. The guard lives in tryCompleteTask, the single completion chokepoint.
describe("nested delegation: defer parent completion while descendants run", () => {
  let manager: BackgroundManager;
  let mockClient: { session: Record<string, (arg?: unknown) => unknown> };
  let aborted: string[];

  beforeEach(() => {
    aborted = [];
    mockClient = {
      session: {
        create: async () => ({ id: "s" }),
        get: async ({ path }: { path: { id: string } }) => ({
          data: { id: path.id },
        }),
        prompt: async () => ({ messages: [] }),
        status: async () => ({}),
        todo: async () => [],
        abort: async ({ path }: { path: { id: string } }) => {
          aborted.push(path.id);
        },
        messages: async () => ({ data: [] }),
      },
    } as never;

    manager = new BackgroundManager(
      { client: mockClient, directory: "/test/dir" } as never,
      undefined,
      { enableParentSessionNotifications: false },
    );
  });

  afterEach(() => manager.shutdown());

  const makeTask = (over: Record<string, unknown>) => ({
    status: "running",
    agent: "coder",
    description: "t",
    startedAt: new Date(),
    ...over,
  });

  test("defers and keeps the parent alive while a child is running", async () => {
    const state = (manager as unknown as { state: { tasks: Map<string, unknown> } }).state;
    const parent = makeTask({
      id: "parent-task",
      sessionID: "manager-session",
      parentSessionID: "bob-session",
      agent: "manager",
    });
    const child = makeTask({
      id: "child-task",
      sessionID: "child-session",
      parentSessionID: "manager-session",
    });
    state.tasks.set("parent-task", parent);
    state.tasks.set("child-task", child);

    const result = await (
      manager as unknown as {
        tryCompleteTask: (t: unknown, s: string) => Promise<boolean>;
      }
    ).tryCompleteTask(parent, "test");

    expect(result).toBe(false);
    expect((parent as { status: string }).status).toBe("running");
    expect(aborted).not.toContain("manager-session");
  });

  test("completes normally once no descendants remain", async () => {
    const state = (manager as unknown as { state: { tasks: Map<string, unknown> } }).state;
    const parent = makeTask({
      id: "parent-task",
      sessionID: "manager-session",
      parentSessionID: "bob-session",
      agent: "manager",
    });
    state.tasks.set("parent-task", parent);

    const result = await (
      manager as unknown as {
        tryCompleteTask: (t: unknown, s: string) => Promise<boolean>;
      }
    ).tryCompleteTask(parent, "test");

    expect(result).toBe(true);
    expect((parent as { status: string }).status).toBe("completed");
  });
});
