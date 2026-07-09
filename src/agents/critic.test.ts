import { describe, expect, test } from "bun:test";
import { CRITIC_PROMPT } from "./critic";

describe("CRITIC_PROMPT browser automation prohibition", () => {
  test("forbids Playwright/Puppeteer as valid browser evidence", () => {
    expect(CRITIC_PROMPT).toMatch(/Playwright.*Puppeteer.*forbidden/i);
  });

  test("says only agent_browser_* via Vision/general counts as valid evidence", () => {
    // The prompt contains: "Only `agent_browser_*` tool outputs via Vision/general count as valid"
    // Words appear on the same line but not necessarily adjacent
    expect(CRITIC_PROMPT).toContain("Only");
    expect(CRITIC_PROMPT).toContain("agent_browser_*");
    expect(CRITIC_PROMPT).toContain("Vision/general");
    expect(CRITIC_PROMPT).toContain("valid");
  });

  test("instructs to REJECT verification using forbidden browser automation", () => {
    // Key rule 6 says: "If a submitted verification uses forbidden browser automation → REJECT"
    expect(CRITIC_PROMPT).toMatch(/REJECT/i);
    expect(CRITIC_PROMPT).toMatch(/forbidden.*browser.*automation/i);
  });

  test("mentions the exact rejection reason about browser automation via Playwright/Puppeteer", () => {
    expect(CRITIC_PROMPT).toContain(
      "Browser automation via Playwright/Puppeteer is prohibited",
    );
  });

  test("includes BROWSER_VIA_VISION which contains the prohibition", () => {
    // CRITIC_PROMPT imports and embeds BROWSER_VIA_VISION
    expect(CRITIC_PROMPT).toContain("Vision owns the browser");
  });

  test("Critic is forbidden to call agent_browser_* directly", () => {
    expect(CRITIC_PROMPT).toMatch(/Critic.*FORBIDDEN.*agent_browser/i);
  });

  test("Visual Verification HARD GATE includes browser automation rule", () => {
    expect(CRITIC_PROMPT).toContain("Visual Verification (HARD GATE)");
  });

  test("no template literal artifacts", () => {
    expect(CRITIC_PROMPT).not.toMatch(/\$\{/);
  });
});
