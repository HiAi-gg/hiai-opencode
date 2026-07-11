import { describe, expect, test } from "bun:test";
import type { BobConfig } from "../types";
import { createDirectoryAgentsInjector } from "./directory-agents-injector";

function makeConfig(overrides: Partial<BobConfig> = {}): BobConfig {
  return {
    models: { bob: { model: "openai/gpt-5.5" } },
    ...overrides,
  };
}

describe("directory-agents-injector", () => {
  test("returns a hook set with a system transform", () => {
    const hookSet = createDirectoryAgentsInjector(makeConfig());
    expect(hookSet["experimental.chat.system.transform"]).toBeDefined();
    expect(typeof hookSet["experimental.chat.system.transform"]).toBe(
      "function",
    );
  });

  test("pushes the AGENTS.md rule into an empty system array", async () => {
    const hookSet = createDirectoryAgentsInjector(makeConfig());
    const output = { system: [] as string[] };
    await hookSet["experimental.chat.system.transform"]!(
      {} as Parameters<
        NonNullable<(typeof hookSet)["experimental.chat.system.transform"]>
      >[0],
      output as Parameters<
        NonNullable<(typeof hookSet)["experimental.chat.system.transform"]>
      >[1],
    );
    expect(output.system).toHaveLength(1);
    expect(output.system[0]).toContain("AGENTS.md");
  });

  test("appends to an existing system array without removing entries", async () => {
    const hookSet = createDirectoryAgentsInjector(makeConfig());
    const output = { system: ["existing system prompt"] as string[] };
    await hookSet["experimental.chat.system.transform"]!(
      {} as Parameters<
        NonNullable<(typeof hookSet)["experimental.chat.system.transform"]>
      >[0],
      output as Parameters<
        NonNullable<(typeof hookSet)["experimental.chat.system.transform"]>
      >[1],
    );
    expect(output.system).toHaveLength(2);
    expect(output.system[0]).toBe("existing system prompt");
    expect(output.system[1]).toContain("AGENTS.md");
  });

  test("injected string references project directories", async () => {
    const hookSet = createDirectoryAgentsInjector(makeConfig());
    const output = { system: [] as string[] };
    await hookSet["experimental.chat.system.transform"]!(
      {} as Parameters<
        NonNullable<(typeof hookSet)["experimental.chat.system.transform"]>
      >[0],
      output as Parameters<
        NonNullable<(typeof hookSet)["experimental.chat.system.transform"]>
      >[1],
    );
    expect(output.system[0]).toContain("project directories");
  });
});
