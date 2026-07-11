import { describe, expect, test } from "bun:test";
import type { BobConfig } from "../types";
import { createToolPairValidator } from "./tool-pair-validator";

const config = {} as BobConfig;

function makeOutput(
  messages: Array<{ parts: Array<Record<string, unknown>> }>,
) {
  return {
    messages,
  } as Parameters<
    NonNullable<
      ReturnType<
        typeof createToolPairValidator
      >["experimental.chat.messages.transform"]
    >
  >[1];
}

describe("tool-pair-validator", () => {
  test("returns a hook set with messages transform defined", () => {
    const hookSet = createToolPairValidator(config);
    expect(hookSet["experimental.chat.messages.transform"]).toBeDefined();
    expect(typeof hookSet["experimental.chat.messages.transform"]).toBe(
      "function",
    );
  });

  test("happy path: injects tool_result placeholder when tool_use has no tool_result", async () => {
    const hookSet = createToolPairValidator(config);
    const transform = hookSet["experimental.chat.messages.transform"]!;

    const output = makeOutput([
      { parts: [{ type: "tool_use", tool_use_id: "abc", name: "read" }] },
    ]);
    await transform({} as Parameters<typeof transform>[0], output);

    const parts = output.messages[0].parts;
    expect(parts).toHaveLength(2);
    const injected = parts[1] as Record<string, unknown>;
    expect(injected.type).toBe("tool_result");
    expect(injected.tool_use_id).toBe("missing");
    expect(injected.is_error).toBe(true);
    expect(typeof injected.content).toBe("string");
  });

  test("does not inject when tool_use already paired with tool_result", async () => {
    const hookSet = createToolPairValidator(config);
    const transform = hookSet["experimental.chat.messages.transform"]!;

    const output = makeOutput([
      {
        parts: [
          { type: "tool_use", tool_use_id: "abc", name: "read" },
          { type: "tool_result", tool_use_id: "abc", content: "ok" },
        ],
      },
    ]);
    await transform({} as Parameters<typeof transform>[0], output);

    expect(output.messages[0].parts).toHaveLength(2);
  });

  test("does not inject when only tool_result present (no tool_use)", async () => {
    const hookSet = createToolPairValidator(config);
    const transform = hookSet["experimental.chat.messages.transform"]!;

    const output = makeOutput([
      { parts: [{ type: "tool_result", tool_use_id: "abc", content: "ok" }] },
    ]);
    await transform({} as Parameters<typeof transform>[0], output);

    expect(output.messages[0].parts).toHaveLength(1);
  });

  test("handles multiple messages independently", async () => {
    const hookSet = createToolPairValidator(config);
    const transform = hookSet["experimental.chat.messages.transform"]!;

    const output = makeOutput([
      { parts: [{ type: "tool_use", tool_use_id: "a", name: "read" }] },
      { parts: [{ type: "text", text: "hi" }] },
      {
        parts: [
          { type: "tool_use", tool_use_id: "b", name: "write" },
          { type: "tool_result", tool_use_id: "b", content: "ok" },
        ],
      },
    ]);
    await transform({} as Parameters<typeof transform>[0], output);

    expect(output.messages[0].parts).toHaveLength(2);
    expect(output.messages[1].parts).toHaveLength(1);
    expect(output.messages[2].parts).toHaveLength(2);
  });

  test("edge case: empty messages array → no error, no mutation", async () => {
    const hookSet = createToolPairValidator(config);
    const transform = hookSet["experimental.chat.messages.transform"]!;

    const output = makeOutput([]);
    await transform({} as Parameters<typeof transform>[0], output);

    expect(output.messages).toHaveLength(0);
  });

  test("edge case: message with no parts → no error", async () => {
    const hookSet = createToolPairValidator(config);
    const transform = hookSet["experimental.chat.messages.transform"]!;

    const output = makeOutput([{ parts: [] }]);
    await transform({} as Parameters<typeof transform>[0], output);

    expect(output.messages[0].parts).toHaveLength(0);
  });

  test("edge case: message with undefined parts → no error", async () => {
    const hookSet = createToolPairValidator(config);
    const transform = hookSet["experimental.chat.messages.transform"]!;

    const output = { messages: [{}] } as Parameters<typeof transform>[1];
    await expect(
      transform({} as Parameters<typeof transform>[0], output),
    ).resolves.toBeUndefined();
  });
});
