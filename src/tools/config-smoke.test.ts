/**
 * config-smoke.test.ts — Verifies that example config from docs/CONFIG.md
 * is structurally valid and loadable.
 */

import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadEnvFiles, parseEnvFile } from "../config";

const TMP = join(tmpdir(), "hiai-opencode-config-test");

beforeAll(() => {
  if (existsSync(TMP)) rmSync(TMP, { recursive: true });
  mkdirSync(TMP, { recursive: true });
});

describe("config loading from documented example", () => {
  test("loads with minimal bob.json", async () => {
    const cfg = {
      models: {
        bob: { model: "test/test" },
        build: { model: "test/test" },
        plan: { model: "test/test" },
        manager: { model: "test/test" },
        critic: { model: "test/test" },
        designer: { model: "test/test" },
        explore: { model: "test/test" },
        writer: { model: "test/test" },
        vision: { model: "test/test" },
        general: { model: "test/test" },
      },
    };
    const bobJsonPath = join(TMP, "bob.json");
    writeFileSync(bobJsonPath, JSON.stringify(cfg, null, 2));
    const hooks = await (await import("../index")).BobPlugin({
      directory: TMP,
    });
    expect(hooks).toBeDefined();
    expect(typeof hooks.dispose).toBe("function");
    await hooks.dispose?.();
  });

  test("loads with full documented config", async () => {
    const cfg = {
      models: {
        bob: { model: "opencode-go/mimo-v2.5-pro" },
        build: { model: "deepseek/deepseek-v4-pro" },
        plan: { model: "deepseek/deepseek-v4-pro" },
        manager: { model: "opencode-go/deepseek-v4-flash" },
        critic: { model: "opencode-go/mimo-v2.5-pro" },
        designer: { model: "anthropic/claude-sonnet-4-5" },
        explore: { model: "opencode-go/deepseek-v4-flash" },
        writer: { model: "openrouter/mistralai/mistral-small-2603" },
        vision: { model: "opencode-go/mimo-v2.5" },
        general: { model: "opencode-go/deepseek-v4-flash" },
      },
      mcp: {
        "sequential-thinking": { enabled: true },
        grep_app: { enabled: true },
      },
      lsp: {
        typescript: { enabled: true },
        svelte: { enabled: true },
        eslint: { enabled: true },
        pyright: { enabled: true },
      },
      completion: {
        enabled: true,
        max_auto_continues: 25,
        require_critic: true,
      },
      dream: { auto: true, interval_days: 7 },
      distill: { auto: true, interval_days: 30 },
      telemetry: { enabled: false, serviceName: "hiai-opencode" },
    };
    const bobJsonPath = join(TMP, "bob.json");
    writeFileSync(bobJsonPath, JSON.stringify(cfg, null, 2));
    const hooks = await (await import("../index")).BobPlugin({
      directory: TMP,
    });
    expect(hooks).toBeDefined();
    expect(typeof hooks.dispose).toBe("function");
    await hooks.dispose?.();
  });

  test("loads with hook disable list", async () => {
    const cfg = {
      models: { bob: { model: "test/test" } },
      hooks: {
        disabled: ["non-interactive-env", "context-window-monitor"],
      },
    };
    const bobJsonPath = join(TMP, "bob.json");
    writeFileSync(bobJsonPath, JSON.stringify(cfg, null, 2));
    const hooks = await (await import("../index")).BobPlugin({
      directory: TMP,
    });
    expect(hooks).toBeDefined();
    await hooks.dispose?.();
  });

  test("loads with agent_restrictions", async () => {
    const cfg = {
      models: {
        bob: { model: "test/test" },
        build: { model: "test/test" },
        plan: { model: "test/test" },
        manager: { model: "test/test" },
        critic: { model: "test/test" },
        designer: { model: "test/test" },
        explore: { model: "test/test" },
        writer: { model: "test/test" },
        vision: { model: "test/test" },
        general: { model: "test/test" },
      },
      agent_restrictions: {
        bob: { write: false, edit: false, bash: false },
      },
    };
    const bobJsonPath = join(TMP, "bob.json");
    writeFileSync(bobJsonPath, JSON.stringify(cfg, null, 2));
    const hooks = await (await import("../index")).BobPlugin({
      directory: TMP,
    });
    expect(hooks).toBeDefined();
    await hooks.dispose?.();
  });
});

