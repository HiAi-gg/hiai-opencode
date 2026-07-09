import { exec } from 'node:child_process';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { type ToolContext, tool } from '@opencode-ai/plugin';

const execAsync = promisify(exec);

/** Agents permitted to call agent_browser_* tools at runtime. */
const ALLOWED_BROWSER_AGENTS = new Set(['vision', 'general']);

/**
 * Pure guard: throws if the current agent is not allowed to call browser tools.
 * Exported for unit-testing.
 */
export function browserGateGuard(context: ToolContext): void {
  const agent = context.agent ?? 'unknown';
  if (!ALLOWED_BROWSER_AGENTS.has(agent)) {
    throw new Error(
      `[BOB HARD GATE] agent_browser_* tools are restricted to Vision (primary) and General (fallback). Agent "${agent}" attempted to call a browser tool. This call is blocked. Delegate browser operations to Vision via task({subagent_type: "vision", ...}).`,
    );
  }
}

function shellEscape(s: string): string {
  return s.replace(/'/g, "'\\''");
}

const HEADLESS_ERROR_PATTERNS = [
  'no display',
  'cannot open display',
  'DISPLAY',
  'Failed to create some children',
  'Cannot create window',
];

const SCREENSHOT_ERROR_PATTERNS = ['error', 'failed', 'no display', 'screenshot'];

function isHeadlessError(output: string): boolean {
  const lower = output.toLowerCase();
  return HEADLESS_ERROR_PATTERNS.some((p) => lower.includes(p.toLowerCase()));
}

function isScreenshotError(output: string): boolean {
  const lower = output.toLowerCase();
  return SCREENSHOT_ERROR_PATTERNS.some((p) => lower.includes(p));
}

async function runAgentBrowser(args: string): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(`agent-browser ${args}`, {
      timeout: 30_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    const raw = stdout || stderr;
    if (isHeadlessError(raw)) {
      return `${raw}\n[Headless/display warning: ensure DISPLAY is set or Chrome is running with --disable-gpu in headless mode]`;
    }
    return raw;
  } catch (e: unknown) {
    const err = e as { stdout?: string; stderr?: string; message?: string };
    const raw = err.stdout || err.stderr || `Error: ${err.message}`;
    if (isHeadlessError(raw)) {
      return `${raw}\n[Headless/display warning: ensure DISPLAY is set or Chrome is running with --disable-gpu in headless mode]`;
    }
    return raw;
  }
}

/**
 * Detect whether raw output from `agent-browser screenshot` is base64-encoded PNG data.
 * Real PNG base64 starts with the PNG magic "iVBORw0KGgo", is >1000 chars,
 * and contains only valid base64 characters.
 */
function isBase64Png(raw: string): boolean {
  const trimmed = raw.trim();
  return (
    trimmed.length > 1000 && trimmed.startsWith('iVBORw0KGgo') && /^[A-Za-z0-9+/=]+$/.test(trimmed)
  );
}

/**
 * Format screenshot output: if raw is base64, persist to disk and return path descriptor.
 * If already a path / JSON / text, return with size truncation guard.
 *
 * Exported for testing.
 */
export function formatScreenshotOutput(stdout: string, projectDir: string): string {
  const raw = stdout.trim();
  if (!raw) return 'Screenshot: (empty output)';

  if (isBase64Png(raw)) {
    // Persist base64 to .bob/screenshots/
    const screenshotDir = join(projectDir, '.bob', 'screenshots');
    mkdirSync(screenshotDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = join(screenshotDir, `agent-browser-${timestamp}.png`);
    writeFileSync(filePath, Buffer.from(raw, 'base64'));

    const stats = statSync(filePath);
    return `Screenshot saved: ${filePath} (${stats.size} bytes)`;
  }

  // Already a path / text — apply truncation guard
  if (raw.length > 5000) {
    return `${raw.slice(0, 5000)}\n... [output truncated at 5000 chars]`;
  }
  return raw;
}

/** Get a stable project directory (CWD when plugin loaded). */
function getProjectDir(): string {
  return process.cwd();
}

export function createAgentBrowserTools() {
  return {
    agent_browser_navigate: tool({
      description: 'Navigate to a URL',
      args: { url: tool.schema.string().describe('URL to navigate to') },
      async execute(args, context) {
        browserGateGuard(context);
        return runAgentBrowser(`navigate ${shellEscape(args.url)}`);
      },
    }),
    agent_browser_snapshot: tool({
      description: 'Get accessibility tree snapshot',
      args: {},
      async execute(_args, context) {
        browserGateGuard(context);
        return runAgentBrowser('snapshot').then((o) =>
          o?.length > 2000 ? `${o.slice(0, 2000)}\n...` : o,
        );
      },
    }),
    agent_browser_click: tool({
      description: 'Click an element by reference',
      args: { ref: tool.schema.string().describe('Element reference like @eN') },
      async execute(args, context) {
        browserGateGuard(context);
        return runAgentBrowser(`click ${args.ref}`);
      },
    }),
    agent_browser_fill: tool({
      description: 'Fill an input field',
      args: {
        ref: tool.schema.string().describe('Element reference like @eN'),
        text: tool.schema.string().describe('Text to fill'),
      },
      async execute(args, context) {
        browserGateGuard(context);
        return runAgentBrowser(`fill ${args.ref} '${shellEscape(args.text)}'`);
      },
    }),
    agent_browser_type: tool({
      description: 'Type into an input field',
      args: {
        ref: tool.schema.string().describe('Element reference like @eN'),
        text: tool.schema.string().describe('Text to type'),
      },
      async execute(args, context) {
        browserGateGuard(context);
        return runAgentBrowser(`type ${args.ref} '${shellEscape(args.text)}'`);
      },
    }),
    agent_browser_screenshot: tool({
      description: 'Take a screenshot (saved to .bob/screenshots/)',
      args: {},
      async execute(_args, context) {
        browserGateGuard(context);
        const stdout = await runAgentBrowser('screenshot');
        if (!stdout.trim() || isScreenshotError(stdout)) {
          return `Screenshot: (empty or error output)\n${stdout}\nHint: check DISPLAY availability. In headless environments try --disable-gpu Chrome flag.`;
        }
        return formatScreenshotOutput(stdout, getProjectDir());
      },
    }),
    agent_browser_eval: tool({
      description: 'Evaluate JavaScript in the page',
      args: { code: tool.schema.string().describe('JavaScript code to evaluate') },
      async execute(args, context) {
        browserGateGuard(context);
        return runAgentBrowser(`eval '${shellEscape(args.code)}'`);
      },
    }),
    agent_browser_wait: tool({
      description: 'Wait for a specified duration',
      args: { ms: tool.schema.number().describe('Milliseconds to wait') },
      async execute(args, context) {
        browserGateGuard(context);
        return runAgentBrowser(`wait ${args.ms}`);
      },
    }),
    agent_browser_close: tool({
      description: 'Close the browser',
      args: {},
      async execute(_args, context) {
        browserGateGuard(context);
        return runAgentBrowser('close');
      },
    }),
    agent_browser_console: tool({
      description: 'Read browser console output',
      args: {},
      async execute(_args, context) {
        browserGateGuard(context);
        return runAgentBrowser('console');
      },
    }),
    agent_browser_select: tool({
      description: 'Select an option from a dropdown',
      args: {
        ref: tool.schema.string().describe('Element reference like @eN'),
        value: tool.schema.string().describe('Option value to select'),
      },
      async execute(args, context) {
        browserGateGuard(context);
        return runAgentBrowser(`select ${args.ref} ${args.value}`);
      },
    }),
    agent_browser_hover: tool({
      description: 'Hover over an element',
      args: { ref: tool.schema.string().describe('Element reference like @eN') },
      async execute(args, context) {
        browserGateGuard(context);
        return runAgentBrowser(`hover ${args.ref}`);
      },
    }),
    agent_browser_press: tool({
      description: 'Press a key',
      args: { key: tool.schema.string().describe('Key to press (e.g. Enter, Tab, Escape)') },
      async execute(args, context) {
        browserGateGuard(context);
        return runAgentBrowser(`press ${args.key}`);
      },
    }),
    agent_browser_batch: tool({
      description: 'Run multiple browser commands at once',
      args: { commands: tool.schema.string().describe('Newline-separated agent-browser commands') },
      async execute(args, context) {
        browserGateGuard(context);
        return runAgentBrowser(`batch '${shellEscape(args.commands)}'`);
      },
    }),
    agent_browser_set_viewport: tool({
      description: 'Set browser viewport size for responsive testing',
      args: {
        width: tool.schema.number().describe('Viewport width in pixels'),
        height: tool.schema.number().describe('Viewport height in pixels'),
      },
      async execute(args, context) {
        browserGateGuard(context);
        return runAgentBrowser(`set viewport ${args.width} ${args.height}`);
      },
    }),
    agent_browser_set_device: tool({
      description: 'Set browser device emulation (e.g. "iPhone 14", "Pixel 7")',
      args: {
        name: tool.schema.string().describe('Device name from agent-browser device list'),
      },
      async execute(args, context) {
        browserGateGuard(context);
        return runAgentBrowser(`set device ${shellEscape(args.name)}`);
      },
    }),
  };
}
