import { describe, expect, test } from "bun:test";
import type { BobConfig } from "../types";
import { createThinkingBlockValidator } from "./thinking-block-validator";

const config = {} as BobConfig;

function makeOutput(
  messages: Array<{ parts: Array<Record<string, unknown>> }>,
) {
  return {
    messages,
  } as Parameters<
    NonNullable<
      ReturnType<
        typeof createThinkingBlockValidator
      >["experimental.chat.messages.transform"]
    >
  >[1];
}

describe("thinking-block-validator", () => {
  test("returns a hook set with messages transform defined", () => {
    const hookSet = createThinkingBlockValidator(config);
    expect(hookSet["experimental.chat.messages.transform"]).toBeDefined();
    expect(typeof hookSet["experimental.chat.messages.transform"]).toBe(
      "function",
    );
  });

  test("happy path: leaves a valid non-empty thinking block unchanged", async () => {
    const hookSet = createThinkingBlockValidator(config);
    const transform = hookSet["experimental.chat.messages.transform"]!;

    const output = makeOutput([
      { parts: [{ type: "thinking", thinking: "Let me reason about this." }] },
    ]);
    await transform({} as Parameters<typeof transform>[0], output);

    const part = output.messages[0].parts[0] as Record<string, unknown>;
    expect(part.thinking).toBe("Let me reason about this.");
  });

  test("replaces an empty thinking block with placeholder", async () => {
    const hookSet = createThinkingBlockValidator(config);
    const transform = hookSet["experimental.chat.messages.transform"]!;

    const output = makeOutput([
      { parts: [{ type: "thinking", thinking: "" }] },
    ]);
    await transform({} as Parameters<typeof transform>[0], output);

    const part = output.messages[0].parts[0] as Record<string, unknown>;
    expect(part.thinking).toBe("[empty thinking block]");
  });

  test("replaces a missing thinking value with placeholder", async () => {
    const hookSet = createThinkingBlockValidator(config);
    const transform = hookSet["experimental.chat.messages.transform"]!;

    const output = makeOutput([{ parts: [{ type: "thinking" }] }]);
    await transform({} as Parameters<typeof transform>[0], output);

    const part = output.messages[0].parts[0] as Record<string, unknown>;
    expect(part.thinking).toBe("[empty thinking block]");
  });

  test("replaces a non-string thinking value with placeholder", async () => {
    const hookSet = createThinkingBlockValidator(config);
    const transform = hookSet["experimental.chat.messages.transform"]!;

    const output = makeOutput([
      { parts: [{ type: "thinking", thinking: 42 as unknown as string }] },
    ]);
    await transform({} as Parameters<typeof transform>[0], output);

    const part = output.messages[0].parts[0] as Record<string, unknown>;
    expect(part.thinking).toBe("[empty thinking block]");
  });

  test("does not touch non-thinking parts", async () => {
    const hookSet = createThinkingBlockValidator(config);
    const transform = hookSet["experimental.chat.messages.transform"]!;

    const output = makeOutput([
      {
        parts: [
          { type: "text", text: "hello" },
          { type: "thinking", thinking: "" },
        ],
      },
    ]);
    await transform({} as Parameters<typeof transform>[0], output);

    const textPart = output.messages[0].parts[0] as Record<string, unknown>;
    expect(textPart.type).toBe("text");
    expect(textPart.text).toBe("hello");
    const thinkingPart = output.messages[0].parts[1] as Record<string, unknown>;
    expect(thinkingPart.thinking).toBe("[empty thinking block]");
  });

  test("edge case: empty messages array → no error, no mutation", async () => {
    const hookSet = createThinkingBlockValidator(config);
    const transform = hookSet["experimental.chat.messages.transform"]!;

    const output = makeOutput([]);
    await transform({} as Parameters<typeof transform>[0], output);

    expect(output.messages).toHaveLength(0);
  });

  test("edge case: message with no parts → no error", async () => {
    const hookSet = createThinkingBlockValidator(config);
    const transform = hookSet["experimental.chat.messages.transform"]!;

    const output = makeOutput([{ parts: [] }]);
    await transform({} as Parameters<typeof transform>[0], output);

    expect(output.messages[0].parts).toHaveLength(0);
  });

  test("edge case: message with undefined parts → no error", async () => {
    const hookSet = createThinkingBlockValidator(config);
    const transform = hookSet["experimental.chat.messages.transform"]!;

    const output = { messages: [{}] } as Parameters<typeof transform>[1];
    await expect(
      transform({} as Parameters<typeof transform>[0], output),
    ).resolves.toBeUndefined();
  });
});
