/**
 * json-error-recovery.test.ts — Tests for the JSON parse error recovery hook.
 *
 * Verifies the `tool.execute.after` hook detects JSON parse failures in tool
 * output and appends a recovery hint.
 */

import { describe, expect, test } from "bun:test";
import type { BobConfig } from "../types";
import { createJsonErrorRecovery } from "./json-error-recovery";

const config = {} as BobConfig;

function runHook(output: { output?: string }) {
  const hook = createJsonErrorRecovery(config) as any;
  const fn = hook["tool.execute.after"] as (
    _i: unknown,
    o: { output?: string },
  ) => Promise<void>;
  return fn({}, output);
}

describe("createJsonErrorRecovery", () => {
  test("returns a hook set with tool.execute.after", () => {
    const hook = createJsonErrorRecovery(config) as any;
    expect(typeof hook["tool.execute.after"]).toBe("function");
  });

  test("appends recovery hint on JSON parse error", async () => {
    const output: { output?: string } = {
      output: "JSON parse error near line 3",
    };
    await runHook(output);
    expect(output.output).toContain(
      "[hiai-opencode] JSON parse error detected",
    );
  });

  test("appends recovery hint on Unexpected token", async () => {
    const output: { output?: string } = {
      output: "SyntaxError: Unexpected token } in JSON",
    };
    await runHook(output);
    expect(output.output).toContain(
      "[hiai-opencode] JSON parse error detected",
    );
  });

  test("appends recovery hint on SyntaxError", async () => {
    const output: { output?: string } = {
      output: "JSON SyntaxError: bad input",
    };
    await runHook(output);
    expect(output.output).toContain(
      "[hiai-opencode] JSON parse error detected",
    );
  });

  test("does not append when JSON is mentioned without an error keyword", async () => {
    const output: { output?: string } = {
      output: "Returned valid JSON payload",
    };
    await runHook(output);
    expect(output.output).not.toContain("[hiai-opencode]");
  });

  test("does not append when an error keyword appears without JSON", async () => {
    const output: { output?: string } = {
      output: "Unexpected token in expression",
    };
    await runHook(output);
    expect(output.output).not.toContain("[hiai-opencode]");
  });

  test("does not throw when output.output is undefined", async () => {
    const output: { output?: string } = {};
    await expect(runHook(output)).resolves.toBeUndefined();
    expect(output.output).toBeUndefined();
  });
});
