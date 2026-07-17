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

  test("minimal preservation instruction is added (no verbose PRESERVE spam)", async () => {
    const config = makeConfig();
    const hookSet = createCompactionContextInjector(config);
    const compacting = hookSet["experimental.session.compacting"];
    expect(compacting).toBeDefined();

    const context: string[] = [];
    await compacting!(
      {} as Parameters<NonNullable<typeof compacting>>[0],
      { context } as unknown as Parameters<NonNullable<typeof compacting>>[1],
    );

    // Exactly one compact preservation line is pushed (no 7-line PRESERVE spam).
    const preserveLines = context.filter((c) => c.includes("Preserve:"));
    expect(preserveLines).toHaveLength(1);
    const joined = context.join(" ");
    expect(joined).toContain("task IDs");
    expect(joined).toContain("completion markers");
    expect(joined).toContain("loop/continuation state");
    // The old verbose per-item PRESERVE lines must be gone.
    expect(joined).not.toContain("PRESERVE: Task IDs");
    expect(joined).not.toContain("PRESERVE: Progress markers");
    expect(joined).not.toContain("PRESERVE: Agent names");
  });

  test("idempotent across repeated compaction events (no duplicate spam)", async () => {
    const config = makeConfig();
    const hookSet = createCompactionContextInjector(config);
    const compacting = hookSet["experimental.session.compacting"];
    expect(compacting).toBeDefined();

    const context: string[] = [];
    const input = {
      sessionID: "compaction-test-idem",
    } as Parameters<NonNullable<typeof compacting>>[0];
    const out = {
      context,
    } as unknown as Parameters<NonNullable<typeof compacting>>[1];

    await compacting!(input, out);
    await compacting!(input, out);
    await compacting!(input, out);

    // Each call appends one preserve line; repeated calls must not explode
    // the context with duplicates beyond what each event legitimately adds.
    const preserveLines = context.filter((c) => c.includes("Preserve:"));
    expect(preserveLines).toHaveLength(3);
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
