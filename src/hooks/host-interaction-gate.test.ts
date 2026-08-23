import { afterEach, describe, expect, test } from "bun:test";
import {
  clearPlanLifecycle,
  recordFrozenPlan,
} from "../features/plan-lifecycle";
import { BlockingHookError } from "./errors";
import {
  createHostInteractionGate,
  setHostInteractionClient,
} from "./host-interaction-gate";

function makeClient(session: { parentID?: string; agent?: string }) {
  return {
    session: {
      get: async () => ({ data: session }),
    },
  } as never;
}

async function before(
  session: { parentID?: string; agent?: string } | null,
  tool = "question",
  sessionID = `host-${crypto.randomUUID()}`,
) {
  setHostInteractionClient(session ? makeClient(session) : null);
  const hook = createHostInteractionGate({} as never);
  const fn = hook["tool.execute.before"] as (
    input: { tool: string; sessionID?: string },
  ) => Promise<void>;
  await fn({ tool, sessionID });
  return sessionID;
}

describe("host-interaction-gate", () => {
  afterEach(() => {
    setHostInteractionClient(null);
  });

  test("allows question when Plan has no parent (direct)", async () => {
    await before({ agent: "plan" });
  });

  test("blocks question when Plan is a Bob subagent", async () => {
    await expect(before({ agent: "plan", parentID: "bob-session" })).rejects.toBeInstanceOf(
      BlockingHookError,
    );
  });

  test("blocks question for other subagents", async () => {
    await expect(
      before({ agent: "build", parentID: "bob-session" }),
    ).rejects.toBeInstanceOf(BlockingHookError);
  });

  test("ignores non-question tools", async () => {
    await before({ agent: "plan", parentID: "x" }, "read");
  });

  test("blocks question while a frozen plan is executing", async () => {
    const sid = `host-frozen-${crypto.randomUUID()}`;
    recordFrozenPlan(sid, "p.md", "x");
    try {
      await expect(before({ agent: "bob" }, "question", sid)).rejects.toBeInstanceOf(
        BlockingHookError,
      );
    } finally {
      clearPlanLifecycle(sid);
    }
  });
});
