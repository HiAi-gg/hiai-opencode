import { describe, expect, test } from "bun:test";
import { EXPLORE_PROMPT } from "./explore";

describe("EXPLORE_PROMPT context7 routing", () => {
  test("contains absolute WebFetch prohibition for library docs", () => {
    expect(EXPLORE_PROMPT).toContain(
      "NEVER use WebFetch for library/API documentation queries",
    );
  });

  test("lists Svelte as mandatory context7 framework", () => {
    expect(EXPLORE_PROMPT).toContain("Svelte");
  });

  test("lists React as mandatory context7 framework", () => {
    expect(EXPLORE_PROMPT).toContain("React");
  });

  test("lists Bun as mandatory context7 framework", () => {
    expect(EXPLORE_PROMPT).toContain("Bun");
  });

  test("lists Drizzle as mandatory context7 framework", () => {
    expect(EXPLORE_PROMPT).toContain("Drizzle");
  });

  test("lists context7 as the tool for library docs", () => {
    expect(EXPLORE_PROMPT).toContain("context7");
  });

  test("context7 is prioritized before grep_app in HARD ORDER", () => {
    const afterHardOrder = EXPLORE_PROMPT.split("HARD ORDER")[1] ?? "";
    const context7Pos = afterHardOrder.indexOf("context7");
    const grepAppPos = afterHardOrder.indexOf("grep_app");
    expect(context7Pos).toBeGreaterThan(-1);
    expect(grepAppPos).toBeGreaterThan(-1);
    expect(context7Pos).toBeLessThan(grepAppPos);
  });

  test("no ${} template literal artifacts", () => {
    expect(EXPLORE_PROMPT).not.toMatch(/\$\{/);
  });

  test("contains CLOSURE schema", () => {
    expect(EXPLORE_PROMPT).toContain("<CLOSURE>");
  });

  test("firecrawl explicit routing is preserved", () => {
    expect(EXPLORE_PROMPT).toContain("Explicit firecrawl");
  });

  test("ctx7 library is referenced as valid command", () => {
    expect(EXPLORE_PROMPT).toMatch(/ctx7 library/i);
  });

  test("context7 skill is referenced for docs lookup", () => {
    // The explore prompt should reference the context7 skill for CLI usage
    expect(EXPLORE_PROMPT).toMatch(/context7.*skill/i);
  });

  test("ctx7 search is NOT referenced (invalid command)", () => {
    expect(EXPLORE_PROMPT).not.toMatch(/ctx7 search/i);
  });
});
