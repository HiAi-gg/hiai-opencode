import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type ToolContext, tool } from "@opencode-ai/plugin";
import { spawn } from "bun";
import { getToolSetting } from "../../config";
import { getSubprocessEnv } from "../../features/shell-env";

/** Log prefix for this plugin's runtime messages. */
const LOG_PREFIX = "[hiai-opencode]";

/** Agents permitted to call agent_browser_* tools at runtime. */
const ALLOWED_BROWSER_AGENTS = new Set(["vision", "general"]);

/**
 * Pure guard: throws if the current agent is not allowed to call browser tools.
 * Exported for unit-testing.
 */
export function browserGateGuard(context: ToolContext): void {
  const agent = context.agent ?? "unknown";
  if (!ALLOWED_BROWSER_AGENTS.has(agent)) {
    throw new Error(
      `[BOB HARD GATE] agent_browser_* tools are restricted to Vision (primary) and General (fallback). Agent "${agent}" attempted to call a browser tool. This call is blocked. Delegate browser operations to Vision via task({subagent_type: "vision", ...}).`,
    );
  }
}

/**
 * Quote-aware argument splitter. Splits a command string on whitespace while
 * keeping single- or double-quoted segments intact (e.g. `fill @e5 'some text'`
 * → `['fill', '@e5', 'some text']`). Replaces the old shell-string concatenation
 * + shellEscape approach so we can pass a real argv array to Bun.spawn.
 */
export function splitShellArgs(s: string): string[] {
  const out: string[] = [];
  const re = /'([^']*)'|"([^"]*)"|(\S+)/g;
  for (const m of s.matchAll(re)) {
    out.push(m[1] ?? m[2] ?? m[3] ?? "");
  }
  return out;
}

/**
 * Word-boundary regex patterns that indicate a headless/display problem.
 * Using `\b` anchors avoids false positives on substrings like "nodisplay" or
 * "redisplay" while still catching the canonical error messages.
 */
const HEADLESS_ERROR_PATTERNS: RegExp[] = [
  /\bno display\b/i,
  /\bcannot open display\b/i,
  /\bdisplay\b/i,
  /\bfailed to create some children\b/i,
  /\bcannot create window\b/i,
];

const SCREENSHOT_ERROR_PATTERNS = [
  "error",
  "failed",
  "no display",
  "screenshot",
];

export function isHeadlessError(output: string): boolean {
  return HEADLESS_ERROR_PATTERNS.some((re) => re.test(output));
}

function isScreenshotError(output: string): boolean {
  const lower = output.toLowerCase();
  return SCREENSHOT_ERROR_PATTERNS.some((p) => lower.includes(p));
}

/** Cap on captured subprocess output (Bun.spawn has no maxBuffer). */
const MAX_BUFFER = getToolSetting("agent_browser_max_buffer", 50 * 1024 * 1024);

/**
 * Read a ReadableStream of bytes into a string, capping at `max` bytes.
 * If the stream exceeds the cap, the remainder is drained and an overflow
 * marker is appended so the agent gets an actionable message instead of a
 * truncated/garbled buffer.
 */
async function readCapped(
  stream: ReadableStream<Uint8Array> | null,
  max: number,
): Promise<string> {
  if (!stream) return "";
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let overflow = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      if (total + value.length > max) {
        const remaining = max - total;
        if (remaining > 0) chunks.push(value.subarray(0, remaining));
        total = max;
        overflow = true;
        // Drain the rest without buffering.
        while (true) {
          const r = await reader.read();
          if (r.done) break;
        }
        break;
      }
      chunks.push(value);
      total += value.length;
    }
  } finally {
    reader.releaseLock();
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return overflow ? `${text}\n... [output truncated at ${max} bytes]` : text;
}

/**
 * Run an argv array via Bun.spawn, returning combined stdout/stderr.
 * Exported for unit testing (tested with harmless commands like `echo`).
 */
