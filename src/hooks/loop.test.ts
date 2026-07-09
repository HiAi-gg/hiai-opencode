import { describe, expect, test } from "bun:test";
import {
  buildContinuationPrompt,
  buildRecoveryContext,
  buildRecoveryHint,
  classifyError,
  detectCompletionMarker,
} from "./loop-state";

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
    expect(ctx).toContain("[hiai-opencode]");
  });
});
