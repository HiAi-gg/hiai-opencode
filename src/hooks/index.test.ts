import { describe, expect, test } from 'bun:test';
import type { BobConfig } from '../types';
import { createHooks } from './index';
import { createLegalGate } from './legal-gate';

function makeConfig(hooksDisabled?: string[]): BobConfig {
  return {
    models: {
      bob: { model: 'openai/gpt-5.5' },
      build: { model: 'opencode-go/deepseek-v4-pro' },
      explore: { model: 'opencode-go/deepseek-v4-flash' },
      critic: { model: 'opencode-go/mimo-v2.5-pro' },
      general: { model: 'opencode-go/deepseek-v4-flash' },
      writer: { model: 'opencode-go/deepseek-v4-flash' },
      designer: { model: 'opencode-go/kimi-k2.7-code' },
      manager: { model: 'opencode-go/deepseek-v4-flash' },
      vision: { model: 'opencode-go/mimo-v2.5' },
    },
    ...(hooksDisabled ? { hooks: { disabled: hooksDisabled } } : {}),
  };
}

describe('createHooks', () => {
  test('returns permission.ask hook when legal-gate is enabled', () => {
    const hookSet = createHooks(makeConfig());
    expect(typeof hookSet['permission.ask']).toBe('function');
  });

  test('does not return permission.ask hook when legal-gate is disabled', () => {
    const hookSet = createHooks(makeConfig(['legal-gate']));
    expect(hookSet['permission.ask']).toBeUndefined();
  });

  test('permission.ask sets status to "ask" for bash', async () => {
    const hookSet = createHooks(makeConfig());
    const handler = hookSet['permission.ask'];
    expect(handler).toBeDefined();

    const output = { status: 'deny' as const };
    await handler!(
      { tool: 'bash', args: 'echo hello', sessionID: 'ses_test', callID: 'c1' },
      output,
    );
    expect(output.status).toBe('ask');
  });

  test('permission.ask does not set "ask" for non-risky tools', async () => {
    const hookSet = createHooks(makeConfig());
    const handler = hookSet['permission.ask'];
    expect(handler).toBeDefined();

    const output = { status: 'deny' as const };
    await handler!(
      { tool: 'glob', args: '**/*.ts', sessionID: 'ses_test', callID: 'c1' },
      output,
    );
    // The handler explicitly sets 'ask' for risky tools; leaves others untouched.
    // The output remains as initialized by the caller.
    expect(output.status).toBe('deny');
  });

  // ── Legal gate defense-in-depth: external_directory auto-allow ──

  test('external_directory + read → auto-allow', async () => {
    const hookSet = createHooks(makeConfig());
    const handler = hookSet['permission.ask'];
    expect(handler).toBeDefined();

    const output = { status: 'deny' as const };
    await handler!(
      {
        tool: 'read',
        permission: 'external_directory',
        args: '/outside/file.txt',
        sessionID: 'ses_test',
        callID: 'c1',
      },
      output,
    );
    expect(output.status).toBe('allow');
  });

  test('external_directory + grep → auto-allow', async () => {
    const hookSet = createHooks(makeConfig());
    const handler = hookSet['permission.ask'];
    expect(handler).toBeDefined();

    const output = { status: 'deny' as const };
    await handler!(
      {
        tool: 'grep',
        permission: 'external_directory',
        args: 'search pattern',
        sessionID: 'ses_test',
        callID: 'c1',
      },
      output,
    );
    expect(output.status).toBe('allow');
  });

  test('external_directory + glob → auto-allow', async () => {
    const hookSet = createHooks(makeConfig());
    const handler = hookSet['permission.ask'];
    expect(handler).toBeDefined();

    const output = { status: 'deny' as const };
    await handler!(
      {
        tool: 'glob',
        permission: 'external_directory',
        args: '**/*.ts',
        sessionID: 'ses_test',
        callID: 'c1',
      },
      output,
    );
    expect(output.status).toBe('allow');
  });

  test('external_directory + lsp_diagnostics → auto-allow', async () => {
    const hookSet = createHooks(makeConfig());
    const handler = hookSet['permission.ask'];
    expect(handler).toBeDefined();

    const output = { status: 'deny' as const };
    await handler!(
      {
        tool: 'lsp_diagnostics',
        permission: 'external_directory',
        args: '/outside/file.ts',
        sessionID: 'ses_test',
        callID: 'c1',
      },
      output,
    );
    expect(output.status).toBe('allow');
  });

  test('external_directory + hiai_memory_search → auto-allow', async () => {
    const hookSet = createHooks(makeConfig());
    const handler = hookSet['permission.ask'];
    expect(handler).toBeDefined();

    const output = { status: 'deny' as const };
    await handler!(
      {
        tool: 'hiai_memory_search',
        permission: 'external_directory',
        args: 'query',
        sessionID: 'ses_test',
        callID: 'c1',
      },
      output,
    );
    expect(output.status).toBe('allow');
  });

  test('external_directory + session_read → auto-allow', async () => {
    const hookSet = createHooks(makeConfig());
    const handler = hookSet['permission.ask'];
    expect(handler).toBeDefined();

    const output = { status: 'deny' as const };
    await handler!(
      {
        tool: 'session_read',
        permission: 'external_directory',
        args: 'ses_123',
        sessionID: 'ses_test',
        callID: 'c1',
      },
      output,
    );
    expect(output.status).toBe('allow');
  });

  test('external_directory + write → NOT auto-allowed (stays deny)', async () => {
    const hookSet = createHooks(makeConfig());
    const handler = hookSet['permission.ask'];
    expect(handler).toBeDefined();

    const output = { status: 'deny' as const };
    await handler!(
      {
        tool: 'write',
        permission: 'external_directory',
        args: '/outside/file.txt',
        sessionID: 'ses_test',
        callID: 'c1',
      },
      output,
    );
    // write is in ASK_BEFORE_TOOLS → should become 'ask', not 'allow'
    expect(output.status).toBe('ask');
  });

  test('external_directory + edit → NOT auto-allowed (becomes ask)', async () => {
    const hookSet = createHooks(makeConfig());
    const handler = hookSet['permission.ask'];
    expect(handler).toBeDefined();

    const output = { status: 'deny' as const };
    await handler!(
      {
        tool: 'edit',
        permission: 'external_directory',
        args: '/outside/file.txt',
        sessionID: 'ses_test',
        callID: 'c1',
      },
      output,
    );
    expect(output.status).toBe('ask');
  });

  test('external_directory + bash → NOT auto-allowed (becomes ask)', async () => {
    const hookSet = createHooks(makeConfig());
    const handler = hookSet['permission.ask'];
    expect(handler).toBeDefined();

    const output = { status: 'deny' as const };
    await handler!(
      {
        tool: 'bash',
        permission: 'external_directory',
        args: 'rm -rf /',
        sessionID: 'ses_test',
        callID: 'c1',
      },
      output,
    );
    expect(output.status).toBe('ask');
  });

  test('external_directory + webfetch → NOT auto-allowed (becomes ask)', async () => {
    const hookSet = createHooks(makeConfig());
    const handler = hookSet['permission.ask'];
    expect(handler).toBeDefined();

    const output = { status: 'deny' as const };
    await handler!(
      {
        tool: 'webfetch',
        permission: 'external_directory',
        args: 'http://example.com',
        sessionID: 'ses_test',
        callID: 'c1',
      },
      output,
    );
    expect(output.status).toBe('ask');
  });

  test('no permission key → normal behavior (glob not in ASK_BEFORE_TOOLS)', async () => {
    const hookSet = createHooks(makeConfig());
    const handler = hookSet['permission.ask'];
    expect(handler).toBeDefined();

    const output = { status: 'deny' as const };
    await handler!(
      {
        tool: 'glob',
        args: '**/*.ts',
        sessionID: 'ses_test',
        callID: 'c1',
      },
      output,
    );
    // No permission key means defense-in-depth doesn't trigger.
    // glob is not in ASK_BEFORE_TOOLS → stays as-is
    expect(output.status).toBe('deny');
  });

  test('external_directory + apply_patch → NOT auto-allowed (becomes ask)', async () => {
    const hookSet = createHooks(makeConfig());
    const handler = hookSet['permission.ask'];
    expect(handler).toBeDefined();

    const output = { status: 'deny' as const };
    await handler!(
      {
        tool: 'apply_patch',
        permission: 'external_directory',
        args: 'patch content',
        sessionID: 'ses_test',
        callID: 'c1',
      },
      output,
    );
    expect(output.status).toBe('ask');
  });
});

