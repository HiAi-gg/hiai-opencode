import { describe, expect, spyOn, test } from "bun:test";
import { CLOSURE_SCHEMA_PROMPT } from "../shared/closure";
import type { BobConfig } from "../types";
import { createClosureInjector } from "./closure-injector";

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

function makeOutput(text: string) {
  return {
    messages: [
      {
        info: {} as unknown,
        parts: [{ type: "text", text }] as unknown[],
      },
    ],
  } as Parameters<
    NonNullable<
      ReturnType<
        typeof createClosureInjector
      >["experimental.chat.messages.transform"]
    >
  >[1];
}

describe("closure-injector", () => {
  test("returns a hook set with messages transform defined", () => {
    const config = makeConfig();
    const hookSet = createClosureInjector(config);
    expect(hookSet["experimental.chat.messages.transform"]).toBeDefined();
    expect(typeof hookSet["experimental.chat.messages.transform"]).toBe(
      "function",
    );
  });

  test("injects CLOSURE schema when no CLOSURE block present", async () => {
    const config = makeConfig();
    const hookSet = createClosureInjector(config);
    const transform = hookSet["experimental.chat.messages.transform"]!;

    const output = makeOutput("Here is my final answer.");
    await transform({} as Parameters<typeof transform>[0], output);

    const lastPart = output.messages[output.messages.length - 1].parts[
      output.messages[output.messages.length - 1].parts.length - 1
    ] as { type: string; text: string };
    expect(lastPart.text).toContain("Here is my final answer.");
    expect(lastPart.text).toContain(CLOSURE_SCHEMA_PROMPT);
    expect(lastPart.text).toMatch(/<CLOSURE_PROTOCOL>/);
  });

  test("preserves an existing valid CLOSURE block unchanged", async () => {
    const config = makeConfig();
    const hookSet = createClosureInjector(config);
    const transform = hookSet["experimental.chat.messages.transform"]!;

    const original =
      'Done.\n\n<CLOSURE>\n{\n  "reasoning": "completed",\n  "evidence": ["x"],\n  "readiness": "done"\n}\n</CLOSURE>';
    const output = makeOutput(original);
    await transform({} as Parameters<typeof transform>[0], output);

    const lastPart = output.messages[output.messages.length - 1].parts[
      output.messages[output.messages.length - 1].parts.length - 1
    ] as { type: string; text: string };
    expect(lastPart.text).toBe(original);
    expect(lastPart.text).not.toContain(CLOSURE_SCHEMA_PROMPT);
  });

  test("edge case: empty messages array → no error, no mutation", async () => {
    const config = makeConfig();
    const hookSet = createClosureInjector(config);
    const transform = hookSet["experimental.chat.messages.transform"]!;

    const output = { messages: [] } as Parameters<typeof transform>[1];
    await transform({} as Parameters<typeof transform>[0], output);

    expect(output.messages).toHaveLength(0);
  });

  test("edge case: last part is not a text part → no injection", async () => {
    const config = makeConfig();
    const hookSet = createClosureInjector(config);
    const transform = hookSet["experimental.chat.messages.transform"]!;

    const output = {
      messages: [
        {
          info: {} as unknown,
          parts: [{ type: "image", image: "base64" }] as unknown[],
        },
      ],
    } as Parameters<typeof transform>[1];
    await transform({} as Parameters<typeof transform>[0], output);

    const lastPart = output.messages[0].parts[0] as { type: string };
    expect(lastPart.type).toBe("image");
  });

  test("malformed CLOSURE (invalid JSON) → logs warning, leaves text unchanged", async () => {
    const config = makeConfig();
    const hookSet = createClosureInjector(config);
    const transform = hookSet["experimental.chat.messages.transform"]!;

    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    try {
      const malformed =
        "Done.\n\n<CLOSURE>\n{ this is not valid json }\n</CLOSURE>";
      const output = makeOutput(malformed);
      await transform({} as Parameters<typeof transform>[0], output);

      const lastPart = output.messages[output.messages.length - 1].parts[
        output.messages[output.messages.length - 1].parts.length - 1
      ] as { type: string; text: string };
      // Text is preserved verbatim (no re-injection)
      expect(lastPart.text).toBe(malformed);
      expect(lastPart.text).not.toContain(CLOSURE_SCHEMA_PROMPT);
      // A warning was logged about the invalid CLOSURE
      expect(logSpy).toHaveBeenCalled();
      expect(logSpy.mock.calls[0][0]).toContain(
        "[hiai-opencode] Invalid CLOSURE",
      );
    } finally {
      logSpy.mockRestore();
    }
  });

  test("malformed CLOSURE (missing required fields) → logs warning", async () => {
    const config = makeConfig();
    const hookSet = createClosureInjector(config);
    const transform = hookSet["experimental.chat.messages.transform"]!;

    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    try {
      const malformed = 'Done.\n\n<CLOSURE>\n{ "foo": "bar" }\n</CLOSURE>';
      const output = makeOutput(malformed);
      await transform({} as Parameters<typeof transform>[0], output);

      expect(logSpy).toHaveBeenCalled();
      expect(logSpy.mock.calls[0][0]).toContain(
        "[hiai-opencode] Invalid CLOSURE",
      );
    } finally {
      logSpy.mockRestore();
    }
  });
});
