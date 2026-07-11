import { afterEach, beforeEach, describe, expect, test, spyOn } from "bun:test";
import type { BobConfig } from "../types";
import { createTokenBudgetHook } from "./token-budget";

const config = {} as BobConfig;

function makeOutput(messageCount: number) {
  const messages = Array.from({ length: messageCount }, (_, i) => ({
    parts: [{ type: "text", text: `msg ${i}` }],
  }));
  return {
    messages,
  } as Parameters<
    NonNullable<
      ReturnType<
        typeof createTokenBudgetHook
      >["experimental.chat.messages.transform"]
    >
  >[1];
}

describe("token-budget", () => {
  let logSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    logSpy = spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  test("returns a hook set with messages transform defined", () => {
    const hookSet = createTokenBudgetHook(config);
    expect(hookSet["experimental.chat.messages.transform"]).toBeDefined();
    expect(typeof hookSet["experimental.chat.messages.transform"]).toBe(
      "function",
    );
  });

  test("happy path: logs warning when message count exceeds 100", async () => {
    const hookSet = createTokenBudgetHook(config);
    const transform = hookSet["experimental.chat.messages.transform"]!;

    const output = makeOutput(101);
    await transform({} as Parameters<typeof transform>[0], output);

    expect(logSpy).toHaveBeenCalled();
    expect(String(logSpy.mock.calls[0][0])).toContain(
      "[hiai-opencode] Token budget",
    );
  });

  test("no log when message count is exactly 100", async () => {
    const hookSet = createTokenBudgetHook(config);
    const transform = hookSet["experimental.chat.messages.transform"]!;

    const output = makeOutput(100);
    await transform({} as Parameters<typeof transform>[0], output);

    expect(logSpy).not.toHaveBeenCalled();
  });

  test("no log for a small message count", async () => {
    const hookSet = createTokenBudgetHook(config);
    const transform = hookSet["experimental.chat.messages.transform"]!;

    const output = makeOutput(5);
    await transform({} as Parameters<typeof transform>[0], output);

    expect(logSpy).not.toHaveBeenCalled();
  });

  test("edge case: empty messages array → no error, no log", async () => {
    const hookSet = createTokenBudgetHook(config);
    const transform = hookSet["experimental.chat.messages.transform"]!;

    const output = makeOutput(0);
    await transform({} as Parameters<typeof transform>[0], output);

    expect(logSpy).not.toHaveBeenCalled();
  });

  test("edge case: output undefined → no error, no log", async () => {
    const hookSet = createTokenBudgetHook(config);
    const transform = hookSet["experimental.chat.messages.transform"]!;

    await expect(
      transform({} as Parameters<typeof transform>[0], undefined as never),
    ).resolves.toBeUndefined();
    expect(logSpy).not.toHaveBeenCalled();
  });

  test("edge case: messages undefined → no error, no log", async () => {
    const hookSet = createTokenBudgetHook(config);
    const transform = hookSet["experimental.chat.messages.transform"]!;

    const output = {} as Parameters<typeof transform>[1];
    await expect(
      transform({} as Parameters<typeof transform>[0], output),
    ).resolves.toBeUndefined();
    expect(logSpy).not.toHaveBeenCalled();
  });
});
