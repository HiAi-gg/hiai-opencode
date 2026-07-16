import { describe, expect, test } from "bun:test";
import { createAgentUsageReminder } from "./agent-usage-reminder";

describe("agent-usage-reminder", () => {
  test("never modifies TUI-visible tool output", async () => {
    const hookSet = createAgentUsageReminder({} as never);
    const output = {
      output: "const privateImplementation = 'must remain native output';",
    };

    for (let i = 0; i < 40; i++) {
      await hookSet["tool.execute.after"]!(
        { tool: "read", sessionID: "sid" } as never,
        output as never,
      );
    }

    expect(output.output).toBe(
      "const privateImplementation = 'must remain native output';",
    );
    expect(output.output).not.toContain("[hiai-opencode]");
  });
});
