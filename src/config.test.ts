import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_CONFIG, loadConfig, mergeConfig } from "./config";

const directories: string[] = [];
afterEach(() => {
  for (const dir of directories.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("delegation config", () => {
  test("defaults subagent_depth to two and validates overrides", () => {
    expect(DEFAULT_CONFIG.subagent_depth).toBe(2);
    expect(mergeConfig({ subagent_depth: 3 }).subagent_depth).toBe(3);
    expect(() => mergeConfig({ subagent_depth: 0 })).toThrow(
      "positive integer",
    );
  });

  test("deep-merges agent restrictions and circuit breaker settings", () => {
    const config = mergeConfig({
      agent_restrictions: { bob: { write: true } },
      background_manager: { circuit_breaker: { max_tool_calls: 12 } },
    });
    expect(config.agent_restrictions?.bob?.write).toBe(true);
    expect(config.agent_restrictions?.bob?.bash).toBe(false);
    expect(config.background_manager?.circuit_breaker?.max_tool_calls).toBe(12);
    expect(config.background_manager?.circuit_breaker?.enabled).toBe(true);
  });

  test("uses the first project config instead of mixing lower-priority files", () => {
    const project = join(
      tmpdir(),
      `hiai-config-${Date.now()}-${Math.random()}`,
    );
    directories.push(project);
    mkdirSync(join(project, ".opencode"), { recursive: true });
    writeFileSync(
      join(project, "bob.json"),
      JSON.stringify({ subagent_depth: 3 }),
    );
    writeFileSync(
      join(project, ".opencode", "bob.json"),
      JSON.stringify({ subagent_depth: 1 }),
    );
    expect(loadConfig(project).subagent_depth).toBe(3);
  });

  test("Dream and Distill explicit models override the Bob fallback", () => {
    const config = mergeConfig({
      models: { bob: { model: "provider/bob" } },
      dream: { model: "provider/dream" },
      distill: { model: "provider/distill" },
    });
    expect(config.dream?.model).toBe("provider/dream");
    expect(config.distill?.model).toBe("provider/distill");
  });
});
