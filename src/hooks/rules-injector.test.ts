import { describe, expect, test } from "bun:test";
import type { BobConfig } from "../types";
import { createRulesInjector } from "./rules-injector";

function makeConfig(overrides: Partial<BobConfig> = {}): BobConfig {
  return {
    models: {
      bob: { model: "openai/gpt-5.5" },
      build: { model: "opencode-go/deepseek-v4-pro" },
      explore: { model: "opencode-go/deepseek-v4-flash" },
      critic: { model: "opencode-go/mimo-v2.5-pro" },
      general: { model: "opencode-go/deepseek-v4-flash" },
      writer: { model: "opencode-go/deepseek-v4-flash" },
      designer: { model: "opencode-go/kimi-k2.7-code" },
      manager: { model: "opencode-go/deepseek-v4-flash" },
      vision: { model: "opencode-go/mimo-v2.5" },
    },
    ...overrides,
  };
}

describe("rules-injector", () => {
  test("returns a hook set with system transform defined", () => {
    const config = makeConfig();
    const hookSet = createRulesInjector(config);
    expect(hookSet["experimental.chat.system.transform"]).toBeDefined();
    expect(typeof hookSet["experimental.chat.system.transform"]).toBe(
      "function",
    );
  });

  test("injects AGENTS.md rules into the system prompt", async () => {
    const config = makeConfig();
    const hookSet = createRulesInjector(config);
    const transform = hookSet["experimental.chat.system.transform"]!;

    const output = { system: [] as string[] };
    await transform(
      { sessionID: "ses_test", model: { id: "openai/gpt-5.5" } } as Parameters<
        typeof transform
      >[0],
      output as Parameters<typeof transform>[1],
    );

    expect(output.system).toHaveLength(1);
    expect(output.system[0]).toContain("[hiai-opencode]");
    expect(output.system[0]).toContain("AGENTS.md");
  });

  test("preserves existing system prompt content and appends the rule", async () => {
    const config = makeConfig();
    const hookSet = createRulesInjector(config);
    const transform = hookSet["experimental.chat.system.transform"]!;

    const output = { system: ["You are a helpful assistant."] as string[] };
    await transform(
      { sessionID: "ses_test", model: { id: "openai/gpt-5.5" } } as Parameters<
        typeof transform
      >[0],
      output as Parameters<typeof transform>[1],
    );

    expect(output.system).toHaveLength(2);
    expect(output.system[0]).toBe("You are a helpful assistant.");
    expect(output.system[1]).toContain("AGENTS.md");
  });

  test("multiple invocations append multiple rule entries", async () => {
    const config = makeConfig();
    const hookSet = createRulesInjector(config);
    const transform = hookSet["experimental.chat.system.transform"]!;

    const output = { system: [] as string[] };
    await transform(
      { sessionID: "ses_test", model: { id: "openai/gpt-5.5" } } as Parameters<
        typeof transform
      >[0],
      output as Parameters<typeof transform>[1],
    );
    await transform(
      { sessionID: "ses_test", model: { id: "openai/gpt-5.5" } } as Parameters<
        typeof transform
      >[0],
      output as Parameters<typeof transform>[1],
    );

    expect(output.system).toHaveLength(2);
    expect(output.system[0]).toContain("AGENTS.md");
    expect(output.system[1]).toContain("AGENTS.md");
  });

  test("empty rules: empty system array still receives the rule", async () => {
    const config = makeConfig();
    const hookSet = createRulesInjector(config);
    const transform = hookSet["experimental.chat.system.transform"]!;

    const output = { system: [] as string[] };
    await transform(
      { sessionID: "ses_test", model: { id: "openai/gpt-5.5" } } as Parameters<
        typeof transform
      >[0],
      output as Parameters<typeof transform>[1],
    );

    expect(output.system).toHaveLength(1);
    expect(output.system[0]).toContain("Follow AGENTS.md rules");
  });

  test("handles missing model id gracefully", async () => {
    const config = makeConfig();
    const hookSet = createRulesInjector(config);
    const transform = hookSet["experimental.chat.system.transform"]!;

    const output = { system: [] as string[] };
    await transform(
      { sessionID: "ses_test", model: {} as { id: string } } as Parameters<
        typeof transform
      >[0],
      output as Parameters<typeof transform>[1],
    );

    expect(output.system).toHaveLength(1);
    expect(output.system[0]).toContain("AGENTS.md");
  });
});
