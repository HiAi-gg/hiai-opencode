import { describe, expect, it } from "bun:test";
import type { BobConfig } from "../types";
import { createQualityGate } from "./quality-gate";

/**
 * Unit tests for the quality-gate hook (`tool.execute.after`).
 *
 * The implementation (quality-gate.ts) detects errors via strict, structural
 * patterns (word-boundary / diagnostic-signal anchored) rather than naive
 * substring matching. Benign phrases that merely *contain* the word "error"
 * (e.g. "no error", "handling errors correctly") must NOT trip the gate, while
 * genuine diagnostic signals ("error:", "ERR_...", "N errors", "FAIL", etc.)
 * must. Phase 7C finalized this hardening; the target cases below are active
 * (unskipped) tests that lock in the intended behavior.
 */

function makeConfig(): BobConfig {
  // `_config` is unused by createQualityGate; a minimal object satisfies the type.
  return {} as BobConfig;
}

async function runAfter(cmd: string, outputText: string | undefined | null) {
  const hookSet = createQualityGate(makeConfig());
  const after = hookSet["tool.execute.after"] as (
    input: { tool: string; sessionID?: string; args: { command?: string } },
    output: { output?: string | null },
  ) => Promise<void>;
  const input = {
    tool: "bash",
    sessionID: "test-session",
    args: { command: cmd },
  };
  const output = { output: outputText };
  await after(input, output);
  return output;
}

const GATE_MARKER = "QUALITY GATE FAILED";

describe("quality-gate: true positives (error detected)", () => {
  it('flags lowercase "error" in quality-command output', async () => {
    const out = await runAfter(
      "bun test",
      "FAIL 1 test\nerror: expected 1 got 2",
    );
    expect(out.output).toContain(GATE_MARKER);
  });

  it('flags capitalized "Error" in quality-command output', async () => {
    const out = await runAfter(
      "bun run lint",
      "src/x.ts: Error: unused variable",
    );
    expect(out.output).toContain(GATE_MARKER);
  });

  it('flags "ERR" token in quality-command output', async () => {
    const out = await runAfter(
      "bun run typecheck",
      "ERR_MODULE_NOT_FOUND: ./missing",
    );
    expect(out.output).toContain(GATE_MARKER);
  });

  it('flags "TS error" in quality-command output', async () => {
    const out = await runAfter(
      "bun run typecheck",
      "TS error: 2322 type mismatch",
    );
    expect(out.output).toContain(GATE_MARKER);
  });

  it("appends the completion-blocked directive on failure", async () => {
    const out = await runAfter("bun test", "error: boom");
    expect(out.output).toContain(
      "Task completion is blocked until the quality gate passes",
    );
  });
});

describe("quality-gate: negatives (no false gate)", () => {
  it('does NOT gate a non-quality command even if output contains "error"', async () => {
    const out = await runAfter("cat file.txt", "error reading file");
    expect(out.output).not.toContain(GATE_MARKER);
  });

  it("does NOT gate a quality command whose output has no error signal", async () => {
    const out = await runAfter("bun test", "all 12 tests passed in 1.2s");
    expect(out.output).not.toContain(GATE_MARKER);
  });

  it("does NOT gate when output is undefined", async () => {
    const out = await runAfter("bun test", undefined);
    expect(out.output).toBeUndefined();
  });

  it("does NOT gate when output is null", async () => {
    const out = await runAfter("bun test", null);
    expect(out.output).toBeNull();
  });

  it("does NOT gate when output is an empty string", async () => {
    const out = await runAfter("bun test", "");
    expect(out.output).not.toContain(GATE_MARKER);
  });

  it("does NOT gate a non-bash tool", async () => {
    const hookSet = createQualityGate(makeConfig());
    const after = hookSet["tool.execute.after"] as (
      input: { tool: string; args: { command?: string } },
      output: { output?: string | null },
    ) => Promise<void>;
    const output = { output: "error: boom" };
    await after({ tool: "read", args: { command: "bun test" } }, output);
    expect(output.output).not.toContain(GATE_MARKER);
  });
});

describe("quality-gate: 7C hardening target (strict structural detection)", () => {
  // Benign phrases that merely *contain* the word "error" must NOT trip the
  // gate once detection is structural/word-boundary aware.
  it('does NOT flag "no error"', async () => {
    const out = await runAfter("bun test", "no error occurred during the run");
    expect(out.output).not.toContain(GATE_MARKER);
  });

  it('does NOT flag "handling errors correctly"', async () => {
    const out = await runAfter(
      "bun run lint",
      "handling errors correctly is important",
    );
    expect(out.output).not.toContain(GATE_MARKER);
  });

  it('does NOT flag "0 errors" (passing count)', async () => {
    const out = await runAfter("bun run typecheck", "Found 0 errors");
    expect(out.output).not.toContain(GATE_MARKER);
  });
});

describe("quality-gate: structural error signals (positive)", () => {
  // Genuine diagnostic signals must still trip the gate.
  it('flags "TypeError:" diagnostic', async () => {
    const out = await runAfter(
      "bun test",
      "TypeError: Cannot read properties of undefined",
    );
    expect(out.output).toContain(GATE_MARKER);
  });

  it('flags "Found N errors" count (N >= 1)', async () => {
    const out = await runAfter(
      "bun run typecheck",
      "Found 3 errors in 2 files",
    );
    expect(out.output).toContain(GATE_MARKER);
  });

  it('flags all-caps "ERROR" token', async () => {
    const out = await runAfter("bun run lint", "ERROR: lint rule violated");
    expect(out.output).toContain(GATE_MARKER);
  });

  it('flags "FAIL" test-runner output', async () => {
    const out = await runAfter("bun test", "FAIL src/x.test.ts > should work");
    expect(out.output).toContain(GATE_MARKER);
  });

  it('flags "failed" keyword', async () => {
    const out = await runAfter("bun test", "1 failed, 3 passed");
    expect(out.output).toContain(GATE_MARKER);
  });
});
