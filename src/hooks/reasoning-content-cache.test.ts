import { describe, expect, test } from "bun:test";
import type { BobConfig } from "../types";
import { createReasoningContentCacheHook } from "./reasoning-content-cache";

function makeConfig(overrides: Partial<BobConfig> = {}): BobConfig {
  return {
    models: { bob: { model: "openai/gpt-5.5" } },
    ...overrides,
  };
}

describe("reasoning-content-cache", () => {
  test("returns a hook set with a messages transform", () => {
    const hookSet = createReasoningContentCacheHook(makeConfig());
    expect(hookSet["experimental.chat.messages.transform"]).toBeDefined();
    expect(typeof hookSet["experimental.chat.messages.transform"]).toBe(
      "function",
    );
  });

  test("marks reasoning parts with _preserved = true", async () => {
    const hookSet = createReasoningContentCacheHook(makeConfig());
    const reasoningPart = { type: "reasoning", text: "thinking..." } as Record<
      string,
      unknown
    >;
    const output = {
      messages: [{ parts: [reasoningPart] }],
    } as Parameters<
      NonNullable<(typeof hookSet)["experimental.chat.messages.transform"]>
    >[1];
    await hookSet["experimental.chat.messages.transform"]!(
      {} as Parameters<
        NonNullable<(typeof hookSet)["experimental.chat.messages.transform"]>
      >[0],
      output,
    );
    expect(reasoningPart._preserved).toBe(true);
  });

  test("leaves non-reasoning parts untouched", async () => {
    const hookSet = createReasoningContentCacheHook(makeConfig());
    const textPart = { type: "text", text: "answer" } as Record<
      string,
      unknown
    >;
    const output = {
      messages: [{ parts: [textPart] }],
    } as Parameters<
      NonNullable<(typeof hookSet)["experimental.chat.messages.transform"]>
    >[1];
    await hookSet["experimental.chat.messages.transform"]!(
      {} as Parameters<
        NonNullable<(typeof hookSet)["experimental.chat.messages.transform"]>
      >[0],
      output,
    );
    expect(textPart._preserved).toBeUndefined();
  });

  test("handles multiple messages and mixed parts", async () => {
    const hookSet = createReasoningContentCacheHook(makeConfig());
    const r1 = { type: "reasoning" } as Record<string, unknown>;
    const t1 = { type: "text" } as Record<string, unknown>;
    const r2 = { type: "reasoning" } as Record<string, unknown>;
    const output = {
      messages: [{ parts: [r1, t1] }, { parts: [r2] }],
    } as Parameters<
      NonNullable<(typeof hookSet)["experimental.chat.messages.transform"]>
    >[1];
    await hookSet["experimental.chat.messages.transform"]!(
      {} as Parameters<
        NonNullable<(typeof hookSet)["experimental.chat.messages.transform"]>
      >[0],
      output,
    );
    expect(r1._preserved).toBe(true);
    expect(t1._preserved).toBeUndefined();
    expect(r2._preserved).toBe(true);
  });

  test("skips messages without parts", async () => {
    const hookSet = createReasoningContentCacheHook(makeConfig());
    const output = {
      messages: [{ role: "user" }],
    } as Parameters<
      NonNullable<(typeof hookSet)["experimental.chat.messages.transform"]>
    >[1];
    await hookSet["experimental.chat.messages.transform"]!(
      {} as Parameters<
        NonNullable<(typeof hookSet)["experimental.chat.messages.transform"]>
      >[0],
      output,
    );
    expect(output.messages).toHaveLength(1);
  });

  test("edge case: output.messages undefined → no throw", async () => {
    const hookSet = createReasoningContentCacheHook(makeConfig());
    const output = {} as Parameters<
      NonNullable<(typeof hookSet)["experimental.chat.messages.transform"]>
    >[1];
    await hookSet["experimental.chat.messages.transform"]!(
      {} as Parameters<
        NonNullable<(typeof hookSet)["experimental.chat.messages.transform"]>
      >[0],
      output,
    );
    expect(output.messages).toBeUndefined();
  });

  test("edge case: empty messages array → no throw", async () => {
    const hookSet = createReasoningContentCacheHook(makeConfig());
    const output = { messages: [] } as Parameters<
      NonNullable<(typeof hookSet)["experimental.chat.messages.transform"]>
    >[1];
    await hookSet["experimental.chat.messages.transform"]!(
      {} as Parameters<
        NonNullable<(typeof hookSet)["experimental.chat.messages.transform"]>
      >[0],
      output,
    );
    expect(output.messages).toHaveLength(0);
  });
});
