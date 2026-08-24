import { afterEach, describe, expect, test } from "bun:test";
import { BlockingHookError } from "./errors";
import { createPlanWriteGate, setPlanWriteClient } from "./plan-write-gate";

function makeClient(agent: string) {
  return {
    session: {
      get: async () => ({ data: { agent } }),
    },
  } as never;
}

async function before(
  agent: string,
  tool: string,
  args: Record<string, unknown>,
) {
  setPlanWriteClient(makeClient(agent));
  const hook = createPlanWriteGate({} as never);
  const fn = hook["tool.execute.before"] as (
    input: { tool: string; sessionID?: string },
    output: { args?: unknown },
  ) => Promise<void>;
  await fn({ tool, sessionID: "ses_plan" }, { args });
}

describe("plan-write-gate", () => {
  afterEach(() => {
    setPlanWriteClient(null);
  });

  test("allows Plan write under .bob/plans/", async () => {
    await before("plan", "write", { filePath: ".bob/plans/feat.md" });
  });

  test("allows Plan write under .bob/drafts/", async () => {
    await before("plan", "edit", { path: "/repo/.bob/drafts/wip.md" });
  });

  test("blocks Plan write to source files", async () => {
    await expect(
      before("plan", "write", { filePath: "src/agents/plan.ts" }),
    ).rejects.toBeInstanceOf(BlockingHookError);
  });

  test("ignores non-plan agents", async () => {
    await before("build", "write", { filePath: "src/index.ts" });
  });

  test("ignores read tools", async () => {
    await before("plan", "read", { filePath: "src/index.ts" });
  });
});
