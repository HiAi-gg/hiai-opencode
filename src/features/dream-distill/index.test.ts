/**
 * dream-distill/index.test.ts — Tests for the dream/distill auto-consolidation hook.
 *
 * Verifies event filtering, timing logic, session creation, error handling,
 * and bundled prompt constants.
 */

import { describe, expect, test } from "bun:test";
import type { BobConfig } from "../../types";
import { createDreamDistillHook } from "./index";
import { DREAM_PROMPT } from "./dream";
import { DISTILL_PROMPT } from "./distill";
import { logger } from "../../util/log";

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
  describe("bundled prompts", () => {
    test("DREAM_PROMPT is a non-empty string", () => {
      expect(typeof DREAM_PROMPT).toBe("string");
      expect(DREAM_PROMPT.length).toBeGreaterThan(500);
      expect(DREAM_PROMPT).toContain("Dream: Memory Consolidation");
    });

    test("DISTILL_PROMPT is a non-empty string", () => {
      expect(typeof DISTILL_PROMPT).toBe("string");
      expect(DISTILL_PROMPT.length).toBeGreaterThan(500);
      expect(DISTILL_PROMPT).toContain("Distill: Workflow Packaging");
    });

    test("hook works without filesystem dependency", () => {
      const hook = createDreamDistillHook(makeConfig(), makeClient() as any);
      expect(typeof hook.event).toBe("function");
    });

    test("does not throw when promptsDir is absent", async () => {
      const client = makeClient();
      const hook = createDreamDistillHook(makeConfig(), client as any) as any;
      const fn = hook.event as (input: { event: any }) => Promise<void>;

      await expect(
        fn({ event: { type: "session.created" } }),
      ).resolves.toBeUndefined();
    });
  });

  test("returns an event hook", () => {
    const hook = createDreamDistillHook(makeConfig(), makeClient() as any);
    expect(typeof hook.event).toBe("function");
  });

  test("ignores events other than session.idle / session.created", async () => {
    const hook = createDreamDistillHook(
      makeConfig(),
      makeClient() as any,
    ) as any;
    const fn = hook.event as (input: { event: any }) => Promise<void>;

    const logs: string[] = [];
    const origLog = console.log;
    logger.log = (msg: string) => logs.push(msg);

    try {
      await fn({ event: { type: "session.error" } });
      expect(logs).toHaveLength(0);
    } finally {
      logger.log = origLog;
    }
  });

  test("triggers dream and distill on session.idle", async () => {
    const client = makeClient();
    const hook = createDreamDistillHook(makeConfig(), client as any) as any;
    const fn = hook.event as (input: { event: any }) => Promise<void>;

    const logs: string[] = [];
    const origLog = console.log;
    logger.log = (msg: string) => logs.push(msg);

    try {
      await fn({ event: { type: "session.idle" } });
      expect(logs.some((l) => l.includes("Auto-dream"))).toBe(true);
      expect(logs.some((l) => l.includes("Auto-distill"))).toBe(true);
    } finally {
      logger.log = origLog;
    }
  });

  test("triggers dream and distill on session.created", async () => {
    const client = makeClient();
    const hook = createDreamDistillHook(makeConfig(), client as any) as any;
    const fn = hook.event as (input: { event: any }) => Promise<void>;

    const logs: string[] = [];
    const origLog = console.log;
    logger.log = (msg: string) => logs.push(msg);

    try {
      await fn({ event: { type: "session.created" } });
      expect(logs.some((l) => l.includes("Auto-dream"))).toBe(true);
      expect(logs.some((l) => l.includes("Auto-distill"))).toBe(true);
    } finally {
      logger.log = origLog;
    }
  });

  test("skips when auto is disabled", async () => {
    const config = makeConfig({
      dream: { auto: false },
      distill: { auto: false },
    });
    const hook = createDreamDistillHook(config, makeClient() as any) as any;
    const fn = hook.event as (input: { event: any }) => Promise<void>;

    const logs: string[] = [];
    const origLog = console.log;
    logger.log = (msg: string) => logs.push(msg);

    try {
      await fn({ event: { type: "session.idle" } });
      expect(logs).toHaveLength(0);
    } finally {
      logger.log = origLog;
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
    ) as any;
    const fn = hook.event as (input: { event: any }) => Promise<void>;

    const logs: string[] = [];
    const origLog = console.log;
    logger.log = (msg: string) => logs.push(msg);
    const origErr = console.error;
    logger.error = (msg: string) => logs.push(msg);

    try {
      await fn({ event: { type: "session.idle" } });
      expect(logs.some((l) => l.includes("failed"))).toBe(true);
    } finally {
      logger.log = origLog;
      logger.error = origErr;
    }
  });

  test("respects interval-days: initial call creates session", async () => {
    // interval_days: 0 means "always trigger". Verify it works.
    let createCount = 0;
    const client = {
      session: {
        create: async () => {
          createCount++;
          return { data: { id: `sess-${createCount}` } };
        },
        prompt: async () => {},
      },
    };
    const config = makeConfig({
      dream: { auto: true, interval_days: 0 },
      distill: { auto: false },
    });
    const hook = createDreamDistillHook(config, client as any) as any;
    const fn = hook.event as (input: { event: any }) => Promise<void>;

    await fn({ event: { type: "session.idle" } });
    expect(createCount).toBe(1);
  });

  describe("anti-replay / rate-limit guard (burst session.idle)", () => {
    test("bursty session.idle triggers dream only once per cooldown", async () => {
      let createCount = 0;
      const client = {
        session: {
          create: async () => {
            createCount++;
            return { data: { id: `sess-${createCount}` } };
          },
          prompt: async () => {},
        },
      };
      const config = makeConfig({
        dream: { auto: true, interval_days: 0, burst_cooldown_ms: 60_000 },
        distill: { auto: false },
      });
      const hook = createDreamDistillHook(config, client as any) as any;
      const fn = hook.event as (input: { event: any }) => Promise<void>;

      // Simulate a burst of idle pings.
      for (let i = 0; i < 5; i++) {
        await fn({ event: { type: "session.idle" } });
      }
      // Only the first idle in the burst should have spawned a session.
      expect(createCount).toBe(1);
    });

    test("bursty session.created triggers dream only once per cooldown", async () => {
      let createCount = 0;
      const client = {
        session: {
          create: async () => {
            createCount++;
            return { data: { id: `sess-${createCount}` } };
          },
          prompt: async () => {},
        },
      };
      const config = makeConfig({
        dream: { auto: true, interval_days: 0, burst_cooldown_ms: 60_000 },
        distill: { auto: false },
      });
      const hook = createDreamDistillHook(config, client as any) as any;
      const fn = hook.event as (input: { event: any }) => Promise<void>;

      for (let i = 0; i < 4; i++) {
        await fn({ event: { type: "session.created" } });
      }
      expect(createCount).toBe(1);
    });

    test("session.idle and session.created are guarded independently", async () => {
      let createCount = 0;
      const client = {
        session: {
          create: async () => {
            createCount++;
            return { data: { id: `sess-${createCount}` } };
          },
          prompt: async () => {},
        },
      };
      const config = makeConfig({
        dream: { auto: true, interval_days: 0, burst_cooldown_ms: 60_000 },
        distill: { auto: false },
      });
      const hook = createDreamDistillHook(config, client as any) as any;
      const fn = hook.event as (input: { event: any }) => Promise<void>;

      // One idle burst + one created burst → each trigger type fires once.
      await fn({ event: { type: "session.idle" } });
      await fn({ event: { type: "session.idle" } });
      await fn({ event: { type: "session.created" } });
      await fn({ event: { type: "session.created" } });
      expect(createCount).toBe(2);
    });

    test("idempotent: repeated identical idle events do not duplicate sessions", async () => {
      let createCount = 0;
      const client = {
        session: {
          create: async () => {
            createCount++;
            return { data: { id: `sess-${createCount}` } };
          },
          prompt: async () => {},
        },
      };
      const config = makeConfig({
        dream: { auto: true, interval_days: 0, burst_cooldown_ms: 60_000 },
        distill: { auto: false },
      });
      const hook = createDreamDistillHook(config, client as any) as any;
      const fn = hook.event as (input: { event: any }) => Promise<void>;

      // 10 identical idle events in a row.
      for (let i = 0; i < 10; i++) {
        await fn({ event: { type: "session.idle" } });
      }
      expect(createCount).toBe(1);
    });
  });
});