export async function runCommand(
  cmd: string[],
  cwd: string,
  timeoutMs = getToolSetting("agent_browser_command_timeout_ms", 30_000),
): Promise<string> {
  let proc: ReturnType<typeof spawn>;
  try {
    // Merge project shell_env vars into the subprocess environment when the
    // "agent-browser" integration is enabled. Falls back to Bun's default
    // (process.env) when injection is disabled.
    const shellEnv = getSubprocessEnv("agent-browser");
    proc = spawn(cmd, {
      stdout: "pipe",
      stderr: "pipe",
      cwd,
      ...(shellEnv ? { env: shellEnv } : {}),
    });
  } catch (e: unknown) {
    return `${LOG_PREFIX} Error: ${(e as Error).message}`;
  }
  const completed = (async () => {
    const stdout = await readCapped(
      proc.stdout as ReadableStream<Uint8Array> | null,
      MAX_BUFFER,
    );
    const stderr = await readCapped(
      proc.stderr as ReadableStream<Uint8Array> | null,
      MAX_BUFFER,
    );
    await proc.exited;
    return stdout || stderr;
  })();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<string>((resolve) => {
    timer = setTimeout(() => {
      proc.kill();
      resolve(`${LOG_PREFIX} Error: command timed out after ${timeoutMs}ms`);
    }, timeoutMs);
  });
  try {
    return await Promise.race([completed, timedOut]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function runAgentBrowser(args: string, cwd: string): Promise<string> {
  const raw = await runCommand(["agent-browser", ...splitShellArgs(args)], cwd);
  if (isHeadlessError(raw)) {
    return `${raw}\n${LOG_PREFIX} [Headless/display warning: ensure DISPLAY is set or Chrome is running with --disable-gpu in headless mode]`;
  }
  return raw;
}

/**
 * Run an agent-browser command, time its execution, and attach telemetry
 * metadata to the tool result via the OpenCode ToolContext. Every agent_browser_*
 * tool routes through this so results carry `duration_ms` / `output_bytes`
 * telemetry for auto-continue heuristics, cost tracking, and parent visibility.
 */
async function runAgentBrowserWithMeta(
  command: string,
  cwd: string,
  context: ToolContext,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const start = performance.now();
  const out = await runAgentBrowser(command, cwd);
  const duration_ms = Math.round(performance.now() - start);
  context.metadata({
    metadata: {
      tool: "agent_browser",
      command: command.split(" ")[0],
      duration_ms,
      output_bytes: Buffer.byteLength(out, "utf8"),
      ...extra,
    },
  });
  return out;
}

/**
 * Detect whether raw output from `agent-browser screenshot` is base64-encoded PNG data.
 * Real PNG base64 starts with the PNG magic "iVBORw0KGgo", is >1000 chars,
 * and contains only valid base64 characters.
 */
function isBase64Png(raw: string): boolean {
  const trimmed = raw.trim();
  return (
    trimmed.length > 1000 &&
    trimmed.startsWith("iVBORw0KGgo") &&
    /^[A-Za-z0-9+/=]+$/.test(trimmed)
  );
}

/**
 * Format screenshot output: if raw is base64, persist to disk and return path descriptor.
 * If already a path / JSON / text, return with size truncation guard.
 *
 * Exported for testing.
 */
export function formatScreenshotOutput(
  stdout: string,
  projectDir: string,
): string {
  const raw = stdout.trim();
  if (!raw) return "Screenshot: (empty output)";

  if (isBase64Png(raw)) {
    // Persist base64 to .bob/screenshots/
    const screenshotDir = join(projectDir, ".bob", "screenshots");
    mkdirSync(screenshotDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filePath = join(screenshotDir, `agent-browser-${timestamp}.png`);
    writeFileSync(filePath, Buffer.from(raw, "base64"));

    const stats = statSync(filePath);
    return `Screenshot saved: ${filePath} (${stats.size} bytes)`;
  }

  // Already a path / text — apply truncation guard
  const screenshotTrunc = getToolSetting(
    "agent_browser_screenshot_truncation_chars",
    5000,
  );
  if (raw.length > screenshotTrunc) {
    return `${raw.slice(0, screenshotTrunc)}\n... [output truncated at ${screenshotTrunc} chars]`;
  }
  return raw;
}

export function createAgentBrowserTools() {
  // Capture the working directory at plugin-init time (this factory is invoked
  // once when the plugin loads) and inject it via closure into every tool so
  // screenshots are persisted relative to the project root, not the runtime CWD.
  const cwd = process.cwd();
  return {
    agent_browser_navigate: tool({
      description: "Navigate to a URL",
      args: { url: tool.schema.string().describe("URL to navigate to") },
      async execute(args, context) {
        browserGateGuard(context);
        return runAgentBrowserWithMeta(`navigate ${args.url}`, cwd, context);
      },
    }),
    agent_browser_snapshot: tool({
      description: "Get accessibility tree snapshot",
      args: {},
      async execute(_args, context) {
        browserGateGuard(context);
        const out = await runAgentBrowserWithMeta("snapshot", cwd, context);
        const snapTrunc = getToolSetting(
          "agent_browser_snapshot_truncation_chars",
          2000,
        );
        return out?.length > snapTrunc
          ? `${out.slice(0, snapTrunc)}\n...`
          : out;
      },
    }),
    agent_browser_click: tool({
      description: "Click an element by reference",
      args: {
        ref: tool.schema.string().describe("Element reference like @eN"),
      },
      async execute(args, context) {
        browserGateGuard(context);
        return runAgentBrowserWithMeta(`click ${args.ref}`, cwd, context);
      },
    }),
    agent_browser_fill: tool({
      description: "Fill an input field",
      args: {
        ref: tool.schema.string().describe("Element reference like @eN"),
        text: tool.schema.string().describe("Text to fill"),
      },
      async execute(args, context) {
        browserGateGuard(context);
        return runAgentBrowserWithMeta(
          `fill ${args.ref} '${args.text}'`,
          cwd,
          context,
        );
      },
    }),
    agent_browser_type: tool({
      description: "Type into an input field",
      args: {
        ref: tool.schema.string().describe("Element reference like @eN"),
        text: tool.schema.string().describe("Text to type"),
      },
      async execute(args, context) {
        browserGateGuard(context);
        return runAgentBrowserWithMeta(
          `type ${args.ref} '${args.text}'`,
          cwd,
          context,
        );
      },
    }),
    agent_browser_screenshot: tool({
      description: "Take a screenshot (saved to .bob/screenshots/)",
      args: {},
      async execute(_args, context) {
        browserGateGuard(context);
        const start = performance.now();
        const stdout = await runAgentBrowser("screenshot", cwd);
        const duration_ms = Math.round(performance.now() - start);
        const rawTrim = stdout.trim();
        const screenshot_bytes = isBase64Png(rawTrim)
          ? Buffer.from(rawTrim, "base64").length
          : Buffer.byteLength(stdout, "utf8");
        context.metadata({
          metadata: {
            tool: "agent_browser",
            command: "screenshot",
            duration_ms,
            output_bytes: Buffer.byteLength(stdout, "utf8"),
            screenshot_bytes,
          },
        });
        if (!stdout.trim() || isScreenshotError(stdout)) {
          return `Screenshot: (empty or error output)\n${stdout}\nHint: check DISPLAY availability. In headless environments try --disable-gpu Chrome flag.`;
        }
        return formatScreenshotOutput(stdout, cwd);
      },
    }),
    agent_browser_eval: tool({
      description: "Evaluate JavaScript in the page",
      args: {
        code: tool.schema.string().describe("JavaScript code to evaluate"),
      },
      async execute(args, context) {
        browserGateGuard(context);
        return runAgentBrowserWithMeta(`eval '${args.code}'`, cwd, context);
      },
    }),
    agent_browser_wait: tool({
      description: "Wait for a specified duration",
      args: { ms: tool.schema.number().describe("Milliseconds to wait") },
      async execute(args, context) {
        browserGateGuard(context);
        return runAgentBrowserWithMeta(`wait ${args.ms}`, cwd, context);
      },
    }),
    agent_browser_close: tool({
      description: "Close the browser",
      args: {},
      async execute(_args, context) {
        browserGateGuard(context);
        return runAgentBrowserWithMeta("close", cwd, context);
      },
    }),
    agent_browser_console: tool({
      description: "Read browser console output",
      args: {},
      async execute(_args, context) {
        browserGateGuard(context);
        return runAgentBrowserWithMeta("console", cwd, context);
      },
    }),
    agent_browser_select: tool({
      description: "Select an option from a dropdown",
      args: {
        ref: tool.schema.string().describe("Element reference like @eN"),
        value: tool.schema.string().describe("Option value to select"),
      },
      async execute(args, context) {
        browserGateGuard(context);
        return runAgentBrowserWithMeta(
          `select ${args.ref} ${args.value}`,
          cwd,
          context,
        );
      },
    }),
    agent_browser_hover: tool({
      description: "Hover over an element",
      args: {
        ref: tool.schema.string().describe("Element reference like @eN"),
      },
      async execute(args, context) {
        browserGateGuard(context);
        return runAgentBrowserWithMeta(`hover ${args.ref}`, cwd, context);
      },
    }),
    agent_browser_press: tool({
      description: "Press a key",
      args: {
        key: tool.schema
          .string()
          .describe("Key to press (e.g. Enter, Tab, Escape)"),
      },
      async execute(args, context) {
        browserGateGuard(context);
        return runAgentBrowserWithMeta(`press ${args.key}`, cwd, context);
      },
    }),
    agent_browser_batch: tool({
      description: "Run multiple browser commands at once",
      args: {
        commands: tool.schema
          .string()
          .describe("Newline-separated agent-browser commands"),
      },
      async execute(args, context) {
        browserGateGuard(context);
        return runAgentBrowserWithMeta(
          `batch '${args.commands}'`,
          cwd,
          context,
        );
      },
    }),
    agent_browser_set_viewport: tool({
      description: "Set browser viewport size for responsive testing",
      args: {
        width: tool.schema.number().describe("Viewport width in pixels"),
        height: tool.schema.number().describe("Viewport height in pixels"),
      },
      async execute(args, context) {
        browserGateGuard(context);
        return runAgentBrowserWithMeta(
          `set viewport ${args.width} ${args.height}`,
          cwd,
          context,
        );
      },
    }),
    agent_browser_set_device: tool({
      description: 'Set browser device emulation (e.g. "iPhone 14", "Pixel 7")',
      args: {
        name: tool.schema
          .string()
          .describe("Device name from agent-browser device list"),
      },
      async execute(args, context) {
        browserGateGuard(context);
        return runAgentBrowserWithMeta(`set device ${args.name}`, cwd, context);
      },
    }),
  };
}
