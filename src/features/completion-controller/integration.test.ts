// End-to-end integration test for the completion-controller's actor.postStop
// lifecycle (Phase 5B).
//
// This exercises the real `createBobCompletionHook` factory and its registered
// `actor.postStop` handler end-to-end: it injects a mock OpenCode client
// (via setCompletionClient) and drives the handler through the three post-stop
// branches — critic verdict capture, auto-continue, and stop-with-summary —
// verifying state transitions, output.continue, and summary injection.
//
// It does NOT touch state.ts or the core decide() logic; it only drives the
// public hook surface and asserts on observable outcomes.

import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { BobConfig } from "../../types";
import { createBobCompletionHook, setCompletionClient } from "./index";
import * as st from "./state";

function makeConfig(
  overrides: Partial<NonNullable<BobConfig["completion"]>> = {},
): BobConfig {
  return {
    completion: {
      enabled: true,
      max_auto_continues: 25,
      require_critic: true,
      ui_globs: [],
      reset_on_user_message: true,
      ...overrides,
    },
  };
}

interface MockMessage {
  info?: { role?: string; id?: string };
  parts?: Array<{
    type?: string;
    text?: string;
    tool?: string;
    state?: { status?: string; output?: string };
  }>;
}

interface CapturedPrompt {
  id: string;
  text: string;
}

/**
 * Build a mock OpenCode client. `messages` returns the supplied message list
 * (used by the read* helpers); `prompt` records any synthetic summary the
 * controller injects so we can assert on it.
 */
function makeMockClient(messages: MockMessage[]) {
  const captured: CapturedPrompt[] = [];
  const client = {
    session: {
      messages: async () => ({ data: messages }),
      prompt: async (input: {
        path: { id: string };
        body: { parts: Array<{ text: string }> };
      }) => {
        captured.push({ id: input.path.id, text: input.body.parts[0].text });
        return {};
      },
      todos: undefined,
    },
  };
  return {
    client: client as unknown as Parameters<typeof setCompletionClient>[0],
    captured,
  };
}

// A transcript that yields both a CLOSURE block (for the summary) and a
// recent bash tool output that binds a port (for endpoint detection).
function summaryTranscript(port = 3000) {
  return [
    {
      info: { role: "tool", id: "t1" },
      parts: [
        {
          type: "tool",
          tool: "bash",
          state: {
            status: "success",
            output: `Server running at http://localhost:${port}/api`,
          },
        },
      ],
    },
    {
      info: { role: "assistant", id: "a1" },
      parts: [
        {
          type: "text",
          text: '<CLOSURE>{"reasoning":"All tasks completed","evidence":["lint pass","tests pass"],"readiness":"done"}</CLOSURE>',
        },
      ],
    },
  ];
}

