/**
 * edit-error-recovery.test.ts — Tests for the edit error recovery hook.
 *
 * Verifies the `tool.execute.after` hook detects failed `edit` tool calls
 * (oldString not found / No match) and appends a recovery hint to the output.
 */

import { describe, expect, test } from "bun:test";
import { createEditErrorRecovery } from "./edit-error-recovery";
import type { BobConfig } from "../types";

const config = {} as BobConfig;

function runHook(input: unknown, output: { output?: string }) {
  const hook = createEditErrorRecovery(config) as any;
  const fn = hook["tool.execute.after"] as (
    i: unknown,
    o: { output?: string },
  ) => Promise<void>;
  return fn(input, output);
}

describe("createEditErrorRecovery", () => {
  test("returns a hook set with tool.execute.after", () => {
    const hook = createEditErrorRecovery(config) as any;
    expect(typeof hook["tool.execute.after"]).toBe("function");
  });

  test("appends recovery hint when edit fails with oldString not found", async () => {
    const output: { output?: string } = {
      output: "Error: oldString not found in file",
    };
    await runHook({ tool: "edit" }, output);
    expect(output.output).toContain("oldString not found");
    expect(output.output).toContain("[hiai-opencode] Edit target not found");
  });

  test("appends recovery hint when edit fails with No match", async () => {
    const output: { output?: string } = {
      output: "No match for the given oldString",
    };
    await runHook({ tool: "edit" }, output);
    expect(output.output).toContain("[hiai-opencode] Edit target not found");
  });

  test("does not append when the tool is not edit", async () => {
    const output: { output?: string } = { output: "oldString not found" };
    await runHook({ tool: "write" }, output);
    expect(output.output).not.toContain("[hiai-opencode]");
  });

  test("does not append when output has no edit error markers", async () => {
    const output: { output?: string } = { output: "File written successfully" };
    await runHook({ tool: "edit" }, output);
    expect(output.output).not.toContain("[hiai-opencode]");
  });

  test("does not throw when output.output is undefined", async () => {
    const output: { output?: string } = {};
    await expect(runHook({ tool: "edit" }, output)).resolves.toBeUndefined();
    expect(output.output).toBeUndefined();
  });

  test("does not append for a non-edit tool even with error markers", async () => {
    const output: { output?: string } = { output: "oldString not found" };
    await runHook({ tool: "bash" }, output);
    expect(output.output).not.toContain("[hiai-opencode]");
  });
});
