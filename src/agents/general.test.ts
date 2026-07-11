import { describe, expect, test } from "bun:test";
import { GENERAL_PROMPT } from "./general";

describe("GENERAL_PROMPT context7 routing", () => {
  test("context7 is the ONLY tool for library docs", () => {
    expect(GENERAL_PROMPT).toContain("context7 is the ONLY tool");
  });

  test("no WebFetch fallback for library docs", () => {
    expect(GENERAL_PROMPT).not.toMatch(/if both fail.*WebFetch/i);
  });

  test("WebFetch restricted to explicit caller authorization", () => {
    expect(GENERAL_PROMPT).toContain("explicitly names");
    expect(GENERAL_PROMPT).toContain("webfetch");
  });

  test("no last-resort loophole for WebFetch", () => {
    expect(GENERAL_PROMPT).not.toMatch(/last resort/i);
    expect(GENERAL_PROMPT).not.toMatch(/if both fail.*WebFetch/i);
  });

  test("WebFetch is not part of default lookup path", () => {
    expect(GENERAL_PROMPT).toContain("not part of default lookup path");
    expect(GENERAL_PROMPT).toContain("caller explicitly authorizes");
  });
});

describe("GENERAL_PROMPT lint verification", () => {
  test("bun run lint is in verification checklist", () => {
    expect(GENERAL_PROMPT).toContain("bun run lint");
  });

  test("lsp_diagnostics is in verification checklist", () => {
    expect(GENERAL_PROMPT).toContain("lsp_diagnostics");
  });

  test("verification section says MANDATORY", () => {
    expect(GENERAL_PROMPT).toContain("MANDATORY");
  });

  test("Pre-CLOSURE Gate section exists", () => {
    expect(GENERAL_PROMPT).toContain("Pre-CLOSURE Gate");
  });
});

describe("GENERAL_PROMPT CLOSURE", () => {
  test("contains CLOSURE schema", () => {
    expect(GENERAL_PROMPT).toContain("<CLOSURE>");
  });

  test("no template literal artifacts", () => {
    expect(GENERAL_PROMPT).not.toMatch(/\$\{/);
  });
});

describe("GENERAL_PROMPT browser automation prohibition", () => {
  test("contains ABSOLUTE PROHIBITION for Playwright/Puppeteer", () => {
    expect(GENERAL_PROMPT).toContain("ABSOLUTE PROHIBITION");
    expect(GENERAL_PROMPT).toMatch(/Playwright.*Puppeteer.*forbidden/i);
  });

  test("instructs to return Status: blocked when agent_browser_* fails", () => {
    expect(GENERAL_PROMPT).toContain("Status: blocked");
    expect(GENERAL_PROMPT).toContain("agent_browser_*");
  });

  test("forbids npx playwright and require playwright", () => {
    expect(GENERAL_PROMPT).toContain("npx playwright");
    expect(GENERAL_PROMPT).toContain('require("playwright")');
  });

  test("says BLOCKED is correct response when browser is unavailable", () => {
    expect(GENERAL_PROMPT).toContain("BLOCKED is the correct");
    expect(GENERAL_PROMPT).toContain("browser is unavailable");
  });

  test("says NEVER fall back to Playwright/Puppeteer", () => {
    // general embeds the Playwright prohibition text directly, containing "Do NOT attempt to install
    // Playwright, run `npx playwright`" and the ONLY approved path text
    expect(GENERAL_PROMPT).toContain("npx playwright");
    expect(GENERAL_PROMPT).toContain("ONLY approved path");
  });

  test("says agent_browser_* via Vision or general is ONLY approved path", () => {
    expect(GENERAL_PROMPT).toMatch(/ONLY approved path/);
    expect(GENERAL_PROMPT).toContain("agent_browser_*");
  });
});