function uniqueSession(): string {
  return `itest-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

describe("completion-controller integration: actor.postStop lifecycle", () => {
  let run: (input: any, output: any) => Promise<void>;

  beforeEach(() => {
    const hooks = createBobCompletionHook(makeConfig());
    const postStop = hooks["actor.postStop"];
    if (!postStop || typeof postStop.run !== "function") {
      throw new Error("actor.postStop hook was not registered");
    }
    run = postStop.run;
  });

  afterEach(() => {
    setCompletionClient(null);
  });

  test("registers the actor.postStop handler with a peer matcher", () => {
    const hooks = createBobCompletionHook(makeConfig());
    const postStop = hooks["actor.postStop"];
    expect(postStop).toBeDefined();
    expect(postStop.matcher).toEqual({ mode: "peer" });
    expect(typeof postStop.run).toBe("function");
  });

  test("critic subagent captures verdict into the parent session state", async () => {
    const parent = uniqueSession();
    const critic = uniqueSession();
    // Give the parent at least one changed file so the recorded review
    // fingerprint is a real sha1 (empty file list -> "" fingerprint).
    st.recordChangedFile(parent, "/src/x.ts", false);
    const { client } = makeMockClient([
      {
        info: { role: "assistant", id: "c1" },
        parts: [
          {
            type: "text",
            text: '<CLOSURE>{"reasoning":"looks good","evidence":[],"readiness":"accept"}</CLOSURE>',
          },
        ],
      },
    ]);
    setCompletionClient(client);

    const output: { continue?: boolean; reason?: string } = {};
    await run(
      { sessionID: critic, agentType: "critic", parentSessionID: parent },
      output,
    );

    // Critic branch returns early and must NOT set output.continue.
    expect(output.continue).toBeUndefined();
    expect(st.get(parent).criticVerdict).toBe("approved");
    // The reviewed fingerprint is derived from the parent's changed files.
    expect(st.get(parent).reviewedFingerprint).toMatch(/^[0-9a-f]{40}$/);
    st.clear(parent);
    st.clear(critic);
  });

  test("non-critic subagent with incomplete todos -> output.continue + state increment", async () => {
    const parent = uniqueSession();
    const child = uniqueSession();
    st.setHasIncompleteTodos(parent, true);
    const { client } = makeMockClient([]);
    setCompletionClient(client);

    const output: { continue?: boolean; reason?: string } = {};
    await run(
      { sessionID: child, agentType: "build", parentSessionID: parent },
      output,
    );

    expect(output.continue).toBe(true);
    expect(output.reason).toContain("Continue");
    // autoContinues counter advanced on the parent session.
    expect(st.get(parent).autoContinues).toBe(1);
    st.clear(parent);
    st.clear(child);
  });

  test("non-critic subagent at cap with incomplete todos -> stop (no continue)", async () => {
    const parent = uniqueSession();
    const child = uniqueSession();
    st.setHasIncompleteTodos(parent, true);
    st.get(parent).autoContinues = 25; // at cap
    const { client } = makeMockClient([]);
    setCompletionClient(client);

    const output: { continue?: boolean; reason?: string } = {};
    await run(
      { sessionID: child, agentType: "build", parentSessionID: parent },
      output,
    );

    expect(output.continue).toBeUndefined();
    st.clear(parent);
    st.clear(child);
  });

  test("stop path injects a summary containing the detected endpoint", async () => {
    const sid = uniqueSession();
    // No incomplete todos and no changed files -> decide() returns stop(done)
    // without requiring a critic review.
    const { client, captured } = makeMockClient(summaryTranscript(3000));
    setCompletionClient(client);

    const output: { continue?: boolean; reason?: string } = {};
    await run({ sessionID: sid, agentType: "build" }, output);

    // Stop path must NOT set output.continue.
    expect(output.continue).toBeUndefined();
    // Exactly one synthetic summary prompt should have been injected.
    expect(captured.length).toBe(1);
    const summary = captured[0].text;
    expect(summary).toContain("## Bob Summary");
    expect(summary).toContain("**Status:** completed");
    expect(summary).toContain("All tasks completed");
    expect(summary).toContain("Open endpoints");
    expect(summary).toContain("localhost:3000");
    expect(summary).toContain("3000");
    st.clear(sid);
  });

  test("stop path summary still renders when no endpoint is present", async () => {
    const sid = uniqueSession();
    const { client, captured } = makeMockClient([
      {
        info: { role: "assistant", id: "a1" },
        parts: [
          {
            type: "text",
            text: '<CLOSURE>{"reasoning":"done","evidence":[],"readiness":"done"}</CLOSURE>',
          },
        ],
      },
    ]);
    setCompletionClient(client);

    const output: { continue?: boolean; reason?: string } = {};
    await run({ sessionID: sid, agentType: "build" }, output);

    expect(output.continue).toBeUndefined();
    expect(captured.length).toBe(1);
    expect(captured[0].text).toContain("## Bob Summary");
    // No endpoint section when nothing was bound.
    expect(captured[0].text).not.toContain("Open endpoints");
    st.clear(sid);
  });

  test("missing agentType with CLOSURE done -> stop (no continue), summary injected", async () => {
    const sid = uniqueSession();
    const { client, captured } = makeMockClient([
      {
        info: { role: "assistant", id: "a1" },
        parts: [
          {
            type: "text",
            text: '<CLOSURE>{"reasoning":"all done","evidence":[],"readiness":"done"}</CLOSURE>',
          },
        ],
      },
    ]);
    setCompletionClient(client);

    const output: { continue?: boolean; reason?: string } = {};
    // agentType omitted entirely — exercises the resilient fallback path.
    await run({ sessionID: sid }, output);

    // Fallback must NOT auto-continue when the agent signalled completion.
    expect(output.continue).toBeUndefined();
    // A completion summary should still be injected.
    expect(captured.length).toBe(1);
    expect(captured[0].text).toContain("## Bob Summary");
    st.clear(sid);
  });

  test("missing agentType without CLOSURE -> falls through to normal decide (continue)", async () => {
    const parent = uniqueSession();
    const child = uniqueSession();
    st.setHasIncompleteTodos(parent, true);
    const { client } = makeMockClient([]);
    setCompletionClient(client);

    const output: { continue?: boolean; reason?: string } = {};
    // agentType omitted and no CLOSURE block — must not silently stop the loop.
    await run({ sessionID: child, parentSessionID: parent }, output);

    expect(output.continue).toBe(true);
    expect(st.get(parent).autoContinues).toBe(1);
    st.clear(parent);
    st.clear(child);
  });

  test("unrecognized agentType with CLOSURE accept -> stop (no continue)", async () => {
    const sid = uniqueSession();
    const { client, captured } = makeMockClient([
      {
        info: { role: "assistant", id: "a1" },
        parts: [
          {
            type: "text",
            text: '<CLOSURE>{"reasoning":"approved","evidence":[],"readiness":"accept"}</CLOSURE>',
          },
        ],
      },
    ]);
    setCompletionClient(client);

    const output: { continue?: boolean; reason?: string } = {};
    await run({ sessionID: sid, agentType: "some-future-agent" }, output);

    expect(output.continue).toBeUndefined();
    expect(captured.length).toBe(1);
    st.clear(sid);
  });

  test("child changed files are merged into parent before deciding", async () => {
    const parent = uniqueSession();
    const child = uniqueSession();
    // Parent has no incomplete todos but also no changes yet; child recorded a
    // change. After merge the parent should route to review (unreviewed change)
    // rather than stop(done).
    st.recordChangedFile(child, "/src/feature.ts", false);
    const { client } = makeMockClient([]);
    setCompletionClient(client);

    const output: { continue?: boolean; reason?: string } = {};
    await run(
      { sessionID: child, agentType: "build", parentSessionID: parent },
      output,
    );

    expect(st.get(parent).changedFiles).toContain("/src/feature.ts");
    // Unreviewed change + require_critic -> review prompt, which still continues.
    expect(output.continue).toBe(true);
    expect((output.reason ?? "").toLowerCase()).toContain("critic");
    st.clear(parent);
    st.clear(child);
  });

  // NOTE: this must remain the LAST test in the suite. mock.module replaces
  // the `./decide` module for the whole file; even after mock.restore() the
  // already-resolved `index.ts` binding can retain the mock, so keeping it
  // last avoids leaking into the other (real-decide) assertions.
  test("unexpected error in body does not set output.continue", async () => {
    // Force decide() to throw so the top-level try/catch is exercised. The
    // sub-helpers each guard their own I/O, so the only way to reach the
    // top-level catch is an error in the decide()/state path.
    mock.module("./decide", () => ({
      decide: () => {
        throw new Error("simulated decide failure");
      },
    }));
    try {
      const sid = uniqueSession();
      const { client } = makeMockClient([]);
      setCompletionClient(client);

      const output: { continue?: boolean; reason?: string } = {};
      await run({ sessionID: sid, agentType: "build" }, output);

      // Fail-safe: never auto-continue on an unexpected error.
      expect(output.continue).toBeUndefined();
      st.clear(sid);
    } finally {
      mock.restore();
    }
  });
});
