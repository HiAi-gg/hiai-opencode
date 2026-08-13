import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import {
  AGENT_BROWSER_ENGINE,
  LIGHTPANDA_ENGINE,
  applyAgentBrowserEngineDefault,
  findInPath,
} from "./agent-browser-engine";

describe("applyAgentBrowserEngineDefault", () => {
  test("sets lightpanda when unset and the binary is found", () => {
    const env: NodeJS.ProcessEnv = {};
    const lookup = (name: string) =>
      name === LIGHTPANDA_ENGINE ? "/opt/bin/lightpanda" : null;
    applyAgentBrowserEngineDefault(env, lookup);
    expect(env[AGENT_BROWSER_ENGINE]).toBe(LIGHTPANDA_ENGINE);
  });

  test("leaves the variable unset when the binary is missing", () => {
    const env: NodeJS.ProcessEnv = {};
    applyAgentBrowserEngineDefault(env, () => null);
    expect(env[AGENT_BROWSER_ENGINE]).toBeUndefined();
  });

  test("leaves an explicit value untouched (never hardcodes chrome)", () => {
    const env: NodeJS.ProcessEnv = { [AGENT_BROWSER_ENGINE]: "chrome" };
    const lookup = () => "/opt/bin/lightpanda";
    applyAgentBrowserEngineDefault(env, lookup);
    expect(env[AGENT_BROWSER_ENGINE]).toBe("chrome");
  });

  test("does not perform a lookup when the variable is already set", () => {
    const env: NodeJS.ProcessEnv = { [AGENT_BROWSER_ENGINE]: "lightpanda" };
    let called = false;
    applyAgentBrowserEngineDefault(env, () => {
      called = true;
      return null;
    });
    expect(called).toBe(false);
    expect(env[AGENT_BROWSER_ENGINE]).toBe("lightpanda");
  });
});

describe("findInPath", () => {
  test("returns null for a missing binary", () => {
    expect(findInPath("hiai-opencode-no-such-binary")).toBeNull();
  });

  test("resolves a binary from a controlled PATH", () => {
    const dir = mkdtempSync(join(tmpdir(), "hiai-engine-"));
    try {
      writeFileSync(join(dir, "lightpanda"), "");
      const env: NodeJS.ProcessEnv = { ...process.env, PATH: dir };
      expect(findInPath("lightpanda", env)).toBe(join(dir, "lightpanda"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("returns null when PATH is empty", () => {
    const env: NodeJS.ProcessEnv = { PATH: "" };
    expect(findInPath("lightpanda", env)).toBeNull();
  });
});

describe("applyAgentBrowserEngineDefault — integration with findInPath", () => {
  test("auto-selects lightpanda via the default lookup on a controlled PATH", () => {
    const dir = mkdtempSync(join(tmpdir(), "hiai-engine-"));
    try {
      writeFileSync(join(dir, "lightpanda"), "");
      const env: NodeJS.ProcessEnv = { ...process.env, PATH: dir };
      delete env[AGENT_BROWSER_ENGINE];
      applyAgentBrowserEngineDefault(env);
      expect(env[AGENT_BROWSER_ENGINE]).toBe(LIGHTPANDA_ENGINE);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("leaves the variable unset via the default lookup when missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "hiai-engine-"));
    try {
      const env: NodeJS.ProcessEnv = { ...process.env, PATH: dir };
      delete env[AGENT_BROWSER_ENGINE];
      applyAgentBrowserEngineDefault(env);
      expect(env[AGENT_BROWSER_ENGINE]).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
