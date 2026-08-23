import { describe, expect, test } from "bun:test";
import type { BobConfig } from "../types";
import { createWorktreeLifecycleHook } from "./worktree-lifecycle";

describe("worktree-lifecycle", () => {
  test("disabled config returns an empty hook set", () => {
    const hook = createWorktreeLifecycleHook({
      worktreeConfig: { enabled: false, base_dir: ".tmp" },
    } as BobConfig);
    expect(hook["chat.message"]).toBeUndefined();
    expect(hook["tool.execute.after"]).toBeUndefined();
  });

  test("does not auto-create on chat.message plan phrases", () => {
    const hook = createWorktreeLifecycleHook({
      worktreeConfig: { enabled: true, base_dir: ".tmp" },
    } as BobConfig);
    expect(hook["chat.message"]).toBeUndefined();
    expect(typeof hook["tool.execute.after"]).toBe("function");
  });
});
