import { describe, expect, test } from 'bun:test';
import { BROWSER_VIA_VISION } from './browser';

describe('BROWSER_VIA_VISION', () => {
  test('contains HARD GATE for agent_browser_*', () => {
    expect(BROWSER_VIA_VISION).toContain('HARD GATE');
    expect(BROWSER_VIA_VISION).toContain('agent_browser_*');
    expect(BROWSER_VIA_VISION).toContain('BLOCKED');
  });

  test('contains ABSOLUTE BROWSER AUTOMATION PROHIBITION section', () => {
    expect(BROWSER_VIA_VISION).toContain('ABSOLUTE BROWSER AUTOMATION PROHIBITION');
  });

  test('lists Playwright as forbidden', () => {
    expect(BROWSER_VIA_VISION).toContain('Playwright');
    expect(BROWSER_VIA_VISION).toMatch(/\bPlaywright\b.*forbidden|forbidden.*\bPlaywright\b/is);
  });

  test('lists Puppeteer as forbidden', () => {
    expect(BROWSER_VIA_VISION).toContain('Puppeteer');
  });

  test('forbids npx playwright and npm exec playwright', () => {
    expect(BROWSER_VIA_VISION).toContain('npx playwright');
    expect(BROWSER_VIA_VISION).toContain('npm exec playwright');
  });

  test('forbids npm list -g playwright diagnostic probe', () => {
    expect(BROWSER_VIA_VISION).toContain('npm list -g playwright');
  });

  test('forbids require("playwright"), from "playwright"', () => {
    expect(BROWSER_VIA_VISION).toContain('require("playwright")');
    expect(BROWSER_VIA_VISION).toContain('from "playwright"');
  });

  test('forbids chromium.launch(), page.screenshot(), browser.newPage()', () => {
    expect(BROWSER_VIA_VISION).toContain('chromium.launch()');
    expect(BROWSER_VIA_VISION).toContain('page.screenshot()');
    expect(BROWSER_VIA_VISION).toContain('browser.newPage()');
  });

  test('forbids node ...playwright... and node ...puppeteer... script paths', () => {
    expect(BROWSER_VIA_VISION).toContain('node ...playwright...');
    expect(BROWSER_VIA_VISION).toContain('node ...puppeteer...');
  });

  test('forbids .cache/puppeteer and .cache/playwright', () => {
    expect(BROWSER_VIA_VISION).toContain('.cache/puppeteer');
    expect(BROWSER_VIA_VISION).toContain('.cache/playwright');
  });

  test('forbids Chrome DevTools MCP and @mcp-devtools/*', () => {
    expect(BROWSER_VIA_VISION).toContain('Chrome DevTools MCP');
    expect(BROWSER_VIA_VISION).toContain('@mcp-devtools/');
  });

  test('instructs to return Status: blocked when agent_browser_* fails', () => {
    expect(BROWSER_VIA_VISION).toContain('Status: blocked');
    expect(BROWSER_VIA_VISION).toMatch(/return.*blocked/i);
  });

  test('says do NOT install, require, import, or run alternate browser automation', () => {
    expect(BROWSER_VIA_VISION).toMatch(/Do NOT install/i);
    expect(BROWSER_VIA_VISION).toMatch(/alternate browser automation/i);
  });

  test('says delegating to Vision/general is the ONLY approved path', () => {
    expect(BROWSER_VIA_VISION).toMatch(/ONLY approved path/);
    expect(BROWSER_VIA_VISION).toContain('Vision');
    expect(BROWSER_VIA_VISION).toContain('general');
  });

  test('says NEVER fall back to Playwright/Puppeteer', () => {
    expect(BROWSER_VIA_VISION).toMatch(/NEVER fall back to Playwright\/Puppeteer/i);
  });

  test('Vision is the browser owner (owns the browser)', () => {
    expect(BROWSER_VIA_VISION).toContain('Vision owns the browser');
  });

  test('mentions task() delegate pattern for Vision', () => {
    expect(BROWSER_VIA_VISION).toContain('task({subagent_type: "vision"');
  });

  test('general is the fallback for browser when Vision is unavailable', () => {
    expect(BROWSER_VIA_VISION).toContain('Fallback');
    expect(BROWSER_VIA_VISION).toContain('general');
  });

  test('responsive testing uses agent_browser_set_viewport()', () => {
    expect(BROWSER_VIA_VISION).toContain('agent_browser_set_viewport()');
  });

  test('no template literal artifacts', () => {
    expect(BROWSER_VIA_VISION).not.toMatch(/\$\{/);
  });
});
