import { describe, expect, test } from "bun:test";
import { BackgroundManager } from "./index";

describe("BackgroundManager circuit breaker", () => {
  test("tracks circuit state without creating background tasks", () => {
    const manager = new BackgroundManager();
    manager.recordSessionToolCall("session-a", "read", { path: "/a" });
    expect(manager.getSessionProgress("session-a")?.toolCalls).toBe(1);
    expect("getTask" in manager).toBe(false);
  });

  test("aborts repeated calls through the native session client", async () => {
    const aborted: string[] = [];
    const manager = new BackgroundManager({
      circuit_breaker: { consecutive_threshold: 2 },
    });
    manager.setClient({
      session: {
        abort: async ({ path }: { path: { id: string } }) => {
          aborted.push(path.id);
        },
      },
    } as any);
    manager.recordSessionToolCall("session-a", "grep", { pattern: "x" });
    manager.recordSessionToolCall("session-a", "grep", { pattern: "x" });
    await Promise.resolve();
    expect(aborted).toEqual(["session-a"]);
    expect(manager.getSessionProgress("session-a")).toBeUndefined();
  });
});
