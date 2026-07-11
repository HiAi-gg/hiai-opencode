/**
 * shell-env.test.ts — Verifies ShellEnvContext reads .env files and merges
 * config + .env vars, and that SECRET VALUES are never logged (only names).
 */

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  getShellEnv,
  getSubprocessEnv,
  initShellEnv,
  ShellEnvContext,
} from "./index";

const TMP = join(tmpdir(), "hiai-opencode-shell-env-test");

beforeEach(() => {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true });
  mkdirSync(TMP, { recursive: true });
  // Ensure no leakage from the host environment for the variables we test.
  delete process.env.DATABASE_URL;
  delete process.env.REDIS_URL;
  delete process.env.NODE_ENV;
});

afterEach(() => {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true });
  // Reset module singleton between tests.
  initShellEnv(undefined, TMP);
});

describe("ShellEnvContext.loadEnvFiles", () => {
  test("reads .env.local and .env with first-file-wins precedence", () => {
    writeFileSync(
      join(TMP, ".env.local"),
      "DATABASE_URL=from_local\nREDIS_URL=local_redis\n",
    );
    writeFileSync(
      join(TMP, ".env"),
      "DATABASE_URL=from_dotenv\nNODE_ENV=test\n",
    );

    const ctx = new ShellEnvContext(
      {
        variables: ["DATABASE_URL", "REDIS_URL", "NODE_ENV"],
        env_file: ".env.local",
      },
      TMP,
    );
    ctx.loadEnvFiles();
    const env = ctx.getShellEnv();

    // .env.local wins for DATABASE_URL (first in file order)
    expect(env.DATABASE_URL).toBe("from_local");
    expect(env.REDIS_URL).toBe("local_redis");
    expect(env.NODE_ENV).toBe("test");
  });

  test("process.env takes precedence over .env file values", () => {
    writeFileSync(join(TMP, ".env.local"), "DATABASE_URL=from_file\n");
    process.env.DATABASE_URL = "from_process";

    const ctx = new ShellEnvContext({ variables: ["DATABASE_URL"] }, TMP);
    const env = ctx.getShellEnv();
    expect(env.DATABASE_URL).toBe("from_process");
  });

  test("skips variables not present anywhere", () => {
    const ctx = new ShellEnvContext(
      { variables: ["DATABASE_URL", "MISSING_VAR"] },
      TMP,
    );
    const env = ctx.getShellEnv();
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.MISSING_VAR).toBeUndefined();
  });
});

describe("ShellEnvContext.shouldInjectInto / getSubprocessEnv", () => {
  test("only injects for targets listed in inject_in", () => {
    const ctx = new ShellEnvContext(
      { variables: ["NODE_ENV"], inject_in: ["agent-browser", "firecrawl"] },
      TMP,
    );
    expect(ctx.shouldInjectInto("agent-browser")).toBe(true);
    expect(ctx.shouldInjectInto("firecrawl")).toBe(true);
    expect(ctx.shouldInjectInto("bash")).toBe(false);
    expect(ctx.getSubprocessEnv("bash")).toBeUndefined();
    expect(ctx.getSubprocessEnv("agent-browser")).toBeDefined();
  });
});

describe("security: no secret values are logged", () => {
  test("debug output logs only variable NAMES, never values", () => {
    writeFileSync(
      join(TMP, ".env.local"),
      "DATABASE_URL=super_secret_value\nREDIS_URL=another_secret\n",
    );
    const ctx = new ShellEnvContext(
      {
        variables: ["DATABASE_URL", "REDIS_URL"],
        inject_in: ["agent-browser"],
        env_file: ".env.local",
      },
      TMP,
    );

    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => {
      logs.push(args.map((a) => String(a)).join(" "));
    };
    try {
      ctx.getShellEnv();
    } finally {
      console.log = originalLog;
    }

    const logged = logs.join("\n");
    // Variable names must appear
    expect(logged).toContain("DATABASE_URL");
    expect(logged).toContain("REDIS_URL");
    // SECRET VALUES must NEVER appear in any log line
    expect(logged).not.toContain("super_secret_value");
    expect(logged).not.toContain("another_secret");
  });
});

describe("module singleton helpers", () => {
  test("getShellEnv returns {} before init", () => {
    // Reset singleton to null by initializing with undefined config
    initShellEnv(undefined, TMP);
    expect(getShellEnv()).toEqual({});
    expect(getSubprocessEnv("agent-browser")).toBeUndefined();
  });

  test("initShellEnv wires the singleton and getShellEnv respects inject_in", () => {
    process.env.NODE_ENV = "production";
    initShellEnv(
      {
        variables: ["NODE_ENV"],
        inject_in: ["firecrawl"],
      },
      TMP,
    );
    // Not enabled for agent-browser → empty
    expect(getShellEnv("agent-browser")).toEqual({});
    // Enabled for firecrawl → returns the var
    expect(getShellEnv("firecrawl")).toEqual({ NODE_ENV: "production" });
  });
});
