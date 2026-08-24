import { afterEach, describe, expect, test } from "bun:test";
import {
  clearPlanLifecycle,
  recordFrozenPlan,
} from "../features/plan-lifecycle";
import type { BobConfig } from "../types";
import {
  createLoopHook,
  isWaveExecutorAgent,
  lastMessageIsTerminalBlock,
  setLoopClient,
} from "./loop";
import {
  buildContinuationPrompt,
  buildRecoveryContext,
  buildRecoveryHint,
  classifyError,
  detectCompletionMarker,
  get,
  reset,
} from "./loop-state";

function makeConfig(overrides?: Partial<BobConfig>): BobConfig {
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
  } as BobConfig;
}

// ── detectCompletionMarker ──

describe("detectCompletionMarker", () => {
  test("detects <promise>DONE</promise> marker", () => {
    expect(detectCompletionMarker("foo <promise>DONE</promise> bar")).toBe(
      true,
    );
  });

  test("detects <promise>DONE</promise> case-insensitive", () => {
    expect(detectCompletionMarker("<promise>done</promise>")).toBe(true);
  });

  test("detects CLOSURE with readiness done", () => {
    const text = `<CLOSURE>
{
  "reasoning": "Task complete",
  "evidence": ["test"],
  "readiness": "done"
}
</CLOSURE>`;
    expect(detectCompletionMarker(text)).toBe(true);
  });

  test("rejects CLOSURE with readiness reject", () => {
    const text = `<CLOSURE>
{
  "reasoning": "Not ready",
  "evidence": [],
  "readiness": "reject"
}
</CLOSURE>`;
    expect(detectCompletionMarker(text)).toBe(false);
  });

  test("rejects CLOSURE with accept readiness", () => {
    const text = `<CLOSURE>
{
  "reasoning": "Approved",
  "evidence": [],
  "readiness": "accept"
}
</CLOSURE>`;
    expect(detectCompletionMarker(text)).toBe(false);
  });

  test("returns false for plain text without markers", () => {
    expect(detectCompletionMarker("just some text")).toBe(false);
  });

  test("returns false for malformed CLOSURE JSON", () => {
    const text = `<CLOSURE>{invalid json}</CLOSURE>`;
    expect(detectCompletionMarker(text)).toBe(false);
  });

  test("returns false for empty string", () => {
    expect(detectCompletionMarker("")).toBe(false);
  });
});

// ── classifyError ──

describe("classifyError", () => {
  test("rate_limit", () => {
    expect(classifyError("rate_limit exceeded")).toBe("rate_limit");
    expect(classifyError("Rate limit hit")).toBe("rate_limit");
    expect(classifyError("HTTP 429 Too Many Requests")).toBe("rate_limit");
  });

  test("auth", () => {
    expect(classifyError("auth error")).toBe("auth");
    expect(classifyError("401 Unauthorized")).toBe("auth");
    expect(classifyError("403 Forbidden")).toBe("auth");
  });

  test("timeout", () => {
    expect(classifyError("timeout")).toBe("timeout");
    expect(classifyError("timed out")).toBe("timeout");
    expect(classifyError("408 Request Timeout")).toBe("timeout");
  });

  test("empty_response", () => {
    expect(classifyError("empty response")).toBe("empty_response");
    expect(classifyError("empty")).toBe("empty_response");
    expect(classifyError("no response")).toBe("empty_response");
  });

  test("context_window_exceeded", () => {
    expect(classifyError("context_length_exceeded")).toBe(
      "context_window_exceeded",
    );
    expect(classifyError("max_tokens exceeded")).toBe(
      "context_window_exceeded",
    );
    expect(classifyError("token limit reached")).toBe(
      "context_window_exceeded",
    );
    expect(classifyError("context window full")).toBe(
      "context_window_exceeded",
    );
  });

  test("server_error", () => {
    expect(classifyError("500 Internal Server Error")).toBe("server_error");
    expect(classifyError("502 Bad Gateway")).toBe("server_error");
    expect(classifyError("503 Service Unavailable")).toBe("server_error");
    expect(classifyError("server error")).toBe("server_error");
    expect(classifyError("internal error")).toBe("server_error");
  });

  test("unknown for unrecognized errors", () => {
    expect(classifyError("something weird happened")).toBe("unknown");
    expect(classifyError("")).toBe("unknown");
    expect(classifyError("foo bar baz")).toBe("unknown");
  });
});

