import { describe, expect, test } from "bun:test";
import type { BobConfig } from "../types";
import { createRuntimeFallback } from "./runtime-fallback";

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

describe("runtime-fallback", () => {
  test("returns a hook set with chat.params defined", () => {
    const config = makeConfig();
    const hookSet = createRuntimeFallback(config);
    expect(hookSet["chat.params"]).toBeDefined();
    expect(typeof hookSet["chat.params"]).toBe("function");
  });

  test("normal operation: maxOutputTokens below cap is unchanged", async () => {
    const config = makeConfig();
    const hookSet = createRuntimeFallback(config);
    const params = hookSet["chat.params"]!;

    const output = { maxOutputTokens: 1000 } as Parameters<
      Parameters<typeof params>[1] extends never ? never : typeof params
    >[1];
    await params(
      {} as Parameters<typeof params>[0],
      output as Parameters<typeof params>[1],
    );

    expect(output.maxOutputTokens).toBe(1000);
  });

  test("normal operation: maxOutputTokens exactly at cap is unchanged", async () => {
    const config = makeConfig();
    const hookSet = createRuntimeFallback(config);
    const params = hookSet["chat.params"]!;

    const output = { maxOutputTokens: 32_000 } as Parameters<typeof params>[1];
    await params(
      {} as Parameters<typeof params>[0],
      output as Parameters<typeof params>[1],
    );

    expect(output.maxOutputTokens).toBe(32_000);
  });

  test("normal operation: undefined maxOutputTokens is left untouched", async () => {
    const config = makeConfig();
    const hookSet = createRuntimeFallback(config);
    const params = hookSet["chat.params"]!;

    const output = { maxOutputTokens: undefined } as Parameters<
      typeof params
    >[1];
    await params(
      {} as Parameters<typeof params>[0],
      output as Parameters<typeof params>[1],
    );

    expect(output.maxOutputTokens).toBeUndefined();
  });

  test("error condition: maxOutputTokens above cap is clamped to 32000", async () => {
    const config = makeConfig();
    const hookSet = createRuntimeFallback(config);
    const params = hookSet["chat.params"]!;

    const output = { maxOutputTokens: 40_000 } as Parameters<typeof params>[1];
    await params(
      {} as Parameters<typeof params>[0],
      output as Parameters<typeof params>[1],
    );

    expect(output.maxOutputTokens).toBe(32_000);
  });

  test("error condition: very large maxOutputTokens is clamped to 32000", async () => {
    const config = makeConfig();
    const hookSet = createRuntimeFallback(config);
    const params = hookSet["chat.params"]!;

    const output = { maxOutputTokens: 1_000_000 } as Parameters<
      typeof params
    >[1];
    await params(
      {} as Parameters<typeof params>[0],
      output as Parameters<typeof params>[1],
    );

    expect(output.maxOutputTokens).toBe(32_000);
  });

  test("fallback preserves other output fields", async () => {
    const config = makeConfig();
    const hookSet = createRuntimeFallback(config);
    const params = hookSet["chat.params"]!;

    const output = {
      temperature: 0.5,
      topP: 0.9,
      topK: 40,
      maxOutputTokens: 50_000,
      options: { stream: true },
    } as Parameters<typeof params>[1];
    await params(
      {} as Parameters<typeof params>[0],
      output as Parameters<typeof params>[1],
    );

    expect(output.maxOutputTokens).toBe(32_000);
    expect(output.temperature).toBe(0.5);
    expect(output.topP).toBe(0.9);
    expect(output.topK).toBe(40);
    expect(output.options).toEqual({ stream: true });
  });
});
