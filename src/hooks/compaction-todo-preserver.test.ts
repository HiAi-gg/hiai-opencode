import { describe, expect, test } from "bun:test";
import type { BobConfig } from "../types";
import { createCompactionTodoPreserverHook } from "./compaction-todo-preserver";

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

describe("compaction-todo-preserver", () => {
  test("empty input → no error", async () => {
    const config = makeConfig();
    const hookSet = createCompactionTodoPreserverHook(config);
    const compacting = hookSet["experimental.session.compacting"];
    expect(compacting).toBeDefined();

    await compacting!(
      {} as Parameters<NonNullable<typeof compacting>>[0],
      {} as Parameters<NonNullable<typeof compacting>>[1],
    );
  });

  test("null output → no error", async () => {
    const config = makeConfig();
    const hookSet = createCompactionTodoPreserverHook(config);
    const compacting = hookSet["experimental.session.compacting"];
    expect(compacting).toBeDefined();

    await compacting!(
      {} as Parameters<NonNullable<typeof compacting>>[0],
      null as unknown as Parameters<NonNullable<typeof compacting>>[1],
    );
  });

  test("context gets Preserve all TODO instruction", async () => {
    const config = makeConfig();
    const hookSet = createCompactionTodoPreserverHook(config);
    const compacting = hookSet["experimental.session.compacting"];
    expect(compacting).toBeDefined();

    const context: string[] = [];
    await compacting!(
      {} as Parameters<NonNullable<typeof compacting>>[0],
      { context } as unknown as Parameters<NonNullable<typeof compacting>>[1],
    );

    expect(context).toContain(
      "[hiai-opencode] Preserve open TODO items and their status.",
    );
  });

  test("output without context key → no error", async () => {
    const config = makeConfig();
    const hookSet = createCompactionTodoPreserverHook(config);
    const compacting = hookSet["experimental.session.compacting"];
    expect(compacting).toBeDefined();

    // Should not throw when context is absent entirely
    await compacting!(
      {} as Parameters<NonNullable<typeof compacting>>[0],
      { other: "field" } as unknown as Parameters<
        NonNullable<typeof compacting>
      >[1],
    );
  });
});
