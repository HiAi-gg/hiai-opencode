import { describe, expect, it } from "bun:test";
import type { BobConfig } from "../types";
import { createNonInteractiveEnv } from "./non-interactive-env";

/**
 * Unit tests for the non-interactive-env hook (`tool.execute.before`).
 *
 * The hook blocks commands whose first whitespace-delimited, lowercased token
 * is in INTERACTIVE_CMDS by replacing the command with a non-interactive
 * `echo` notice. Safe (non-interactive) commands pass through unchanged.
 *
 * INTERACTIVE_CMDS is mirrored here from non-interactive-env.ts; if the source
 * list changes, this mirror must be updated to keep coverage accurate.
 */

const INTERACTIVE_CMDS = [
  "vim",
  "vi",
  "nano",
  "less",
  "more",
  "htop",
  "top",
  "man",
  "ssh",
];

function makeConfig(): BobConfig {
  return {} as BobConfig;
}

function runBefore(command: string, tool = "bash") {
  const hookSet = createNonInteractiveEnv(makeConfig());
  const before = hookSet["tool.execute.before"] as (
    input: { tool: string },
    output: { args: { command?: string } },
  ) => Promise<void> | void;
  const input = { tool };
  const output = { args: { command } };
  before(input, output);
  return output;
}

describe("non-interactive-env: interactive commands are blocked", () => {
  for (const cmd of INTERACTIVE_CMDS) {
    it(`blocks "${cmd}"`, () => {
      const out = runBefore(`${cmd} somefile.txt`);
      expect(out.args.command).toContain("[hiai-opencode]");
      expect(out.args.command).toContain(`'${cmd}' is interactive`);
    });
  }

  it("blocks an interactive command regardless of trailing arguments", () => {
    const out = runBefore("ssh user@host -p 2222");
    expect(out.args.command).toContain("'ssh' is interactive");
  });

  it("blocks an interactive command with surrounding whitespace (trim handling)", () => {
    const out = runBefore("   vim   file.txt   ");
    expect(out.args.command).toContain("'vim' is interactive");
  });

  it("blocks an interactive command given in uppercase", () => {
    const out = runBefore("VIM file.txt");
    expect(out.args.command).toContain("'vim' is interactive");
  });
});

describe("non-interactive-env: safe commands pass through", () => {
  const SAFE_CMDS = [
    "ls -la",
    "cat file.txt",
    "git status",
    "git",
    "echo hello",
    "pwd",
    "grep foo bar",
  ];

  for (const cmd of SAFE_CMDS) {
    it(`passes through "${cmd}" unchanged`, () => {
      const out = runBefore(cmd);
      expect(out.args.command).toBe(cmd);
    });
  }
});

describe("non-interactive-env: edge cases", () => {
  it("leaves an empty command unchanged", () => {
    const out = runBefore("");
    expect(out.args.command).toBe("");
  });

  it("leaves a whitespace-only command unchanged", () => {
    const out = runBefore("   ");
    expect(out.args.command).toBe("   ");
  });

  it("does not block interactive commands for non-bash tools", () => {
    const out = runBefore("vim file.txt", "read");
    expect(out.args.command).toBe("vim file.txt");
  });

  it("handles a missing command arg without throwing", () => {
    const hookSet = createNonInteractiveEnv(makeConfig());
    const before = hookSet["tool.execute.before"] as (
      input: { tool: string },
      output: { args: { command?: string } },
    ) => Promise<void> | void;
    const output: { args: { command?: string } } = { args: {} };
    expect(() => before({ tool: "bash" }, output)).not.toThrow();
    expect(output.args.command).toBeUndefined();
  });
});