// ── Browser automation gate: Playwright/Puppeteer hard block ──

function makeLegalGateHooks() {
  return createLegalGate();
}

async function expectBlocked(args: unknown, tool = 'bash'): Promise<{ errorMessage: string }> {
  const hooks = makeLegalGateHooks();
  const handler = hooks['tool.execute.before'];
  expect(handler).toBeDefined();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await handler({ tool, sessionID: 'ses_test', callID: 'c1' } as any, { args } as any);
    return { errorMessage: '' }; // Should have thrown
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { errorMessage: msg };
  }
}

async function expectAllowed(args: unknown, tool = 'bash'): Promise<void> {
  const hooks = makeLegalGateHooks();
  const handler = hooks['tool.execute.before'];
  // Should not throw
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await handler({ tool, sessionID: 'ses_test', callID: 'c1' } as any, { args } as any);
}

describe('browser-automation gate: Playwright/Puppeteer blocking', () => {
  // --- Package/CLI names ---

  test('bash with npx playwright screenshot → blocks', async () => {
    const { errorMessage } = await expectBlocked('npx playwright screenshot');
    expect(errorMessage).toContain('BROWSER AUTOMATION GATE');
    expect(errorMessage).toContain('playwright');
  });

  test('bash with npm list -g playwright → blocks', async () => {
    const { errorMessage } = await expectBlocked('npm list -g playwright');
    expect(errorMessage).toContain('BROWSER AUTOMATION GATE');
    expect(errorMessage).toContain('playwright');
  });

  test('bash with npm exec playwright → blocks', async () => {
    const { errorMessage } = await expectBlocked('npm exec playwright -- --version');
    expect(errorMessage).toContain('BROWSER AUTOMATION GATE');
    expect(errorMessage).toContain('playwright');
  });

  test('bash with node -e require playwright → blocks', async () => {
    const { errorMessage } = await expectBlocked(
      "node -e \"require('playwright')\"",
    );
    expect(errorMessage).toContain('BROWSER AUTOMATION GATE');
    expect(errorMessage).toContain('require("playwright")');
  });

  test('bash with global playwright path probe → blocks', async () => {
    const { errorMessage } = await expectBlocked(
      '/usr/local/lib/node_modules/playwright/cli.js --version',
    );
    expect(errorMessage).toContain('BROWSER AUTOMATION GATE');
    expect(errorMessage).toContain('playwright');
  });

  // --- Package names (bare) ---

  test('bash with @playwright/test → blocks', async () => {
    const { errorMessage } = await expectBlocked('@playwright/test');
    expect(errorMessage).toContain('BROWSER AUTOMATION GATE');
    expect(errorMessage).toContain('@playwright/');
  });

  test('bash with ms-playwright → blocks', async () => {
    const { errorMessage } = await expectBlocked('ms-playwright');
    expect(errorMessage).toContain('BROWSER AUTOMATION GATE');
    expect(errorMessage).toContain('ms-playwright');
  });

  test('bash with puppeteer → blocks', async () => {
    const { errorMessage } = await expectBlocked('puppeteer');
    expect(errorMessage).toContain('BROWSER AUTOMATION GATE');
    expect(errorMessage).toContain('Puppeteer');
  });

  test('bash with @puppeteer/launcher → blocks', async () => {
    const { errorMessage } = await expectBlocked('@puppeteer/launcher');
    expect(errorMessage).toContain('BROWSER AUTOMATION GATE');
    expect(errorMessage).toContain('@puppeteer/');
  });

  // --- write tool: code containing playwright/puppeteer ---

  test('write content with require("playwright") → blocks', async () => {
    const scriptContent = `
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.screenshot({ path: "screenshot.png" });
  await browser.close();
})();
`;
    const { errorMessage } = await expectBlocked(scriptContent, 'write');
    expect(errorMessage).toContain('BROWSER AUTOMATION GATE');
    expect(errorMessage).toContain('require("playwright")');
  });

  test('write content with puppeteer.launch() → blocks', async () => {
    const scriptContent = `
const puppeteer = require("puppeteer");
(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.screenshot({ path: "screenshot.png" });
  await browser.close();
})();
`;
    const { errorMessage } = await expectBlocked(scriptContent, 'write');
    expect(errorMessage).toContain('BROWSER AUTOMATION GATE');
    expect(errorMessage).toContain('puppeteer');
  });

  test('write content with from "playwright" import → blocks', async () => {
    const scriptContent = `import { chromium } from 'playwright';`;
    const { errorMessage } = await expectBlocked(scriptContent, 'write');
    expect(errorMessage).toContain('BROWSER AUTOMATION GATE');
    expect(errorMessage).toContain('from "playwright"');
  });

  test('write content with chromium.launch() → blocks', async () => {
    const scriptContent = `await chromium.launch({ headless: true });`;
    const { errorMessage } = await expectBlocked(scriptContent, 'write');
    expect(errorMessage).toContain('BROWSER AUTOMATION GATE');
    expect(errorMessage).toContain('chromium.launch()');
  });

  test('write content with page.screenshot() → blocks', async () => {
    const scriptContent = `await page.screenshot({ path: 'output.png' });`;
    const { errorMessage } = await expectBlocked(scriptContent, 'write');
    expect(errorMessage).toContain('BROWSER AUTOMATION GATE');
    expect(errorMessage).toContain('page.screenshot()');
  });

  test('write content with browser.newPage() → blocks', async () => {
    const scriptContent = `const page = await browser.newPage();`;
    const { errorMessage } = await expectBlocked(scriptContent, 'write');
    expect(errorMessage).toContain('BROWSER AUTOMATION GATE');
    expect(errorMessage).toContain('browser.newPage()');
  });

  test('write content with firefox.launch() → blocks', async () => {
    const scriptContent = `await firefox.launch();`;
    const { errorMessage } = await expectBlocked(scriptContent, 'write');
    expect(errorMessage).toContain('BROWSER AUTOMATION GATE');
    expect(errorMessage).toContain('firefox.launch()');
  });

  test('write content with webkit.launch() → blocks', async () => {
    const scriptContent = `await webkit.launch();`;
    const { errorMessage } = await expectBlocked(scriptContent, 'write');
    expect(errorMessage).toContain('BROWSER AUTOMATION GATE');
    expect(errorMessage).toContain('webkit.launch()');
  });

  // --- .cache paths ---

  test('.cache/puppeteer path → blocks', async () => {
    const { errorMessage } = await expectBlocked('.cache/puppeteer');
    expect(errorMessage).toContain('BROWSER AUTOMATION GATE');
    expect(errorMessage).toContain('Puppeteer');
  });

  test('.cache/playwright path → blocks', async () => {
    const { errorMessage } = await expectBlocked('.cache/playwright');
    expect(errorMessage).toContain('BROWSER AUTOMATION GATE');
    expect(errorMessage).toContain('Playwright');
  });

  // --- Chrome DevTools MCP ---

  test('mcp-devtools → blocks', async () => {
    const { errorMessage } = await expectBlocked('mcp-devtools');
    expect(errorMessage).toContain('BROWSER AUTOMATION GATE');
    expect(errorMessage).toContain('Chrome DevTools MCP');
  });

  // --- benign agent_browser_* NOT blocked ---

  test('agent_browser_screenshot → NOT blocked', async () => {
    await expectAllowed({ url: 'http://localhost:3000' }, 'agent_browser_screenshot');
  });

  test('agent_browser_navigate → NOT blocked', async () => {
    await expectAllowed({ url: 'http://localhost:3000' }, 'agent_browser_navigate');
  });

  test('agent_browser_snapshot → NOT blocked', async () => {
    await expectAllowed({}, 'agent_browser_snapshot');
  });

  test('agent_browser_batch → NOT blocked', async () => {
    await expectAllowed({ commands: 'navigate http://localhost:3000\nscreenshot' }, 'agent_browser_batch');
  });

  // --- benign content NOT blocked ---

  test('bash echo hello → NOT blocked', async () => {
    await expectAllowed('echo hello');
  });

  test('write benign JS content → NOT blocked', async () => {
    const benignCode = `
const axios = require('axios');
const response = await axios.get('http://api.example.com/data');
console.log(response.data);
`;
    await expectAllowed(benignCode, 'write');
  });

  test('read a path without playwright/puppeteer → NOT blocked', async () => {
    await expectAllowed('/tmp/screenshot-output.png', 'read');
  });
});
