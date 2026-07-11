import { describe, expect, test } from "bun:test";
import type { BobConfig } from "../types";
import { createManagerGuard } from "./manager-guard";

const config = {} as BobConfig;

describe("manager-guard", () => {
  test("returns a hook set with event defined", () => {
    const hook = createManagerGuard(config);
    expect(typeof hook.event).toBe("function");
  });

  test("ignores non-session.idle events", async () => {
    const hook = createManagerGuard(config) as any;
    const fn = hook.event as (input: { event: unknown }) => Promise<void>;
    await expect(
      fn({ event: { type: "session.created" } }),
    ).resolves.toBeUndefined();
  });

  test("logs when subagent is idle", async () => {
    const hook = createManagerGuard(config) as any;
    const fn = hook.event as (input: { event: unknown }) => Promise<void>;

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    try {
      await fn({
        event: {
          type: "session.idle",
          properties: { sessionID: "s1", agent: "coder" },
        },
      });
      expect(logs.some((l) => l.includes("Manager guard"))).toBe(true);
      expect(logs.some((l) => l.includes("coder"))).toBe(true);
    } finally {
      console.log = origLog;
    }
  });

  test("does not log when bob is idle", async () => {
    const hook = createManagerGuard(config) as any;
    const fn = hook.event as (input: { event: unknown }) => Promise<void>;

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    try {
      await fn({
        event: {
          type: "session.idle",
          properties: { sessionID: "s1", agent: "bob" },
        },
      });
      expect(logs.some((l) => l.includes("Manager guard"))).toBe(false);
    } finally {
      console.log = origLog;
    }
  });

  test("handles missing sessionID in idle event", async () => {
    const hook = createManagerGuard(config) as any;
    const fn = hook.event as (input: { event: unknown }) => Promise<void>;

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    try {
      await fn({
        event: {
          type: "session.idle",
          properties: { agent: "coder" },
        },
      });
      // Missing sessionID means sid will be 'undefined' — the log line may still fire
      // but should not throw
      await expect(Promise.resolve()).resolves.toBeUndefined();
    } finally {
      console.log = origLog;
    }
  });
});
