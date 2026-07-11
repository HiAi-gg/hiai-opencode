/**
 * dream-distill/index.test.ts — Tests for the dream/distill auto-consolidation hook.
 *
 * Verifies event filtering, timing logic, session creation, and error handling.
 */

import { beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BobConfig } from "../../types";
import { createDreamDistillHook } from "./index";

let promptsDir = "";

function makeConfig(overrides?: Partial<BobConfig>): BobConfig {
  return {
    dream: { auto: true, interval_days: 0 }, // 0 means always trigger
    distill: { auto: true, interval_days: 0 },
    ...overrides,
  } as BobConfig;
}

function makeClient() {
  let sessionIdCounter = 0;
  return {
    session: {
      create: async (_input: any) => {
        sessionIdCounter++;
        return { data: { id: `auto-session-${sessionIdCounter}` } };
      },
      prompt: async (_input: any) => {},
    },
  };
}

describe("dream-distill", () => {
  beforeEach(() => {
    promptsDir = join(tmpdir(), `hiai-test-dream-${Date.now()}`);
    mkdirSync(promptsDir, { recursive: true });
    writeFileSync(join(promptsDir, "dream.txt"), "Dream prompt content");
    writeFileSync(join(promptsDir, "distill.txt"), "Distill prompt content");
  });

  test("returns an event hook", () => {
    const hook = createDreamDistillHook(
      makeConfig(),
      makeClient() as any,
      promptsDir,
    );
    expect(typeof hook.event).toBe("function");
  });

  test("ignores events other than session.idle / session.created", async () => {
    const hook = createDreamDistillHook(
      makeConfig(),
      makeClient() as any,
      promptsDir,
    ) as any;
    const fn = hook.event as (input: { event: any }) => Promise<void>;

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    try {
      await fn({ event: { type: "session.error" } });
      expect(logs).toHaveLength(0);
    } finally {
      console.log = origLog;
    }
  });

  test("triggers dream and distill on session.idle", async () => {
    const client = makeClient();
    const hook = createDreamDistillHook(
      makeConfig(),
      client as any,
      promptsDir,
    ) as any;
    const fn = hook.event as (input: { event: any }) => Promise<void>;

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    try {
      await fn({ event: { type: "session.idle" } });
      expect(logs.some((l) => l.includes("Auto-dream"))).toBe(true);
      expect(logs.some((l) => l.includes("Auto-distill"))).toBe(true);
    } finally {
      console.log = origLog;
    }
  });

  test("triggers dream and distill on session.created", async () => {
    const client = makeClient();
    const hook = createDreamDistillHook(
      makeConfig(),
      client as any,
      promptsDir,
    ) as any;
    const fn = hook.event as (input: { event: any }) => Promise<void>;

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    try {
      await fn({ event: { type: "session.created" } });
      expect(logs.some((l) => l.includes("Auto-dream"))).toBe(true);
      expect(logs.some((l) => l.includes("Auto-distill"))).toBe(true);
    } finally {
      console.log = origLog;
    }
  });

  test("skips when auto is disabled", async () => {
    const config = makeConfig({
      dream: { auto: false },
      distill: { auto: false },
    });
    const hook = createDreamDistillHook(
      config,
      makeClient() as any,
      promptsDir,
    ) as any;
    const fn = hook.event as (input: { event: any }) => Promise<void>;

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    try {
      await fn({ event: { type: "session.idle" } });
      expect(logs).toHaveLength(0);
    } finally {
      console.log = origLog;
    }
  });

  test("handles session.create failure gracefully", async () => {
    const failingClient = {
      session: {
        create: async () => ({ data: null }),
        prompt: async () => {},
      },
    };
    const hook = createDreamDistillHook(
      makeConfig(),
      failingClient as any,
      promptsDir,
    ) as any;
    const fn = hook.event as (input: { event: any }) => Promise<void>;

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);
    const origErr = console.error;
    console.error = (msg: string) => logs.push(msg);

    try {
      await fn({ event: { type: "session.idle" } });
      expect(logs.some((l) => l.includes("failed"))).toBe(true);
    } finally {
      console.log = origLog;
      console.error = origErr;
    }
  });

  test("handles prompt creation failure gracefully", async () => {
    const client = makeClient();
    const hook = createDreamDistillHook(
      makeConfig(),
      client as any,
      "/nonexistent/dir",
    ) as any;
    const fn = hook.event as (input: { event: any }) => Promise<void>;

    // Should not throw — errors are caught and logged
    await expect(
      fn({ event: { type: "session.created" } }),
    ).resolves.toBeUndefined();
  });
});
