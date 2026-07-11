import { describe, expect, test } from "bun:test";
import type { BobConfig } from "../types";
import { createAgentUsageReminder } from "./agent-usage-reminder";

function makeConfig(overrides: Partial<BobConfig> = {}): BobConfig {
  return {
    models: { bob: { model: "openai/gpt-5.5" } },
    ...overrides,
  };
}

const REMINDER =
  "[hiai-opencode] Reminder: Use the task tool to track multi-step work for better continuity.";

describe("agent-usage-reminder", () => {
  test("returns a hook set with tool.execute.after and dispose", () => {
    const hookSet = createAgentUsageReminder(makeConfig());
    expect(hookSet["tool.execute.after"]).toBeDefined();
    expect(typeof hookSet["tool.execute.after"]).toBe("function");
    expect(hookSet.dispose).toBeDefined();
    expect(typeof hookSet.dispose).toBe("function");
  });

  test('skips the "task" tool without counting', async () => {
    const hookSet = createAgentUsageReminder(makeConfig());
    const output = { output: "result" };
    await hookSet["tool.execute.after"]!(
      { tool: "task", sessionID: "sid_skip" } as never,
      output as never,
    );
    expect(output.output).toBe("result");
  });

  test("counts non-task tool calls per session", async () => {
    const hookSet = createAgentUsageReminder(makeConfig());
    let lastOutput = { output: "" };
    for (let i = 1; i <= 5; i++) {
      lastOutput = { output: "" };
      await hookSet["tool.execute.after"]!(
        { tool: "read", sessionID: "sid_count" } as never,
        lastOutput as never,
      );
    }
    // No reminder before count 10.
    expect(lastOutput.output).toBe("");
  });

  test("appends reminder exactly at count 10", async () => {
    const hookSet = createAgentUsageReminder(makeConfig());
    let lastOutput = { output: "" };
    for (let i = 1; i <= 10; i++) {
      lastOutput = { output: "" };
      await hookSet["tool.execute.after"]!(
        { tool: "read", sessionID: "sid_10" } as never,
        lastOutput as never,
      );
    }
    expect(lastOutput.output).toContain(REMINDER);
    expect(lastOutput.output).toContain("task tool");
  });

  test("does not append between 11 and 19", async () => {
    const hookSet = createAgentUsageReminder(makeConfig());
    // A single persistent output object accumulates reminders across calls.
    const output = { output: "" };
    for (let i = 1; i <= 19; i++) {
      await hookSet["tool.execute.after"]!(
        { tool: "read", sessionID: "sid_19" } as never,
        output as never,
      );
    }
    // Only the count-10 reminder should have fired.
    const reminderCount = (
      output.output.match(/\[hiai-opencode\] Reminder/g) ?? []
    ).length;
    expect(reminderCount).toBe(1);
  });

  test("appends again at count 20 (multiple of 20)", async () => {
    const hookSet = createAgentUsageReminder(makeConfig());
    const output = { output: "" };
    for (let i = 1; i <= 20; i++) {
      await hookSet["tool.execute.after"]!(
        { tool: "read", sessionID: "sid_20" } as never,
        output as never,
      );
    }
    // Reminder at 10 and at 20.
    const reminderCount = (
      output.output.match(/\[hiai-opencode\] Reminder/g) ?? []
    ).length;
    expect(reminderCount).toBe(2);
  });

  test("appends to existing output rather than overwriting", async () => {
    const hookSet = createAgentUsageReminder(makeConfig());
    let lastOutput = { output: "prior content" };
    for (let i = 1; i <= 10; i++) {
      lastOutput = { output: "prior content" };
      await hookSet["tool.execute.after"]!(
        { tool: "read", sessionID: "sid_append" } as never,
        lastOutput as never,
      );
    }
    expect(lastOutput.output).toContain("prior content");
    expect(lastOutput.output).toContain(REMINDER);
  });

  test("handles undefined output.output at the reminder boundary", async () => {
    const hookSet = createAgentUsageReminder(makeConfig());
    let lastOutput: { output?: string } = {};
    for (let i = 1; i <= 10; i++) {
      lastOutput = {};
      await hookSet["tool.execute.after"]!(
        { tool: "read", sessionID: "sid_undef" } as never,
        lastOutput as never,
      );
    }
    expect(lastOutput.output).toContain(REMINDER);
  });

  test("tracks sessions independently", async () => {
    const hookSet = createAgentUsageReminder(makeConfig());
    for (let i = 1; i <= 10; i++) {
      await hookSet["tool.execute.after"]!(
        { tool: "read", sessionID: "sid_a" } as never,
        { output: "" } as never,
      );
    }
    // sid_b has only 3 calls → no reminder yet.
    let sidBOutput = { output: "" };
    for (let i = 1; i <= 3; i++) {
      sidBOutput = { output: "" };
      await hookSet["tool.execute.after"]!(
        { tool: "read", sessionID: "sid_b" } as never,
        sidBOutput as never,
      );
    }
    expect(sidBOutput.output).toBe("");
  });

  test("dispose clears counts so a new cycle starts fresh", async () => {
    const hookSet = createAgentUsageReminder(makeConfig());
    let firstOutput = { output: "" };
    for (let i = 1; i <= 10; i++) {
      firstOutput = { output: "" };
      await hookSet["tool.execute.after"]!(
        { tool: "read", sessionID: "sid_dispose" } as never,
        firstOutput as never,
      );
    }
    expect(firstOutput.output).toContain(REMINDER);
    await hookSet.dispose!();
    // After dispose, the same session starts from 0 again.
    let secondOutput = { output: "" };
    for (let i = 1; i <= 10; i++) {
      secondOutput = { output: "" };
      await hookSet["tool.execute.after"]!(
        { tool: "read", sessionID: "sid_dispose" } as never,
        secondOutput as never,
      );
    }
    expect(secondOutput.output).toContain(REMINDER);
  });
});
