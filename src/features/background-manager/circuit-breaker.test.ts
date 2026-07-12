import { describe, expect, test } from "bun:test";
import { BackgroundManager } from "./index";

describe("BackgroundManager circuit breaker (session tracking)", () => {
  test("recordSessionToolCall auto-registers a task on first call", () => {
    const mgr = new BackgroundManager();
    const task = mgr.recordSessionToolCall("sess-1", "read", { path: "/a" });
    expect(task).toBeDefined();
    expect(task?.sessionID).toBe("sess-1");
    expect(task?.progress?.toolCalls).toBe(1);
    expect(mgr.getTaskForSession("sess-1")?.id).toBe(task?.id);
  });

  test("increments toolCalls on subsequent calls", () => {
    const mgr = new BackgroundManager();
    mgr.recordSessionToolCall("sess-1", "read", { path: "/a" });
    mgr.recordSessionToolCall("sess-1", "read", { path: "/b" });
    mgr.recordSessionToolCall("sess-1", "write", { path: "/c" });
    const task = mgr.getTaskForSession("sess-1");
    expect(task?.progress?.toolCalls).toBe(3);
  });

  test("trips on N consecutive identical calls and cancels the session", () => {
    const mgr = new BackgroundManager({
      circuit_breaker: { enabled: true, consecutive_threshold: 3 },
    });
    // No client set → cancel() will skip the abort() call but still mark cancelled.
    const first = mgr.recordSessionToolCall("sess-stuck", "grep", { pattern: "foo" });
    const taskId = first?.id;
    expect(taskId).toBeDefined();
    for (let i = 1; i < 3; i++) {
      mgr.recordSessionToolCall("sess-stuck", "grep", { pattern: "foo" });
    }
    const task = mgr.getTask(taskId!);
    // After 3 identical calls, the breaker cancels — session index cleared.
    expect(task?.status).toBe("cancelled");
    expect(task?.error).toContain("Circuit breaker");
    expect(mgr.getTaskForSession("sess-stuck")).toBeUndefined();
  });

  test("does not trip when calls vary", () => {
    const mgr = new BackgroundManager({
      circuit_breaker: { enabled: true, consecutive_threshold: 3 },
    });
    mgr.recordSessionToolCall("sess-var", "grep", { pattern: "a" });
    mgr.recordSessionToolCall("sess-var", "grep", { pattern: "b" });
    mgr.recordSessionToolCall("sess-var", "grep", { pattern: "c" });
    const task = mgr.getTaskForSession("sess-var");
    expect(task?.status).toBe("running");
    expect(task?.progress?.consecutiveCount ?? 0).toBeLessThan(3);
  });

  test("breaker disabled → no tracking", () => {
    const mgr = new BackgroundManager({
      circuit_breaker: { enabled: false },
    });
    const task = mgr.recordSessionToolCall("sess-off", "read");
    expect(task).toBeUndefined();
    expect(mgr.getTaskForSession("sess-off")).toBeUndefined();
  });

  test("total tool-call cap cancels the session", () => {
    const mgr = new BackgroundManager({
      circuit_breaker: { enabled: true, max_tool_calls: 5 },
    });
    const first = mgr.recordSessionToolCall("sess-cap", "read", { path: "/f0" });
    const taskId = first?.id;
    for (let i = 1; i < 5; i++) {
      mgr.recordSessionToolCall("sess-cap", "read", { path: `/f${i}` });
    }
    const task = mgr.getTask(taskId!);
    expect(task?.status).toBe("cancelled");
    expect(task?.error).toContain("total tool calls");
  });

  test("tracks multiple sessions independently", () => {
    const mgr = new BackgroundManager();
    mgr.recordSessionToolCall("sess-a", "read");
    mgr.recordSessionToolCall("sess-b", "read");
    mgr.recordSessionToolCall("sess-a", "read");
    const a = mgr.getTaskForSession("sess-a");
    const b = mgr.getTaskForSession("sess-b");
    expect(a?.progress?.toolCalls).toBe(2);
    expect(b?.progress?.toolCalls).toBe(1);
    expect(a?.id).not.toBe(b?.id);
  });
});
