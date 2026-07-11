import { describe, expect, test } from "bun:test";
import type { BobConfig } from "../types";
import { createContextWindowMonitor } from "./context-window-monitor";

const config = {} as BobConfig;

function makeOutput(system: string[]) {
  return {
    system,
  } as Parameters<
    NonNullable<
      ReturnType<
        typeof createContextWindowMonitor
      >["experimental.chat.system.transform"]
    >
  >[1];
}

describe("context-window-monitor", () => {
  test("returns a hook set with system transform defined", () => {
    const hookSet = createContextWindowMonitor(config);
    expect(hookSet["experimental.chat.system.transform"]).toBeDefined();
    expect(typeof hookSet["experimental.chat.system.transform"]).toBe(
      "function",
    );
  });

  test("happy path: small system context → no warning appended", async () => {
    const hookSet = createContextWindowMonitor(config);
    const transform = hookSet["experimental.chat.system.transform"]!;

    const output = makeOutput(["You are a helpful assistant.", "Be concise."]);
    await transform({} as Parameters<typeof transform>[0], output);

    expect(output.system).toHaveLength(2);
  });

  test("appends warning when context exceeds 70% of 128k capacity", async () => {
    const hookSet = createContextWindowMonitor(config);
    const transform = hookSet["experimental.chat.system.transform"]!;

    // 0.7 * 128000 = 89600; use a string well above that.
    const big = "x".repeat(100_000);
    const output = makeOutput([big]);
    await transform({} as Parameters<typeof transform>[0], output);

    expect(output.system).toHaveLength(2);
    const warning = output.system[1];
    expect(warning).toContain("[hiai-opencode] WARNING");
    expect(warning).toMatch(/Context at \d+% capacity/);
  });

  test("no warning exactly at 70% threshold (ratio must be > 0.7)", async () => {
    const hookSet = createContextWindowMonitor(config);
    const transform = hookSet["experimental.chat.system.transform"]!;

    const exactly = "x".repeat(89_600);
    const output = makeOutput([exactly]);
    await transform({} as Parameters<typeof transform>[0], output);

    expect(output.system).toHaveLength(1);
  });

  test("edge case: empty system array → no error, no mutation", async () => {
    const hookSet = createContextWindowMonitor(config);
    const transform = hookSet["experimental.chat.system.transform"]!;

    const output = makeOutput([]);
    await transform({} as Parameters<typeof transform>[0], output);

    expect(output.system).toHaveLength(0);
  });

  test("edge case: multi-part system joined length drives the ratio", async () => {
    const hookSet = createContextWindowMonitor(config);
    const transform = hookSet["experimental.chat.system.transform"]!;

    const parts = ["a".repeat(50_000), "b".repeat(50_000)]; // 100k joined
    const output = makeOutput(parts);
    await transform({} as Parameters<typeof transform>[0], output);

    expect(output.system).toHaveLength(3);
    expect(String(output.system[2])).toContain("[hiai-opencode] WARNING");
  });
});
