import { describe, expect, test } from "bun:test";
import {
  createPlanInvocationInjector,
  setPlanInvocationClient,
} from "./plan-invocation-injector";

interface SessionLike {
  agent?: string;
  parentID?: string;
}

function makeClient(session: SessionLike) {
  return {
    session: {
      get: async () => ({ data: session }),
    },
  } as never;
}

describe("createPlanInvocationInjector", () => {
  test("adds SUBAGENT reminder when plan session has a parentID", async () => {
    const client = makeClient({ agent: "plan", parentID: "parent-session" });
    setPlanInvocationClient(client as never);
    const hookSet = createPlanInvocationInjector({} as never);
    const transform = hookSet["experimental.chat.system.transform"] as (
      input: unknown,
      output: { system: string[] },
    ) => Promise<void>;
    const output = { system: [] };
    await transform({ sessionID: "child-session" }, output);
    expect(output.system.some((s) => s.includes("SUBAGENT"))).toBe(true);
    expect(
      output.system.some((s) => s.includes("USER QUESTIONING IS FORBIDDEN")),
    ).toBe(true);
  });

  test("adds DIRECT reminder when plan session has no parentID", async () => {
    const client = makeClient({ agent: "plan" });
    setPlanInvocationClient(client as never);
    const hookSet = createPlanInvocationInjector({} as never);
    const transform = hookSet["experimental.chat.system.transform"] as (
      input: unknown,
      output: { system: string[] },
    ) => Promise<void>;
    const output = { system: [] };
    await transform({ sessionID: "root-session" }, output);
    expect(output.system.some((s) => s.includes("directly interacting"))).toBe(
      true,
    );
  });

  test("does not inject for non-plan agents", async () => {
    const client = makeClient({ agent: "build", parentID: "parent-session" });
    setPlanInvocationClient(client as never);
    const hookSet = createPlanInvocationInjector({} as never);
    const transform = hookSet["experimental.chat.system.transform"] as (
      input: unknown,
      output: { system: string[] },
    ) => Promise<void>;
    const output = { system: [] };
    await transform({ sessionID: "build-session" }, output);
    expect(output.system).toEqual([]);
  });

  test("does not crash when client is missing", async () => {
    setPlanInvocationClient(null);
    const hookSet = createPlanInvocationInjector({} as never);
    const transform = hookSet["experimental.chat.system.transform"] as (
      input: unknown,
      output: { system: string[] },
    ) => Promise<void>;
    const output = { system: [] };
    await transform({ sessionID: "s" }, output);
    expect(output.system).toEqual([]);
  });

  test("does not crash when session lookup fails", async () => {
    setPlanInvocationClient({
      session: {
        get: async () => {
          throw new Error("session gone");
        },
      },
    } as never);
    const hookSet = createPlanInvocationInjector({} as never);
    const transform = hookSet["experimental.chat.system.transform"] as (
      input: unknown,
      output: { system: string[] },
    ) => Promise<void>;
    const output = { system: [] };
    await transform({ sessionID: "s" }, output);
    expect(output.system).toEqual([]);
  });
});
