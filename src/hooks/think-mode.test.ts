import { describe, expect, test } from "bun:test";
import type { BobConfig } from "../types";
import { createThinkModeHook } from "./think-mode";

const config = {} as BobConfig;

function makeOutput(options: Record<string, unknown> | undefined) {
  return {
    options,
  } as Parameters<
    NonNullable<ReturnType<typeof createThinkModeHook>["chat.params"]>
  >[1];
}

describe("think-mode", () => {
  test("returns a hook set with chat.params defined", () => {
    const hookSet = createThinkModeHook(config);
    expect(hookSet["chat.params"]).toBeDefined();
    expect(typeof hookSet["chat.params"]).toBe("function");
  });

  test("happy path: enables thinking when options exist but thinking unset", async () => {
    const hookSet = createThinkModeHook(config);
    const transform = hookSet["chat.params"]!;

    const output = makeOutput({});
    await transform({} as Parameters<typeof transform>[0], output);

    expect(output.options.thinking).toEqual({
      type: "enabled",
      budgetTokens: 10000,
    });
  });

  test("does not override an already-set thinking option", async () => {
    const hookSet = createThinkModeHook(config);
    const transform = hookSet["chat.params"]!;

    const existing = { type: "disabled" as const };
    const output = makeOutput({ thinking: existing });
    await transform({} as Parameters<typeof transform>[0], output);

    expect(output.options.thinking).toBe(existing);
  });

  test("edge case: options undefined → no error, no mutation", async () => {
    const hookSet = createThinkModeHook(config);
    const transform = hookSet["chat.params"]!;

    const output = makeOutput(undefined);
    await expect(
      transform({} as Parameters<typeof transform>[0], output),
    ).resolves.toBeUndefined();
  });

  test("edge case: output undefined → no error", async () => {
    const hookSet = createThinkModeHook(config);
    const transform = hookSet["chat.params"]!;

    await expect(
      transform({} as Parameters<typeof transform>[0], undefined as never),
    ).resolves.toBeUndefined();
  });
});
