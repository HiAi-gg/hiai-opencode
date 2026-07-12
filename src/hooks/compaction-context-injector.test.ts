import { afterEach, describe, expect, test } from "bun:test";
import type { BobConfig } from "../types";
import * as st from "../features/completion-controller/state";
import { createCompactionContextInjector } from "./compaction-context-injector";

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

describe("compaction-context-injector", () => {
  test("empty input → no error", async () => {
    const config = makeConfig();
    const hookSet = createCompactionContextInjector(config);
    const compacting = hookSet["experimental.session.compacting"];
    expect(compacting).toBeDefined();

    // Empty input — should not throw
    await compacting!(
      {} as Parameters<NonNullable<typeof compacting>>[0],
      {} as Parameters<NonNullable<typeof compacting>>[1],
    );
  });

  test("null output → no error", async () => {
    const config = makeConfig();
    const hookSet = createCompactionContextInjector(config);
    const compacting = hookSet["experimental.session.compacting"];
    expect(compacting).toBeDefined();

    await compacting!(
      {} as Parameters<NonNullable<typeof compacting>>[0],
      null as unknown as Parameters<NonNullable<typeof compacting>>[1],
    );
  });

  test("output.context is undefined → no error", async () => {
    const config = makeConfig();
    const hookSet = createCompactionContextInjector(config);
    const compacting = hookSet["experimental.session.compacting"];
    expect(compacting).toBeDefined();

    // Should not throw when context is absent
    await compacting!(
      {} as Parameters<NonNullable<typeof compacting>>[0],
      {} as Parameters<NonNullable<typeof compacting>>[1],
    );
  });

  test("output.context is empty array → context items pushed", async () => {
    const config = makeConfig();
    const hookSet = createCompactionContextInjector(config);
    const compacting = hookSet["experimental.session.compacting"];
    expect(compacting).toBeDefined();

    const context: string[] = [];
    await compacting!(
      {} as Parameters<NonNullable<typeof compacting>>[0],
      { context } as unknown as Parameters<NonNullable<typeof compacting>>[1],
    );

    expect(context.length).toBeGreaterThan(0);
  });

  test("all preservation instructions are added to context", async () => {
    const config = makeConfig();
    const hookSet = createCompactionContextInjector(config);
    const compacting = hookSet["experimental.session.compacting"];
    expect(compacting).toBeDefined();

    const context: string[] = [];
    await compacting!(
      {} as Parameters<NonNullable<typeof compacting>>[0],
      { context } as unknown as Parameters<NonNullable<typeof compacting>>[1],
    );

    // Check that all key preservation instructions are present
    const joined = context.join(" ");
    expect(joined).toContain("PRESERVE");
    expect(joined).toContain("Task IDs");
    expect(joined).toContain("Progress markers");
    expect(joined).toContain("Agent names");
    expect(joined).toContain("recovery context");
    expect(joined).toContain("File paths");
    expect(joined).toContain("Loop iteration state");
    expect(joined).toContain("Continuation prompts");
  });
});

describe("compaction-context-injector: gate rehydration", () => {
  afterEach(() => {
    // Best-effort cleanup of any sessions these tests create.
    // state.ts doesn't expose a clear-all, so individual clears are enough
    // because each test uses a unique sessionID.
  });

  test("re-injects qualityGateFailed state when set", async () => {
    const config = makeConfig();
    const hookSet = createCompactionContextInjector(config);
    const compacting = hookSet["experimental.session.compacting"];
    const sid = "compaction-test-quality";
    st.setQualityGateFailed(sid, true);
    try {
      const context: string[] = [];
      await compacting!(
        { sessionID: sid } as Parameters<NonNullable<typeof compacting>>[0],
        { context } as unknown as Parameters<NonNullable<typeof compacting>>[1],
      );
      const joined = context.join(" ");
      expect(joined).toContain("GATE");
      expect(joined.toLowerCase()).toContain("quality command");
    } finally {
      st.clear(sid);
    }
  });

  test("re-injects lspPending state when set", async () => {
    const config = makeConfig();
    const hookSet = createCompactionContextInjector(config);
    const compacting = hookSet["experimental.session.compacting"];
    const sid = "compaction-test-lsp";
    st.setLspPending(sid, true);
    try {
      const context: string[] = [];
      await compacting!(
        { sessionID: sid } as Parameters<NonNullable<typeof compacting>>[0],
        { context } as unknown as Parameters<NonNullable<typeof compacting>>[1],
      );
      const joined = context.join(" ");
      expect(joined).toContain("GATE");
      expect(joined.toLowerCase()).toContain("lsp_diagnostics");
    } finally {
      st.clear(sid);
    }
  });

  test("re-injects pending-critic-review state when changes unapproved", async () => {
    const config = makeConfig();
    const hookSet = createCompactionContextInjector(config);
    const compacting = hookSet["experimental.session.compacting"];
    const sid = "compaction-test-critic";
    st.recordChangedFile(sid, "/src/x.ts", false);
    try {
      const context: string[] = [];
      await compacting!(
        { sessionID: sid } as Parameters<NonNullable<typeof compacting>>[0],
        { context } as unknown as Parameters<NonNullable<typeof compacting>>[1],
      );
      const joined = context.join(" ");
      expect(joined).toContain("GATE");
      expect(joined).toContain("Critic");
    } finally {
      st.clear(sid);
    }
  });

  test("does not inject gate hints when gates are clean", async () => {
    const config = makeConfig();
    const hookSet = createCompactionContextInjector(config);
    const compacting = hookSet["experimental.session.compacting"];
    const sid = "compaction-test-clean";
    try {
      const context: string[] = [];
      await compacting!(
        { sessionID: sid } as Parameters<NonNullable<typeof compacting>>[0],
        { context } as unknown as Parameters<NonNullable<typeof compacting>>[1],
      );
      const joined = context.join(" ");
      expect(joined).not.toContain("GATE:");
    } finally {
      st.clear(sid);
    }
  });
});