// ── buildRecoveryHint ──

describe("buildRecoveryHint", () => {
  test("returns hint for each error type", () => {
    const types = [
      "rate_limit",
      "auth",
      "timeout",
      "empty_response",
      "context_window_exceeded",
      "server_error",
      "unknown",
    ] as const;
    for (const t of types) {
      const hint = buildRecoveryHint(t);
      expect(hint).toBeTruthy();
      expect(typeof hint).toBe("string");
    }
  });

  test("hints are distinct", () => {
    const hints = new Set(
      (
        [
          "rate_limit",
          "auth",
          "timeout",
          "empty_response",
          "context_window_exceeded",
          "server_error",
          "unknown",
        ] as const
      ).map((t) => buildRecoveryHint(t)),
    );
    expect(hints.size).toBe(7);
  });
});

// ── buildContinuationPrompt ──

describe("buildContinuationPrompt", () => {
  test("includes session ID and task count", () => {
    const prompt = buildContinuationPrompt("ses_abc", 3);
    expect(prompt).toContain("ses_abc");
    expect(prompt).toContain("3");
    expect(prompt).toContain("Continue");
  });

  test("handles zero tasks", () => {
    const prompt = buildContinuationPrompt("ses_xyz", 0);
    expect(prompt).toContain("0");
  });
});

// ── buildRecoveryContext ──

describe("buildRecoveryContext", () => {
  test("prefixes the hint with RECOVERY label", () => {
    const ctx = buildRecoveryContext("Rate limited");
    expect(ctx).toContain("RECOVERY");
    expect(ctx).toContain("Rate limited");
    expect(ctx).not.toContain("[hiai-opencode]");
  });
});

// ── createLoopHook: burst session.idle + idempotency ──

describe("createLoopHook: burst session.idle", () => {
  const sid = "loop-burst-test";

  afterEach(() => {
    reset(sid);
  });

  test("bursty session.idle records only one iteration per cooldown", async () => {
    const hook = createLoopHook(makeConfig({ loop: { cooldownMs: 60_000 } }));
    const fn = hook.event as (input: { event: unknown }) => Promise<void>;

    // Burst of idle pings — only the first should pass shouldContinue().
    for (let i = 0; i < 5; i++) {
      await fn({
        event: { type: "session.idle", properties: { sessionID: sid } },
      });
    }

    // Cooldown is 60s, so only one iteration was recorded.
    expect(get(sid).iterations).toBe(1);
  });

  test("idempotent: repeated identical idle events do not duplicate prompts", async () => {
    const hook = createLoopHook(makeConfig({ loop: { cooldownMs: 60_000 } }));
    const fn = hook.event as (input: { event: unknown }) => Promise<void>;

    for (let i = 0; i < 10; i++) {
      await fn({
        event: { type: "session.idle", properties: { sessionID: sid } },
      });
    }

    // Only one continuation prompt recorded despite 10 idle events.
    expect(get(sid).continuationPrompt).not.toBeNull();
    expect(get(sid).iterations).toBe(1);
  });

  test("continuation prompt uses sanitized short id (no raw session id leak)", async () => {
    const longSid = "sess_abcdefghijklmnopqrstuvwxyz0123456789";
    const hook = createLoopHook(makeConfig({ loop: { cooldownMs: 60_000 } }));
    const fn = hook.event as (input: { event: unknown }) => Promise<void>;

    await fn({
      event: { type: "session.idle", properties: { sessionID: longSid } },
    });

    const prompt = get(longSid).continuationPrompt ?? "";
    expect(prompt).toContain("…");
    expect(prompt).not.toContain(longSid);
    reset(longSid);
  });

  test("session.error resets loop state so a fresh burst can run", async () => {
    const hook = createLoopHook(makeConfig({ loop: { cooldownMs: 60_000 } }));
    const fn = hook.event as (input: { event: unknown }) => Promise<void>;

    await fn({
      event: { type: "session.idle", properties: { sessionID: sid } },
    });
    expect(get(sid).iterations).toBe(1);

    // Error resets the cooldown clock.
    await fn({
      event: { type: "session.error", properties: { sessionID: sid } },
    });
    expect(get(sid).iterations).toBe(0);

    // A new idle right after reset records another iteration.
    await fn({
      event: { type: "session.idle", properties: { sessionID: sid } },
    });
    expect(get(sid).iterations).toBe(1);
  });
});

