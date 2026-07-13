import { describe, expect, test } from "bun:test";
import type { BobConfig } from "../types";
import { createModelFallbackHook } from "./model-fallback";

const config = {} as BobConfig;

describe("model-fallback", () => {
  test("returns a hook set with event defined", () => {
    const hook = createModelFallbackHook(config);
    expect(typeof hook.event).toBe("function");
  });

  test("ignores non-session.error events", async () => {
    const hook = createModelFallbackHook(config) as any;
    const fn = hook.event as (input: { event: unknown }) => Promise<void>;
    await expect(
      fn({ event: { type: "session.idle" } }),
    ).resolves.toBeUndefined();
  });

  test("logs fallback hint on 429 error", async () => {
    const hook = createModelFallbackHook(config) as any;
    const fn = hook.event as (input: { event: unknown }) => Promise<void>;

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    try {
      await fn({
        event: {
          type: "session.error",
          properties: { error: "429 Too Many Requests" },
        },
      });
      expect(logs.some((l) => l.includes("Model fallback"))).toBe(true);
      expect(logs.some((l) => l.includes("rate limit"))).toBe(true);
    } finally {
      console.log = origLog;
    }
  });

  test("logs fallback hint on 503 error", async () => {
    const hook = createModelFallbackHook(config) as any;
    const fn = hook.event as (input: { event: unknown }) => Promise<void>;

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    try {
      await fn({
        event: {
          type: "session.error",
          properties: { error: "503 Service Unavailable" },
        },
      });
      expect(logs.some((l) => l.includes("Model fallback"))).toBe(true);
    } finally {
      console.log = origLog;
    }
  });

  test("logs fallback hint on rate_limit error", async () => {
    const hook = createModelFallbackHook(config) as any;
    const fn = hook.event as (input: { event: unknown }) => Promise<void>;

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    try {
      await fn({
        event: {
          type: "session.error",
          properties: { error: "rate_limit exceeded" },
        },
      });
      expect(logs.some((l) => l.includes("Model fallback"))).toBe(true);
    } finally {
      console.log = origLog;
    }
  });

  test("ignores errors that are not rate-limit related", async () => {
    const hook = createModelFallbackHook(config) as any;
    const fn = hook.event as (input: { event: unknown }) => Promise<void>;

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    try {
      await fn({
        event: {
          type: "session.error",
          properties: { error: "500 Internal Server Error" },
        },
      });
      expect(logs.some((l) => l.includes("Model fallback"))).toBe(false);
    } finally {
      console.log = origLog;
    }
  });

  test("handles missing error property", async () => {
    const hook = createModelFallbackHook(config) as any;
    const fn = hook.event as (input: { event: unknown }) => Promise<void>;
    await expect(
      fn({ event: { type: "session.error", properties: {} } }),
    ).resolves.toBeUndefined();
  });

  test("does not throw when error is an object (regression: error.includes crash)", async () => {
    const hook = createModelFallbackHook(config) as any;
    const fn = hook.event as (input: { event: unknown }) => Promise<void>;
    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);
    const origErr = console.error;
    console.error = (msg: string) => logs.push(msg);

    try {
      // Real opencode emits error as an object, not a string.
      await expect(
        fn({
          event: {
            type: "session.error",
            properties: { error: { message: "429 Too Many Requests" } },
          },
        }),
      ).resolves.toBeUndefined();
      // Object error with 429 inside should still trigger fallback detection.
      expect(logs.some((l) => l.includes("Model fallback"))).toBe(true);
    } finally {
      console.log = origLog;
      console.error = origErr;
    }
  });
});
