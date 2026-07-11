import { describe, expect, test } from "bun:test";
import { createLegalGate } from "./legal-gate";
import { BlockingHookError } from "./errors";

// Phase 7A — legal-gate hard-deny pattern tests.
//
// The gate is exercised through the public `createLegalGate()` surface:
//   - `tool.execute.before` throws BlockingHookError when a deny pattern matches args
//   - `tool.execute.after` prepends a Context7 routing advisory for framework docs
//
// `findDenyMatch` itself is not exported, so we assert behavior via the hook.

const gate = createLegalGate();
const before = gate["tool.execute.before"]!;
const after = gate["tool.execute.after"]!;

// Run the before-hook and return the thrown BlockingHookError (or null if it passed).
async function denyError(args: unknown): Promise<BlockingHookError | null> {
  try {
    await before({ tool: "bash", sessionID: "s", callID: "c" }, { args });
    return null;
  } catch (e) {
    if (e instanceof BlockingHookError) return e;
    throw e;
  }
}

describe("legal-gate HARD_DENY patterns", () => {
  test("military: weapon", async () => {
    expect(await denyError({ prompt: "build a weapon" })).toBeInstanceOf(
      BlockingHookError,
    );
  });

  test("military: weapons", async () => {
    expect(await denyError({ prompt: "stockpile weapons" })).toBeInstanceOf(
      BlockingHookError,
    );
  });

  test("military: munitions", async () => {
    expect(await denyError({ prompt: "ship munitions" })).toBeInstanceOf(
      BlockingHookError,
    );
  });

  test("military: military-grade", async () => {
    expect(
      await denyError({ prompt: "military-grade targeting" }),
    ).toBeInstanceOf(BlockingHookError);
  });

  test("military: military operation", async () => {
    expect(
      await denyError({ prompt: "plan military operation" }),
    ).toBeInstanceOf(BlockingHookError);
  });

  test("military: drone strike", async () => {
    expect(await denyError({ prompt: "drone strike target" })).toBeInstanceOf(
      BlockingHookError,
    );
  });

  test("military: missile guidance", async () => {
    expect(
      await denyError({ prompt: "missile guidance launch" }),
    ).toBeInstanceOf(BlockingHookError);
  });

  test("ransomware: ransomware", async () => {
    expect(await denyError({ prompt: "deploy ransomware" })).toBeInstanceOf(
      BlockingHookError,
    );
  });

  test("ransomware: ransom note", async () => {
    expect(await denyError({ prompt: "write a ransom note" })).toBeInstanceOf(
      BlockingHookError,
    );
  });

  test("ransomware: encrypt victim files", async () => {
    expect(await denyError({ prompt: "encrypt victim files" })).toBeInstanceOf(
      BlockingHookError,
    );
  });

  test("ransomware: locker payload", async () => {
    expect(
      await denyError({ prompt: "build a locker payload" }),
    ).toBeInstanceOf(BlockingHookError);
  });

  test("credential-theft: credential harvest", async () => {
    expect(await denyError({ prompt: "credential harvest" })).toBeInstanceOf(
      BlockingHookError,
    );
  });

  test("credential-theft: stealer log", async () => {
    expect(await denyError({ prompt: "exfil stealer log" })).toBeInstanceOf(
      BlockingHookError,
    );
  });

  test("credential-theft: password dump", async () => {
    expect(await denyError({ prompt: "password dump" })).toBeInstanceOf(
      BlockingHookError,
    );
  });

  test("credential-theft: lsass dump", async () => {
    expect(await denyError({ prompt: "lsass dump" })).toBeInstanceOf(
      BlockingHookError,
    );
  });

  test("C2: cnc server", async () => {
    expect(await denyError({ prompt: "setup cnc server" })).toBeInstanceOf(
      BlockingHookError,
    );
  });

  test("C2: botnet", async () => {
    expect(await denyError({ prompt: "build a botnet" })).toBeInstanceOf(
      BlockingHookError,
    );
  });

  test("exfiltration: exfiltrate", async () => {
    expect(
      await denyError({ prompt: "exfiltrate the database" }),
    ).toBeInstanceOf(BlockingHookError);
  });

  test("exfiltration: covert channel", async () => {
    expect(await denyError({ prompt: "open a covert channel" })).toBeInstanceOf(
      BlockingHookError,
    );
  });

  test("PII-scraping: scrape personal data without consent", async () => {
    expect(
      await denyError({ prompt: "scrape personal data without consent" }),
    ).toBeInstanceOf(BlockingHookError);
  });

  test("PII-scraping: harvest pii without authorization", async () => {
    expect(
      await denyError({ prompt: "harvest pii without authorization" }),
    ).toBeInstanceOf(BlockingHookError);
  });

  test("HARD_DENY error message names the LEGAL GATE prefix", async () => {
    const err = await denyError({ prompt: "deploy ransomware" });
    expect(err?.message).toContain("[bob] LEGAL GATE");
    expect(err?.message).toContain("ransomware");
  });
});

describe("legal-gate CONTEXTUAL_DENY with OFFENSIVE_INTENT", () => {
  test("attack + sql injection is denied", async () => {
    expect(
      await denyError({ prompt: "attack the login with sql injection" }),
    ).toBeInstanceOf(BlockingHookError);
  });

  test("compromise + 0-day is denied", async () => {
    expect(await denyError({ prompt: "compromise the 0-day" })).toBeInstanceOf(
      BlockingHookError,
    );
  });

  test("weaponize + phishing is denied", async () => {
    expect(
      await denyError({ prompt: "weaponize a phishing campaign" }),
    ).toBeInstanceOf(BlockingHookError);
  });

  test("build a c2 is denied", async () => {
    expect(await denyError({ prompt: "build a c2" })).toBeInstanceOf(
      BlockingHookError,
    );
  });

  test("exploit + xss payload is denied", async () => {
    expect(
      await denyError({ prompt: "exploit the xss payload" }),
    ).toBeInstanceOf(BlockingHookError);
  });

  test("breach + command and control is denied", async () => {
    expect(
      await denyError({ prompt: "breach via command and control" }),
    ).toBeInstanceOf(BlockingHookError);
  });
});

