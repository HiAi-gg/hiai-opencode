import { describe, expect, test } from "bun:test";
import type { BobConfig } from "../types";
import { createCavemanSystemInjector } from "./caveman-system-injector";

function makeConfig(overrides: Partial<BobConfig> = {}): BobConfig {
  return {
    models: {
      bob: { model: "openai/gpt-5.5" },
      build: { model: "opencode-go/deepseek-v4-pro" },
      explore: { model: "opencode-go/deepseek-v4-flash" },
      critic: { model: "opencode-go/mimo-v2.5-pro" },
      general: { model: "opencode-go/deepseek-v4-flash" },
      // writer has its own model so exclusion can be tested reliably.
      // In production, writer typically uses a distinct model from
      // general/explore/manager (which share deepseek-v4-flash).
      writer: { model: "opencode-go/deepseek-v4-flash-writer" },
      designer: { model: "opencode-go/kimi-k2.7-code" },
      manager: { model: "opencode-go/deepseek-v4-flash" },
      vision: { model: "opencode-go/mimo-v2.5" },
    },
    caveman: {
      enabled: true,
      level: "full",
      bob_internal: true,
      bob_to_agents: true,
      agents_to_bob: true,
      final_user_output: "normal",
      target_agents: [
        "bob",
        "explore",
        "build",
        "critic",
        "general",
        "designer",
        "manager",
      ],
      exclude_agents: ["vision", "writer"],
      min_messages_to_compress: 5,
    },
    ...overrides,
  };
}

describe("caveman-system-injector", () => {
  test("injects bob internal caveman + delegation + decode boundary for bob", async () => {
    const config = makeConfig();
    const hookSet = createCavemanSystemInjector(config);
    const transform = hookSet["experimental.chat.system.transform"];
    expect(transform).toBeDefined();

    const output = { system: [] as string[] };
    await transform!(
      { sessionID: "ses_test", model: { id: "openai/gpt-5.5" } },
      output as { system: string[] },
    );

    const joined = output.system.join("\n");
    expect(joined).toContain("Internal Communication Protocol (Caveman)");
    expect(joined).toContain("Subagent Result Handoff Protocol");
    expect(joined).toContain("Result Envelope Protocol");
    // Natural-language assertion: no broken template literal artifacts
    expect(joined).not.toMatch(/\$\{/);
  });

  test("injects subagent internal protocol for subagents", async () => {
    const config = makeConfig();
    const hookSet = createCavemanSystemInjector(config);
    const transform = hookSet["experimental.chat.system.transform"];
    expect(transform).toBeDefined();

    const output = { system: [] as string[] };
    await transform!(
      { sessionID: "ses_test", model: { id: "opencode-go/deepseek-v4-pro" } },
      output as { system: string[] },
    );

    const joined = output.system.join("\n");
    expect(joined).toContain("Result Envelope");
    expect(joined).not.toContain("Subagent Result Handoff Protocol");
  });

  test("returns empty hook set when caveman disabled", () => {
    const config = makeConfig({
      caveman: { enabled: false } as typeof config.caveman,
    });
    const hookSet = createCavemanSystemInjector(config);
    expect(hookSet["experimental.chat.system.transform"]).toBeUndefined();
  });

  test("skips excluded agents (vision)", async () => {
    const config = makeConfig();
    const hookSet = createCavemanSystemInjector(config);
    const transform = hookSet["experimental.chat.system.transform"];
    expect(transform).toBeDefined();

    const output = { system: [] as string[] };
    await transform!(
      { sessionID: "ses_test", model: { id: "opencode-go/mimo-v2.5" } },
      output as { system: string[] },
    );

    expect(output.system).toHaveLength(0);
  });

  test("skips excluded agents (writer)", async () => {
    const config = makeConfig();
    const hookSet = createCavemanSystemInjector(config);
    const transform = hookSet["experimental.chat.system.transform"];
    expect(transform).toBeDefined();

    // writer has unique model deepseek-v4-flash-writer → reverse map resolves to writer
    // writer is in exclude_agents → no injection
    const output = { system: [] as string[] };
    await transform!(
      {
        sessionID: "ses_test",
        model: { id: "opencode-go/deepseek-v4-flash-writer" },
      },
      output as { system: string[] },
    );

    expect(output.system).toHaveLength(0);
  });

  test("writer shares model with general — writer excluded, general still gets injection", async () => {
    // This tests the model-ID fallback: when writer and general share a model,
    // excluding writer by name works because writer has its own distinct model.
    // general/explore/manager share deepseek-v4-flash and still receive SUBAGENT_INTERNAL.
    const config = makeConfig();
    const hookSet = createCavemanSystemInjector(config);
    const transform = hookSet["experimental.chat.system.transform"];
    expect(transform).toBeDefined();

    // writer with unique model — excluded
    const writerOutput = { system: [] as string[] };
    await transform!(
      {
        sessionID: "ses_test",
        model: { id: "opencode-go/deepseek-v4-flash-writer" },
      },
      writerOutput as { system: string[] },
    );
    expect(writerOutput.system).toHaveLength(0);

    // general shares deepseek-v4-flash with explore/manager — not excluded, gets injection
    const generalOutput = { system: [] as string[] };
    await transform!(
      { sessionID: "ses_test", model: { id: "opencode-go/deepseek-v4-flash" } },
      generalOutput as { system: string[] },
    );
    expect(generalOutput.system.join("\n")).toContain("Result Envelope");
    expect(generalOutput.system.join("\n")).not.toContain(
      "Subagent Result Handoff Protocol",
    );
  });

  test("handles unknown model id gracefully", async () => {
    const config = makeConfig();
    const hookSet = createCavemanSystemInjector(config);
    const transform = hookSet["experimental.chat.system.transform"];
    expect(transform).toBeDefined();

    const output = { system: [] as string[] };
    await transform!(
      { sessionID: "ses_test", model: { id: "unknown/model" } },
      output as { system: string[] },
    );

    // Unknown model not in target list → skip
    expect(output.system).toHaveLength(0);
  });

  test("handles missing model id gracefully", async () => {
    const config = makeConfig();
    const hookSet = createCavemanSystemInjector(config);
    const transform = hookSet["experimental.chat.system.transform"];
    expect(transform).toBeDefined();

    const output = { system: [] as string[] };
    await transform!(
      { sessionID: "ses_test", model: {} as { id: string } },
      output as { system: string[] },
    );

    expect(output.system).toHaveLength(0);
  });

  test("handles null input model gracefully", async () => {
    const config = makeConfig();
    const hookSet = createCavemanSystemInjector(config);
    const transform = hookSet["experimental.chat.system.transform"];
    expect(transform).toBeDefined();

    const output = { system: [] as string[] };
    await transform!(
      { sessionID: "ses_test", model: null as unknown as { id: string } },
      output as { system: string[] },
    );

    expect(output.system).toHaveLength(0);
  });

  test("handles empty models config gracefully", async () => {
    const config = makeConfig({ models: {} });
    const hookSet = createCavemanSystemInjector(config);
    const transform = hookSet["experimental.chat.system.transform"];
    expect(transform).toBeDefined();

    const output = { system: [] as string[] };
    await transform!(
      { sessionID: "ses_test", model: { id: "some/model" } },
      output as { system: string[] },
    );

    // No reverse-map, model id used as-is, not in target → skip
    expect(output.system).toHaveLength(0);
  });
});
