import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { formatScreenshotOutput } from "../tools/agent-browser/index";
import { VISION_PROMPT } from "./vision";

/**
 * Build a fake base64 PNG string of a given length that passes isBase64Png().
 * PNG magic in base64 is "iVBORw0KGgo" — pad with valid base64 chars to reach desired length.
 */
function fakePngBase64(minLen: number): string {
  const magic = "iVBORw0KGgo";
  const padding = "A".repeat(Math.max(0, minLen - magic.length));
  return magic + padding;
}

describe("VISION_PROMPT", () => {
  test("contains VERDICT: PASS | FAIL instruction", () => {
    expect(VISION_PROMPT).toContain("**VERDICT:**");
    expect(VISION_PROMPT).toContain("PASS");
    expect(VISION_PROMPT).toContain("FAIL");
  });

  test("contains Result Envelope protocol", () => {
    expect(VISION_PROMPT).toContain("Result Envelope Protocol");
    expect(VISION_PROMPT).toContain("**Status:**");
    expect(VISION_PROMPT).toContain("**Summary:**");
    expect(VISION_PROMPT).toContain("**Evidence:**");
    expect(VISION_PROMPT).toContain("**Files touched:**");
  });

  test("contains done/partial/failed/blocked status values", () => {
    expect(VISION_PROMPT).toContain("done");
    expect(VISION_PROMPT).toContain("partial");
    expect(VISION_PROMPT).toContain("failed");
    expect(VISION_PROMPT).toContain("blocked");
  });

  test("instructs to never dump raw base64", () => {
    expect(VISION_PROMPT).toContain("NEVER dump raw pixel data");
    expect(VISION_PROMPT).toContain("base64");
  });

  test("instructs to reference screenshot file paths in evidence", () => {
    expect(VISION_PROMPT).toContain("screenshot file path");
    expect(VISION_PROMPT).toContain("evidence");
  });

  test("contains CLOSURE schema", () => {
    expect(VISION_PROMPT).toContain("<CLOSURE>");
    expect(VISION_PROMPT).toContain('"readiness"');
  });

  test("forbids raw Thinking/Reasoning between deliverable and CLOSURE", () => {
    expect(VISION_PROMPT).toContain("No raw Thinking/Reasoning");
  });

  test("mentions (none) for Files touched since Vision is read-only", () => {
    expect(VISION_PROMPT).toContain("(none)");
    expect(VISION_PROMPT).toContain("read-only");
  });

  test("no template literal artifacts", () => {
    expect(VISION_PROMPT).not.toMatch(/\$\{/);
  });

  // --- Mandatory Execution Contract ---

  test("contains MANDATORY Execution Contract section", () => {
    expect(VISION_PROMPT).toContain("MANDATORY Execution Contract");
  });

  test("contains MUST call at least one agent_browser_* tool instruction", () => {
    expect(VISION_PROMPT).toContain(
      "MUST call at least one agent_browser_* tool",
    );
  });

  test("contains blocked status for browser failures", () => {
    expect(VISION_PROMPT).toContain("Status:");
    expect(VISION_PROMPT).toContain("blocked");
    expect(VISION_PROMPT).toContain("Browser verification blocked:");
  });

  test("contains Do NOT report results derived from code-reading", () => {
    expect(VISION_PROMPT).toContain(
      "Do NOT report results derived from code-reading",
    );
    expect(VISION_PROMPT).toContain("static analysis");
  });

  test("contains verdict without browser tool evidence is INVALID", () => {
    expect(VISION_PROMPT).toContain(
      "verdict without browser tool evidence is INVALID",
    );
    expect(VISION_PROMPT).toContain("will be REJECTED by the calling agent");
  });

  // --- Local Media tests ---

  test("contains Local Media Files section", () => {
    expect(VISION_PROMPT).toContain("Local Media Files");
    expect(VISION_PROMPT).toContain("Glob first");
  });

  test("instructs to use Read tool for images/PDFs", () => {
    expect(VISION_PROMPT).toContain("Read tool");
    expect(VISION_PROMPT).toContain("returns the visual content inline");
  });

  test("instructs to report file paths as evidence", () => {
    expect(VISION_PROMPT).toContain("Report file paths");
    expect(VISION_PROMPT).toContain("Reference the exact paths");
  });

  test("forbids dumping raw base64 for local files", () => {
    expect(VISION_PROMPT).toContain("Never dump raw base64");
    expect(VISION_PROMPT).toContain("binary data");
  });

  test("contains Media Folder Review Workflow section", () => {
    expect(VISION_PROMPT).toContain("Media Folder Review Workflow");
    expect(VISION_PROMPT).toContain("Filter by extension");
  });

  test("mentions png/jpg/gif/webp/svg/pdf as visual formats", () => {
    expect(VISION_PROMPT).toContain("png, jpg, jpeg, gif, webp, svg, pdf");
  });

  test("says to review one image/PDF at a time", () => {
    expect(VISION_PROMPT).toContain("Review one at a time");
    expect(VISION_PROMPT).toContain("Read each image/PDF in sequence");
  });

  test("contains Video Files section with limitation", () => {
    expect(VISION_PROMPT).toContain("Video Files");
    expect(VISION_PROMPT).toContain("CANNOT analyze raw video frames");
  });

  test("lists common video extensions", () => {
    expect(VISION_PROMPT).toContain(".mp4, .webm, .mov, .avi, .mkv");
  });

  test("says not to Read video as binary", () => {
    expect(VISION_PROMPT).toContain("Do NOT Read video as binary");
    expect(VISION_PROMPT).toContain("Never attempt to read");
  });

  test("offers alternatives for video analysis", () => {
    expect(VISION_PROMPT).toContain("frame extraction");
    expect(VISION_PROMPT).toContain("ffmpeg");
  });

  test("contains File Access Note section", () => {
    expect(VISION_PROMPT).toContain("File Access Note");
    expect(VISION_PROMPT).toContain("project root");
    expect(VISION_PROMPT).toContain("outside the project root");
  });

  test("instructs on anomaly detection for local files", () => {
    expect(VISION_PROMPT).toContain("Anomaly detection");
  });

  // --- Playwright/Puppeteer prohibition ---

  test("contains ABSOLUTE PROHIBITION for Playwright/Puppeteer in Constraints", () => {
    // VISION_PROMPT embeds the prohibition in Constraints section
    expect(VISION_PROMPT).toContain("Constraints");
    expect(VISION_PROMPT).toMatch(
      /Playwright.*Puppeteer.*FORBIDDEN|FORBIDDEN.*Playwright.*Puppeteer/i,
    );
  });

  test("forbids Playwright and Puppeteer explicitly", () => {
    expect(VISION_PROMPT).toMatch(
      /\bplaywright\b.*FORBIDDEN|FORBIDDEN.*\bplaywright\b/i,
    );
    expect(VISION_PROMPT).toMatch(
      /\bPuppeteer\b.*FORBIDDEN|FORBIDDEN.*\bPuppeteer\b/i,
    );
  });

  test("instructs to return blocked on agent_browser_* failure — not fallback", () => {
    expect(VISION_PROMPT).toContain("Status:");
    expect(VISION_PROMPT).toContain("blocked");
    expect(VISION_PROMPT).toContain("return blocked");
    expect(VISION_PROMPT).toMatch(/do NOT fall back to/i);
  });

  test("forbids Chrome DevTools MCP", () => {
    expect(VISION_PROMPT).toContain("Chrome DevTools MCP");
  });

  test("forbids writing/running node scripts with Playwright/Puppeteer", () => {
    // Constraints section says: "Do NOT write/run node scripts that import Playwright or Puppeteer."
    expect(VISION_PROMPT).toContain("node scripts");
    expect(VISION_PROMPT).toMatch(/import.*Playwright.*Puppeteer/i);
  });

  test("mentions the hard gate in Constraints section", () => {
    expect(VISION_PROMPT).toContain("Constraints");
    expect(VISION_PROMPT).toMatch(/Playwright.*Puppeteer.*FORBIDDEN/i);
  });

  test("Status: blocked wording matches spec", () => {
    expect(VISION_PROMPT).toContain("**Status:** blocked");
    expect(VISION_PROMPT).toContain("Browser verification blocked:");
  });
});

describe("formatScreenshotOutput", () => {
  let tmpProjectDir: string;

  beforeEach(() => {
    tmpProjectDir = join(
      tmpdir(),
      `bob-test-screenshots-${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    );
    mkdirSync(tmpProjectDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpProjectDir, { recursive: true, force: true });
  });

  test('returns "empty output" for empty string', () => {
    const result = formatScreenshotOutput("", tmpProjectDir);
    expect(result).toBe("Screenshot: (empty output)");
  });

  test('returns "empty output" for whitespace-only string', () => {
    const result = formatScreenshotOutput("   \n  ", tmpProjectDir);
    expect(result).toBe("Screenshot: (empty output)");
  });

  test("persists base64 PNG to disk and returns path with size", () => {
    const fakeBase64 = fakePngBase64(1500);
    const result = formatScreenshotOutput(fakeBase64, tmpProjectDir);

    // Should mention screenshot saved
    expect(result).toMatch(/^Screenshot saved:/);
    expect(result).toContain(tmpProjectDir);
    expect(result).toContain(join(".bob", "screenshots", "agent-browser-"));
    expect(result).toContain(".png");
    // Should contain byte size
    expect(result).toMatch(/\(\d+ bytes\)/);

    // Verify the file was written
    const pathMatch = result.match(/Screenshot saved: (\S+)/);
    expect(pathMatch).not.toBeNull();
    if (pathMatch) {
      const savedPath = pathMatch[1];
      expect(existsSync(savedPath)).toBe(true);
      const savedContent = readFileSync(savedPath);
      expect(savedContent.length).toBeGreaterThan(0);
      // Content should match the decoded base64
      expect(savedContent).toEqual(Buffer.from(fakeBase64, "base64"));
    }
  });

  test("truncates long text output over 5000 chars", () => {
    // Use mixed text (not pure base64 chars) so it's NOT detected as base64
    const longText =
      "Console log line " +
      Array.from(
        { length: 600 },
        (_, i) => `[${i}] element found: <div class="container">\n`,
      ).join("");
    const result = formatScreenshotOutput(longText, tmpProjectDir);
    expect(result.length).toBeLessThanOrEqual(5050); // 5000 + truncation message
    expect(result).toContain("[output truncated at 5000 chars]");
  });

  test("passes through short text output unchanged", () => {
    const shortText = "Console: no errors detected";
    const result = formatScreenshotOutput(shortText, tmpProjectDir);
    expect(result).toBe(shortText);
  });

  test("passes through path-like output unchanged", () => {
    const pathText = "/tmp/screenshot.png";
    const result = formatScreenshotOutput(pathText, tmpProjectDir);
    expect(result).toBe(pathText);
  });

  test("passes through JSON output unchanged (if short enough)", () => {
    const jsonText = JSON.stringify({
      path: "/tmp/screenshot.png",
      size: 12345,
    });
    const result = formatScreenshotOutput(jsonText, tmpProjectDir);
    expect(result).toBe(jsonText);
  });

  test("does NOT include base64 in the returned string", () => {
    const fakeBase64 = fakePngBase64(1500);
    const result = formatScreenshotOutput(fakeBase64, tmpProjectDir);

    // The result should NOT contain the base64 string
    expect(result).not.toContain(fakeBase64);
    // Should be a path/descriptor instead
    expect(result).toMatch(/^Screenshot saved:/);
  });

  test("handles base64 with trailing newline", () => {
    const fakeBase64 = fakePngBase64(1500) + "\n";
    const result = formatScreenshotOutput(fakeBase64, tmpProjectDir);
    expect(result).toMatch(/^Screenshot saved:/);
  });

  test("does not detect short base64-like data as PNG", () => {
    const shortData = "iVBORw0KGgoAAA"; // PNG magic but too short
    const result = formatScreenshotOutput(shortData, tmpProjectDir);
    // Should pass through as-is, not save to disk
    expect(result).toBe(shortData);
  });
});