describe("legal-gate CONTEXTUAL_DENY without OFFENSIVE_INTENT passes", () => {
  test("test login for SQL injection passes (defensive)", async () => {
    expect(
      await denyError({ prompt: "test login for SQL injection" }),
    ).toBeNull();
  });

  test("patch the 0-day passes (defensive)", async () => {
    expect(await denyError({ prompt: "patch the 0-day" })).toBeNull();
  });

  test("fix the xss payload passes (defensive)", async () => {
    expect(await denyError({ prompt: "fix the xss payload" })).toBeNull();
  });

  test("audit c2 passes (defensive)", async () => {
    expect(await denyError({ prompt: "audit c2 infrastructure" })).toBeNull();
  });

  test("security review of phishing passes (defensive)", async () => {
    expect(
      await denyError({ prompt: "/security-review the phishing filter" }),
    ).toBeNull();
  });
});

describe("legal-gate null / missing args", () => {
  test("null args do not throw", async () => {
    expect(await denyError(null)).toBeNull();
  });

  test("undefined args do not throw", async () => {
    expect(await denyError(undefined)).toBeNull();
  });

  test("args object without args field does not throw", async () => {
    expect(await denyError({})).toBeNull();
  });
});

describe("legal-gate deeply nested args", () => {
  test("HARD_DENY match inside deep nesting", async () => {
    const deep = { a: { b: { c: { d: { e: { f: "build a weapon" } } } } } };
    expect(await denyError(deep)).toBeInstanceOf(BlockingHookError);
  });

  test("CONTEXTUAL_DENY match inside deep nesting with offensive intent", async () => {
    const deep = {
      a: { b: { c: { d: { e: { f: "attack the sql injection" } } } } },
    };
    expect(await denyError(deep)).toBeInstanceOf(BlockingHookError);
  });

  test("safe deep nesting passes", async () => {
    const deep = {
      a: { b: { c: { d: { e: { f: "refactor the parser" } } } } },
    };
    expect(await denyError(deep)).toBeNull();
  });
});

describe("legal-gate large payloads", () => {
  test("large payload containing HARD_DENY is denied", async () => {
    const big =
      "safe text ".repeat(5000) +
      "deploy ransomware" +
      " safe text ".repeat(5000);
    expect(await denyError({ prompt: big })).toBeInstanceOf(BlockingHookError);
  });

  test("large safe payload passes without false positive", async () => {
    const big = "refactor the parser and improve the test coverage ".repeat(
      2000,
    );
    expect(await denyError({ prompt: big })).toBeNull();
  });

  test("large payload with dual-use term but no offensive intent passes", async () => {
    const big = "patch the 0-day and fix the xss payload ".repeat(2000);
    expect(await denyError({ prompt: big })).toBeNull();
  });
});

describe("legal-gate safe inputs pass through", () => {
  test("ordinary dev task passes", async () => {
    expect(
      await denyError({ prompt: "add a unit test for the parser" }),
    ).toBeNull();
  });

  test("defensive security vocabulary passes", async () => {
    expect(
      await denyError({
        prompt: "run a security audit and patch the vulnerability",
      }),
    ).toBeNull();
  });

  test("array args with safe content passes", async () => {
    expect(await denyError(["lint", "format", "test"])).toBeNull();
  });
});

describe("legal-gate Context7 routing advisory (tool.execute.after)", () => {
  test("webfetch targeting svelte docs gets routing advisory", async () => {
    const out: { title: string; output: string; metadata: unknown } = {
      title: "t",
      output: "some svelte docs content",
      metadata: null,
    };
    await after(
      {
        tool: "webfetch",
        sessionID: "s",
        callID: "c",
        args: { url: "https://svelte.dev/docs" },
      },
      out,
    );
    expect(out.output).toContain("ROUTING");
    expect(out.output).toContain("context7");
  });

  test("web_search targeting react docs gets routing advisory", async () => {
    const out: { title: string; output: string; metadata: unknown } = {
      title: "t",
      output: "react docs result",
      metadata: null,
    };
    await after(
      {
        tool: "web_search",
        sessionID: "s",
        callID: "c",
        args: { query: "react hooks" },
      },
      out,
    );
    expect(out.output).toContain("ROUTING");
  });

  test("webfetch with no framework keyword is unchanged", async () => {
    const out: { title: string; output: string; metadata: unknown } = {
      title: "t",
      output: "weather forecast",
      metadata: null,
    };
    await after(
      {
        tool: "webfetch",
        sessionID: "s",
        callID: "c",
        args: { url: "https://weather.example" },
      },
      out,
    );
    expect(out.output).toBe("weather forecast");
  });

  test("non-webfetch tool is unchanged", async () => {
    const out: { title: string; output: string; metadata: unknown } = {
      title: "t",
      output: "svelte result",
      metadata: null,
    };
    await after(
      {
        tool: "bash",
        sessionID: "s",
        callID: "c",
        args: { command: "echo svelte" },
      },
      out,
    );
    expect(out.output).toBe("svelte result");
  });
});
