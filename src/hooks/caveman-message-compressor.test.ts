import { describe, expect, test } from "bun:test";
import type { BobConfig } from "../types";
import { createCavemanMessageCompressor } from "./caveman-message-compressor";

function makeConfig(overrides: Partial<BobConfig> = {}): BobConfig {
  return {
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

function makeMessages(count: number) {
  const messages = [];
  for (let i = 0; i < count; i++) {
    messages.push({
      info: { role: i % 2 === 0 ? "user" : "assistant" } as const,
      parts: [{ type: "text", text: `message ${i}` }],
    });
  }
  return messages;
}

describe("caveman-message-compressor", () => {
  test("returns empty hook set when caveman disabled", () => {
    const config = makeConfig({
      caveman: { enabled: false } as typeof config.caveman,
    });
    const hookSet = createCavemanMessageCompressor(config);
    expect(hookSet["experimental.chat.messages.transform"]).toBeUndefined();
  });

  test("no-op when below min_messages_to_compress threshold", async () => {
    const config = makeConfig();
    const hookSet = createCavemanMessageCompressor(config);
    const transform = hookSet["experimental.chat.messages.transform"];
    expect(transform).toBeDefined();

    const messages = makeMessages(3); // below 5
    const output = { messages };
    const input = {};

    await transform!(input, output);

    // Messages unchanged
    expect(output.messages).toHaveLength(3);
    for (const msg of output.messages) {
      for (const part of msg.parts) {
        const p = part as { type: string; text: string };
        if (p.type === "text") {
          expect(p.text).not.toContain("caveman");
        }
      }
    }
  });

  test("adds conciseness reminder to last assistant message when threshold met", async () => {
    const config = makeConfig();
    const hookSet = createCavemanMessageCompressor(config);
    const transform = hookSet["experimental.chat.messages.transform"];
    expect(transform).toBeDefined();

    const messages = makeMessages(6); // above 5, last is assistant (index 5)
    const output = { messages };

    await transform!({}, output);

    // Last assistant message should have caveman reminder
    const lastMsg = output.messages[5];
    const lastPart = lastMsg.parts[lastMsg.parts.length - 1] as {
      type: string;
      text: string;
    };
    expect(lastPart.text).toContain("[hiai-opencode] caveman");
  });

  test("only adds conciseness reminder once (idempotent)", async () => {
    const config = makeConfig();
    const hookSet = createCavemanMessageCompressor(config);
    const transform = hookSet["experimental.chat.messages.transform"];
    expect(transform).toBeDefined();

    const messages = makeMessages(6);
    const output = { messages };

    // Apply twice
    await transform!({}, output);
    await transform!({}, output);

    const lastMsg = output.messages[5];
    const lastPart = lastMsg.parts[lastMsg.parts.length - 1] as {
      type: string;
      text: string;
    };
    const occurrences = (lastPart.text.match(/\[hiai-opencode\] caveman/g) ?? [])
      .length;
    expect(occurrences).toBe(1); // Only one, not duplicated
  });

  test("never mutates tool_use/tool_result payloads", async () => {
    const config = makeConfig();
    const hookSet = createCavemanMessageCompressor(config);
    const transform = hookSet["experimental.chat.messages.transform"];
    expect(transform).toBeDefined();

    const messages = [
      {
        info: { role: "user" as const },
        parts: [{ type: "text", text: "hello" }],
      },
      {
        info: { role: "assistant" as const },
        parts: [
          {
            type: "tool_use",
            name: "bash",
            input: "echo hello",
          },
        ],
      },
      {
        info: { role: "user" as const },
        parts: [
          {
            type: "tool_result",
            tool_use_id: "call_123",
            content: [{ type: "text", text: "hello world" }],
          },
        ],
      },
      {
        info: { role: "assistant" as const },
        parts: [{ type: "text", text: "Done" }],
      },
    ];

    const output = { messages };
    const input = {};

    await transform!(input, output);

    // tool_use should be untouched
    const toolUse = output.messages[1].parts[0] as Record<string, unknown>;
    expect(toolUse.type).toBe("tool_use");
    expect(toolUse.name).toBe("bash");
    expect(toolUse.input).toBe("echo hello");

    // tool_result should be untouched
    const toolResult = output.messages[2].parts[0] as Record<string, unknown>;
    expect(toolResult.type).toBe("tool_result");
    expect(
      (toolResult.content as Array<{ type: string; text: string }>)[0].text,
    ).toBe("hello world");
  });

  test("handles empty messages gracefully", async () => {
    const config = makeConfig();
    const hookSet = createCavemanMessageCompressor(config);
    const transform = hookSet["experimental.chat.messages.transform"];
    expect(transform).toBeDefined();

    const output = { messages: [] };
    await transform!({}, output);
    // No crash
    expect(output.messages).toHaveLength(0);
  });

  test("handles null messages gracefully", async () => {
    const config = makeConfig();
    const hookSet = createCavemanMessageCompressor(config);
    const transform = hookSet["experimental.chat.messages.transform"];
    expect(transform).toBeDefined();

    const output = { messages: null as unknown as Array<unknown> };
    await transform!({}, output);
    expect(output.messages).toBeNull();
  });
});
