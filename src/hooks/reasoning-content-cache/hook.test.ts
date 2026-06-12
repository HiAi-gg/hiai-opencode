import { beforeEach, describe, expect, test } from "bun:test";

import { reasoningContentCache } from "../../shared/reasoning-content-cache";
import { createReasoningContentCacheHook } from "./hook";

const SESSION = "sess-reasoning-guard";

type AnyPart = Record<string, unknown> & { type: string };
type AnyMsg = { info: Record<string, unknown>; parts: AnyPart[] };

function assistant(parts: AnyPart[], extra: Record<string, unknown> = {}): AnyMsg {
  return {
    info: { role: "assistant", sessionID: SESSION, ...extra },
    parts,
  };
}

function user(text: string): AnyMsg {
  return {
    info: { role: "user", sessionID: SESSION },
    parts: [{ type: "text", text }],
  };
}

function reasoningPart(text: string): AnyPart {
  return { type: "reasoning", text };
}

function toolPart(): AnyPart {
  return { type: "tool", state: { status: "completed" } };
}

async function run(messages: AnyMsg[]): Promise<AnyMsg[]> {
  const hook = createReasoningContentCacheHook();
  const output = { messages } as unknown as {
    messages: { info: import("@opencode-ai/sdk").Message; parts: import("@opencode-ai/sdk").Part[] }[];
  };
  await hook["experimental.chat.messages.transform"]({} as Record<string, never>, output);
  return output.messages as unknown as AnyMsg[];
}

function reasoningTextOf(msg: AnyMsg): string | null {
  const part = msg.parts.find((p) => p.type === "reasoning");
  return part ? ((part.text as string) ?? null) : null;
}

describe("reasoning-content-cache hook: tool-call reasoning-part guarantee", () => {
  beforeEach(() => {
    reasoningContentCache.clearAll();
  });

  test("injects a non-empty reasoning part into a tool-call assistant message that lacks one", async () => {
    const messages = [
      user("do the thing"),
      // a prior turn that DID reason -> establishes unsigned-reasoning context
      assistant([reasoningPart("first step thoughts"), { type: "text", text: "ok" }]),
      user("continue"),
      // the offending message: tool call but NO reasoning part
      assistant([{ type: "text", text: "" }, toolPart()]),
    ];

    const out = await run(messages);

    const offending = out[3];
    const text = reasoningTextOf(offending);
    expect(text).not.toBeNull();
    expect((text ?? "").length).toBeGreaterThan(0);
  });

  test("restores the real cached reasoning (by id) as the part text when available", async () => {
    reasoningContentCache.saveById(SESSION, "msg-tool-1", "the real reasoning");

    const messages = [
      user("q"),
      assistant([reasoningPart("earlier")]),
      assistant([toolPart()], { id: "msg-tool-1" }),
    ];

    const out = await run(messages);
    expect(reasoningTextOf(out[2])).toBe("the real reasoning");
  });

  test("does NOT inject when the message already has a reasoning part", async () => {
    const messages = [
      user("q"),
      assistant([reasoningPart("kept"), toolPart()]),
    ];

    const out = await run(messages);
    const parts = out[1].parts.filter((p) => p.type === "reasoning");
    expect(parts.length).toBe(1);
    expect(parts[0].text).toBe("kept");
  });

  test("does NOT inject into an assistant message with no tool part", async () => {
    const messages = [
      user("q"),
      assistant([reasoningPart("ctx")]),
      assistant([{ type: "text", text: "just text, no tool call" }]),
    ];

    const out = await run(messages);
    expect(reasoningTextOf(out[2])).toBeNull();
  });

  test("does NOT inject unsigned reasoning when Anthropic signed thinking is present (leave to thinking-block-validator)", async () => {
    const messages = [
      user("q"),
      assistant([
        { type: "thinking", thinking: "signed", signature: "abc123" },
        { type: "text", text: "ok" },
      ]),
      user("continue"),
      assistant([toolPart()]),
    ];

    const out = await run(messages);
    expect(reasoningTextOf(out[3])).toBeNull();
  });

  test("does NOT inject when there is no reasoning signal anywhere (non-reasoning session)", async () => {
    const messages = [
      user("q"),
      assistant([{ type: "text", text: "answer" }, toolPart()]),
    ];

    const out = await run(messages);
    expect(reasoningTextOf(out[1])).toBeNull();
  });
});