describe("isWaveExecutorAgent", () => {
  test("Bob and Manager can dispatch waves", () => {
    expect(isWaveExecutorAgent("bob")).toBe(true);
    expect(isWaveExecutorAgent("manager")).toBe(true);
    expect(isWaveExecutorAgent(undefined)).toBe(true);
  });

  test("Plan agent cannot dispatch waves; Bob can even if host mode is plan", () => {
    expect(isWaveExecutorAgent("plan")).toBe(false);
    expect(isWaveExecutorAgent("bob", "plan")).toBe(true);
    expect(isWaveExecutorAgent("build")).toBe(false);
  });
});

describe("lastMessageIsTerminalBlock", () => {
  test("detects envelope Status: blocked", () => {
    expect(
      lastMessageIsTerminalBlock("**Status:** blocked\n**Summary:** x"),
    ).toBe(true);
    expect(lastMessageIsTerminalBlock("Status: blocked")).toBe(true);
    expect(lastMessageIsTerminalBlock("Статус: blocked · ход 12")).toBe(true);
  });

  test("ignores ordinary done envelopes", () => {
    expect(lastMessageIsTerminalBlock("**Status:** done")).toBe(false);
  });
});

describe("createLoopHook: skip autonomous continue", () => {
  const sid = "loop-plan-mode-test";
  let prompted: string[];

  function mockClient(session: {
    agent?: string;
    mode?: string;
    parentID?: string;
    lastText?: string;
  }) {
    prompted = [];
    return {
      session: {
        get: async () => ({ data: session }),
        messages: async () => ({
          data: [
            {
              info: { role: "assistant" },
              parts: [{ type: "text", text: session.lastText ?? "" }],
            },
          ],
        }),
        prompt: async (req: {
          body?: { parts?: Array<{ text?: string }> };
        }) => {
          prompted.push(req.body?.parts?.[0]?.text ?? "");
        },
      },
    } as never;
  }

  afterEach(() => {
    reset(sid);
    clearPlanLifecycle(sid);
    setLoopClient(null);
  });

  test("does not poke Plan agent to dispatch frozen waves", async () => {
    recordFrozenPlan(sid, ".bob/plans/x.md", "abc");
    setLoopClient(mockClient({ agent: "plan" }));
    const hook = createLoopHook(makeConfig({ loop: { cooldownMs: 0 } }));
    const fn = hook.event as (input: { event: unknown }) => Promise<void>;
    await fn({
      event: { type: "session.idle", properties: { sessionID: sid } },
    });
    expect(prompted).toEqual([]);
  });

  test("Bob still receives dispatch prompt after a false plan-mode block", async () => {
    recordFrozenPlan(sid, ".bob/plans/x.md", "abc");
    setLoopClient(
      mockClient({
        agent: "bob",
        lastText: "**Status:** blocked\nPlan mode forbids waves",
      }),
    );
    const hook = createLoopHook(makeConfig({ loop: { cooldownMs: 0 } }));
    const fn = hook.event as (input: { event: unknown }) => Promise<void>;
    await fn({
      event: { type: "session.idle", properties: { sessionID: sid } },
    });
    expect(prompted.length).toBe(1);
    expect(prompted[0]).toContain("not Plan");
    expect(get(sid).isCompleted).toBe(false);
  });

  test("Bob with a frozen plan receives a dispatch-waves continue", async () => {
    recordFrozenPlan(sid, ".bob/plans/x.md", "abc");
    setLoopClient(mockClient({ agent: "bob", lastText: "**Status:** done" }));
    const hook = createLoopHook(makeConfig({ loop: { cooldownMs: 0 } }));
    const fn = hook.event as (input: { event: unknown }) => Promise<void>;
    await fn({
      event: { type: "session.idle", properties: { sessionID: sid } },
    });
    expect(prompted.length).toBe(1);
    expect(prompted[0]).toContain("Dispatch the next wave NOW");
    expect(prompted[0]).not.toContain("Continue the frozen plan autonomously");
  });
});
