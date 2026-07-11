import { describe, expect, test } from "bun:test";
import type { BobConfig } from "../types";
import { createWriteExistingFileGuard } from "./write-existing-file-guard";

const config = {} as BobConfig;

describe("write-existing-file-guard", () => {
  test("returns a hook set with tool.execute.before and dispose", () => {
    const hook = createWriteExistingFileGuard(config);
    expect(typeof hook["tool.execute.before"]).toBe("function");
    expect(typeof hook.dispose).toBe("function");
  });

  test("tracks reads per session", async () => {
    const hook = createWriteExistingFileGuard(config) as any;
    const fn = hook["tool.execute.before"] as (i: any, o: any) => Promise<void>;

    const input = { tool: "read", sessionID: "s1" };
    const output = { args: { filePath: "/test/file.ts" } };
    await fn(input, output);
    // Should not throw — no assertion needed beyond no error
  });

  test("warns on write without prior read", async () => {
    const hook = createWriteExistingFileGuard(config) as any;
    const fn = hook["tool.execute.before"] as (i: any, o: any) => Promise<void>;

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    try {
      await fn(
        { tool: "write", sessionID: "s2" },
        { args: { filePath: "/new/file.ts" } },
      );
      expect(
        logs.some((l) => l.includes("Write/edit without prior Read")),
      ).toBe(true);
      expect(logs.some((l) => l.includes("/new/file.ts"))).toBe(true);
    } finally {
      console.log = origLog;
    }
  });

  test("does not warn on write after read", async () => {
    const hook = createWriteExistingFileGuard(config) as any;
    const fn = hook["tool.execute.before"] as (i: any, o: any) => Promise<void>;
    const sid = "s3";

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    try {
      // Read first
      await fn(
        { tool: "read", sessionID: sid },
        { args: { filePath: "/test/file.ts" } },
      );
      // Now write — should NOT warn
      await fn(
        { tool: "write", sessionID: sid },
        { args: { filePath: "/test/file.ts" } },
      );
      expect(
        logs.some((l) => l.includes("Write/edit without prior Read")),
      ).toBe(false);
    } finally {
      console.log = origLog;
    }
  });

  test("warns on edit without prior read", async () => {
    const hook = createWriteExistingFileGuard(config) as any;
    const fn = hook["tool.execute.before"] as (i: any, o: any) => Promise<void>;

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    try {
      await fn(
        { tool: "edit", sessionID: "s4" },
        { args: { path: "/unedited/file.ts" } },
      );
      expect(
        logs.some((l) => l.includes("Write/edit without prior Read")),
      ).toBe(true);
    } finally {
      console.log = origLog;
    }
  });

  test("does not warn on edit after read", async () => {
    const hook = createWriteExistingFileGuard(config) as any;
    const fn = hook["tool.execute.before"] as (i: any, o: any) => Promise<void>;
    const sid = "s5";

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    try {
      await fn(
        { tool: "read", sessionID: sid },
        { args: { filePath: "/test/file.ts" } },
      );
      await fn(
        { tool: "edit", sessionID: sid },
        { args: { path: "/test/file.ts" } },
      );
      expect(
        logs.some((l) => l.includes("Write/edit without prior Read")),
      ).toBe(false);
    } finally {
      console.log = origLog;
    }
  });

  test("reads are per-session: two sessions can each have tracking", async () => {
    const hook = createWriteExistingFileGuard(config) as any;
    const fn = hook["tool.execute.before"] as (i: any, o: any) => Promise<void>;

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    try {
      // Read in session A
      await fn(
        { tool: "read", sessionID: "sA" },
        { args: { filePath: "/fileA.ts" } },
      );
      // Write in session A — should NOT warn
      await fn(
        { tool: "write", sessionID: "sA" },
        { args: { filePath: "/fileA.ts" } },
      );
      // Write in session B — SHOULD warn (no prior read in session B)
      await fn(
        { tool: "write", sessionID: "sB" },
        { args: { filePath: "/fileA.ts" } },
      );

      const warnedCount = logs.filter((l) =>
        l.includes("Write/edit without prior Read"),
      ).length;
      expect(warnedCount).toBe(1);
      expect(logs.some((l) => l.includes("sB"))).toBe(false); // sessionID not typically in log msg
    } finally {
      console.log = origLog;
    }
  });

  test("dispose clears all tracking", async () => {
    const hook = createWriteExistingFileGuard(config) as any;
    const fn = hook["tool.execute.before"] as (i: any, o: any) => Promise<void>;
    const sid = "s-dispose";

    const logs: string[] = [];
    const origLog = console.log;
    console.log = (msg: string) => logs.push(msg);

    try {
      // Read + write should be clean
      await fn(
        { tool: "read", sessionID: sid },
        { args: { filePath: "/f.ts" } },
      );
      await fn(
        { tool: "write", sessionID: sid },
        { args: { filePath: "/f.ts" } },
      );
      expect(logs).toHaveLength(0);

      // Dispose clears reads map
      await hook.dispose();

      // Now write warns even without explicit new read
      await fn(
        { tool: "write", sessionID: sid },
        { args: { filePath: "/f.ts" } },
      );
      expect(
        logs.some((l) => l.includes("Write/edit without prior Read")),
      ).toBe(true);
    } finally {
      console.log = origLog;
    }
  });
});
