import { describe, expect, test } from "bun:test";
import {
  BROWSER_NO_ALTERNATE_STACK,
  BROWSER_ROUTE_TO_VISION,
  BROWSER_ROUTE_TO_VISION_LEAF,
} from "./browser";

describe("BROWSER_ROUTE_TO_VISION", () => {
  test("contains HARD GATE for agent_browser_*", () => {
    expect(BROWSER_ROUTE_TO_VISION).toContain("HARD GATE");
    expect(BROWSER_ROUTE_TO_VISION).toContain("agent_browser_*");
    expect(BROWSER_ROUTE_TO_VISION).toContain("BLOCKED");
  });

  test("Vision is the browser owner (owns the browser)", () => {
    expect(BROWSER_ROUTE_TO_VISION).toContain("Vision owns the browser");
  });

  test("mentions task() delegate pattern for Vision", () => {
    expect(BROWSER_ROUTE_TO_VISION).toContain('task({subagent_type: "vision"');
  });

  test("general is the fallback for browser when Vision is unavailable", () => {
    expect(BROWSER_ROUTE_TO_VISION).toContain("Fallback");
    expect(BROWSER_ROUTE_TO_VISION).toContain("general");
  });

  test("responsive testing uses agent_browser_set_viewport()", () => {
    expect(BROWSER_ROUTE_TO_VISION).toContain("agent_browser_set_viewport()");
  });

  test("forbids copying walls into task() args", () => {
    expect(BROWSER_ROUTE_TO_VISION).toContain("Task-prompt wall");
    expect(BROWSER_ROUTE_TO_VISION).toContain("work packets only");
  });

  test("does not name Playwright or Puppeteer", () => {
    expect(BROWSER_ROUTE_TO_VISION).not.toMatch(/playwright/i);
    expect(BROWSER_ROUTE_TO_VISION).not.toMatch(/puppeteer/i);
  });

  test("no template literal artifacts", () => {
    expect(BROWSER_ROUTE_TO_VISION).not.toMatch(/\$\{/);
  });
});

describe("BROWSER_ROUTE_TO_VISION_LEAF", () => {
  test("blocks agent_browser_* and forbids spawning Vision", () => {
    expect(BROWSER_ROUTE_TO_VISION_LEAF).toContain("HARD GATE");
    expect(BROWSER_ROUTE_TO_VISION_LEAF).toContain("cannot spawn Vision");
    expect(BROWSER_ROUTE_TO_VISION_LEAF).toContain("agent_browser_*");
  });

  test("does not include a task(vision) example", () => {
    expect(BROWSER_ROUTE_TO_VISION_LEAF).not.toContain(
      'task({subagent_type: "vision"',
    );
  });

  test("does not name Playwright or Puppeteer", () => {
    expect(BROWSER_ROUTE_TO_VISION_LEAF).not.toMatch(/playwright/i);
    expect(BROWSER_ROUTE_TO_VISION_LEAF).not.toMatch(/puppeteer/i);
  });
});

describe("BROWSER_NO_ALTERNATE_STACK", () => {
  test("contains ABSOLUTE PROHIBITION section", () => {
    expect(BROWSER_NO_ALTERNATE_STACK).toContain("ABSOLUTE PROHIBITION");
  });

  test("lists Playwright as forbidden", () => {
    expect(BROWSER_NO_ALTERNATE_STACK).toContain("Playwright");
    expect(BROWSER_NO_ALTERNATE_STACK).toMatch(
      /\bPlaywright\b.*forbidden|forbidden.*\bPlaywright\b/is,
    );
  });

  test("lists Puppeteer as forbidden", () => {
    expect(BROWSER_NO_ALTERNATE_STACK).toContain("Puppeteer");
  });

  test("forbids npx playwright and npm exec playwright", () => {
    expect(BROWSER_NO_ALTERNATE_STACK).toContain("npx playwright");
    expect(BROWSER_NO_ALTERNATE_STACK).toContain("npm exec playwright");
  });

  test("forbids npm list -g playwright diagnostic probe", () => {
    expect(BROWSER_NO_ALTERNATE_STACK).toContain("npm list -g playwright");
  });

  test('forbids require("playwright"), from "playwright"', () => {
    expect(BROWSER_NO_ALTERNATE_STACK).toContain('require("playwright")');
    expect(BROWSER_NO_ALTERNATE_STACK).toContain('from "playwright"');
  });

  test("forbids chromium.launch(), page.screenshot(), browser.newPage()", () => {
    expect(BROWSER_NO_ALTERNATE_STACK).toContain("chromium.launch()");
    expect(BROWSER_NO_ALTERNATE_STACK).toContain("page.screenshot()");
    expect(BROWSER_NO_ALTERNATE_STACK).toContain("browser.newPage()");
  });

  test("forbids node ...playwright... and node ...puppeteer... script paths", () => {
    expect(BROWSER_NO_ALTERNATE_STACK).toContain("node ...playwright...");
    expect(BROWSER_NO_ALTERNATE_STACK).toContain("node ...puppeteer...");
  });

  test("forbids .cache/puppeteer and .cache/playwright", () => {
    expect(BROWSER_NO_ALTERNATE_STACK).toContain(".cache/puppeteer");
    expect(BROWSER_NO_ALTERNATE_STACK).toContain(".cache/playwright");
  });

  test("forbids Chrome DevTools MCP and @mcp-devtools/*", () => {
    expect(BROWSER_NO_ALTERNATE_STACK).toContain("Chrome DevTools MCP");
    expect(BROWSER_NO_ALTERNATE_STACK).toContain("@mcp-devtools/");
  });

  test("instructs to return Status: blocked when agent_browser_* fails", () => {
    expect(BROWSER_NO_ALTERNATE_STACK).toContain("Status: blocked");
    expect(BROWSER_NO_ALTERNATE_STACK).toMatch(/return.*blocked/i);
  });

  test("says do NOT install, require, import, or run alternate browser automation", () => {
    expect(BROWSER_NO_ALTERNATE_STACK).toMatch(/Do NOT install/i);
    expect(BROWSER_NO_ALTERNATE_STACK).toMatch(/alternate browser automation/i);
  });

  test("says agent_browser via Vision/general is the ONLY approved path", () => {
    expect(BROWSER_NO_ALTERNATE_STACK).toMatch(/ONLY approved path/);
    expect(BROWSER_NO_ALTERNATE_STACK).toContain("Vision");
    expect(BROWSER_NO_ALTERNATE_STACK).toContain("general");
  });

  test("says NEVER fall back to Playwright/Puppeteer", () => {
    expect(BROWSER_NO_ALTERNATE_STACK).toMatch(
      /NEVER fall back to Playwright\/Puppeteer/i,
    );
  });

  test("no template literal artifacts", () => {
    expect(BROWSER_NO_ALTERNATE_STACK).not.toMatch(/\$\{/);
  });
});