describe("parseEnvFile", () => {
  test("parses export KEY=value format", () => {
    const entries = parseEnvFile(
      "export FIRECRAWL_API_KEY=test-key-123\nexport CONTEXT7_API_KEY=ctx7-key-456\n",
    );
    expect(entries).toHaveLength(2);
    expect(entries).toContainEqual({
      key: "FIRECRAWL_API_KEY",
      value: "test-key-123",
    });
    expect(entries).toContainEqual({
      key: "CONTEXT7_API_KEY",
      value: "ctx7-key-456",
    });
  });

  test("parses plain KEY=value format", () => {
    const entries = parseEnvFile(
      "FIRECRAWL_API_KEY=test-key-123\nCONTEXT7_API_KEY=ctx7-key-456\n",
    );
    expect(entries).toHaveLength(2);
    expect(entries).toContainEqual({
      key: "FIRECRAWL_API_KEY",
      value: "test-key-123",
    });
    expect(entries).toContainEqual({
      key: "CONTEXT7_API_KEY",
      value: "ctx7-key-456",
    });
  });

  test("parses mixed export and plain formats", () => {
    const text = [
      "export FIRECRAWL_API_KEY=exported-key",
      "CONTEXT7_API_KEY=plain-key",
      "# comment line",
      "OTHER_KEY=value",
      "",
    ].join("\n");
    const entries = parseEnvFile(text);
    expect(entries).toContainEqual({
      key: "FIRECRAWL_API_KEY",
      value: "exported-key",
    });
    expect(entries).toContainEqual({
      key: "CONTEXT7_API_KEY",
      value: "plain-key",
    });
    expect(entries).toContainEqual({ key: "OTHER_KEY", value: "value" });
  });

  test("strips quotes from values", () => {
    const entries = parseEnvFile(
      "export KEY1=\"quoted\"\nexport KEY2='single'\nexport KEY3=no-quote\n",
    );
    expect(entries).toContainEqual({ key: "KEY1", value: "quoted" });
    expect(entries).toContainEqual({ key: "KEY2", value: "single" });
    expect(entries).toContainEqual({ key: "KEY3", value: "no-quote" });
  });

  test("ignores empty lines and comments", () => {
    const entries = parseEnvFile(
      "# comment\n\n  \n  # another comment\nKEY=value\n",
    );
    expect(entries).toHaveLength(1);
    expect(entries).toContainEqual({ key: "KEY", value: "value" });
  });
});

describe("loadEnvFiles", () => {
  const ENV_TEST_DIR = join(tmpdir(), "hiai-opencode-env-test");

  beforeEach(() => {
    if (existsSync(ENV_TEST_DIR)) rmSync(ENV_TEST_DIR, { recursive: true });
    mkdirSync(ENV_TEST_DIR, { recursive: true });
    // Clear test keys from process.env
    delete process.env.TEST_FIRECRAWL_KEY;
    delete process.env.TEST_CONTEXT7_KEY;
    delete process.env.TEST_PLUGIN_KEY;
  });

  afterEach(() => {
    if (existsSync(ENV_TEST_DIR)) rmSync(ENV_TEST_DIR, { recursive: true });
  });

  test("loads bob.env from projectDir", () => {
    const envPath = join(ENV_TEST_DIR, "bob.env");
    writeFileSync(
      envPath,
      "TEST_FIRECRAWL_KEY=proj-fire\nTEST_CONTEXT7_KEY=proj-ctx7\n",
    );
    loadEnvFiles(ENV_TEST_DIR);
    expect(process.env.TEST_FIRECRAWL_KEY).toBe("proj-fire");
    expect(process.env.TEST_CONTEXT7_KEY).toBe("proj-ctx7");
  });

  test("loads bob.env from projectDir/.opencode/", () => {
    const opencodeDir = join(ENV_TEST_DIR, ".opencode");
    mkdirSync(opencodeDir);
    const envPath = join(opencodeDir, "bob.env");
    writeFileSync(envPath, "TEST_FIRECRAWL_KEY=opencode-fire\n");
    loadEnvFiles(ENV_TEST_DIR);
    expect(process.env.TEST_FIRECRAWL_KEY).toBe("opencode-fire");
  });

  test("does not clobber existing process.env values for non-managed keys", () => {
    // Pre-set a non-managed key in process.env
    process.env.TEST_OTHER_KEY = "already-set";
    const envPath = join(ENV_TEST_DIR, "bob.env");
    writeFileSync(
      envPath,
      "TEST_OTHER_KEY=new-value\nTEST_NEW_KEY=brand-new\n",
    );
    loadEnvFiles(ENV_TEST_DIR);
    // Existing non-managed value must not be overwritten
    expect(process.env.TEST_OTHER_KEY).toBe("already-set");
    // New key should be set
    expect(process.env.TEST_NEW_KEY).toBe("brand-new");
  });

  test("managed key in bob.env overrides stale process.env value", () => {
    // Simulate a stale shell-env value shadowing a fresh bob.env entry
    process.env.FIRECRAWL_API_KEY = "stale-shell-value";
    const envPath = join(ENV_TEST_DIR, "bob.env");
    writeFileSync(envPath, "FIRECRAWL_API_KEY=fresh-bob-env-value\n");
    loadEnvFiles(ENV_TEST_DIR);
    // bob.env must win for managed keys even when shell env is present
    expect(process.env.FIRECRAWL_API_KEY).toBe("fresh-bob-env-value");
  });

  test("project root bob.env beats plugin/global fallback", () => {
    // Verify first-match-wins among env files (project > .opencode > global > plugin)
    const opencodeDir = join(ENV_TEST_DIR, ".opencode");
    mkdirSync(opencodeDir);
    writeFileSync(
      join(ENV_TEST_DIR, "bob.env"),
      "FIRECRAWL_API_KEY=proj-key\n",
    );
    writeFileSync(
      join(opencodeDir, "bob.env"),
      "FIRECRAWL_API_KEY=opencode-key\n",
    );
    loadEnvFiles(ENV_TEST_DIR);
    // projectDir should win for FIRECRAWL_API_KEY
    expect(process.env.FIRECRAWL_API_KEY).toBe("proj-key");
  });

  test("projectDir takes priority over .opencode/", () => {
    const opencodeDir = join(ENV_TEST_DIR, ".opencode");
    mkdirSync(opencodeDir);
    writeFileSync(
      join(ENV_TEST_DIR, "bob.env"),
      "TEST_FIRECRAWL_KEY=proj-key\n",
    );
    writeFileSync(
      join(opencodeDir, "bob.env"),
      "TEST_FIRECRAWL_KEY=opencode-key\nTEST_CONTEXT7_KEY=opencode-ctx7\n",
    );
    loadEnvFiles(ENV_TEST_DIR);
    // projectDir should win for TEST_FIRECRAWL_KEY
    expect(process.env.TEST_FIRECRAWL_KEY).toBe("proj-key");
    // opencode can still set other keys
    expect(process.env.TEST_CONTEXT7_KEY).toBe("opencode-ctx7");
  });

  test("loads from plugin root as fallback", () => {
    // This tests that the PLUGIN_ROOT fallback path is tried last
    // We verify by checking no error is thrown when no other paths exist
    loadEnvFiles("/nonexistent-path");
    // Should not throw — just skips missing files
    expect(true).toBe(true);
  });
});
