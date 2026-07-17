#!/usr/bin/env node

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

function resolveCacheRoot() {
  const xdgCache = process.env.XDG_CACHE_HOME?.trim();
  if (xdgCache) {
    return xdgCache;
  }

  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const pluginRoot = join(scriptDir, "..", "..");
  return join(pluginRoot, ".runtime-cache");
}

const [pkg, ...forwardArgs] = process.argv.slice(2);

if (!pkg) {
  console.error("[hiai-opencode] npm-package-runner requires a package name");
  process.exit(1);
}

const cacheRoot = join(resolveCacheRoot(), "hiai-opencode", "npm");
const tempRoot = join(cacheRoot, "tmp");
mkdirSync(tempRoot, { recursive: true });

// Exit codes: keep them distinct and meaningful so the parent (MCP client /
// OpenCode) can reason about failures instead of inheriting a raw signal.
const EXIT_OK = 0;
const EXIT_LAUNCH_FAILED = 1;
const EXIT_CHILD_SIGNALED = 2;

// A line is forwarded to the parent stdout only when it is a well-formed
// JSON-RPC message. Anything else (npx download banners, warnings, stack
// traces) is treated as noise and redirected to stderr so it never corrupts
// the MCP protocol stream on stdout.
function isJsonRpcLine(line) {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith("{")) {
    return false;
  }
  try {
    const parsed = JSON.parse(trimmed);
    return (
      parsed !== null &&
      typeof parsed === "object" &&
      (parsed.jsonrpc === "2.0" || typeof parsed.id !== "undefined" || typeof parsed.method === "string")
    );
  } catch {
    return false;
  }
}

function writeStderr(prefix, chunk) {
  const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
  for (const line of text.split(/\r?\n/)) {
    if (line.length === 0) continue;
    process.stderr.write(`${prefix}${line}\n`);
  }
}

const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const child = spawn(npxCommand, ["-y", pkg, ...forwardArgs], {
  // Do NOT use stdio: "inherit". The child's stdout must be filtered so that
  // only valid JSON-RPC reaches the parent's stdout; stdin is inherited so the
  // MCP client can drive the child, stderr is piped for safe redirection.
  stdio: ["inherit", "pipe", "pipe"],
  shell: process.platform === "win32",
  env: {
    ...process.env,
    npm_config_cache: cacheRoot,
    NPM_CONFIG_CACHE: cacheRoot,
    TEMP: tempRoot,
    TMP: tempRoot,
  },
});

// Forward only protocol-valid lines to the parent stdout.
let stdoutBuffer = "";
child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  stdoutBuffer += chunk;
  let newlineIndex;
  while ((newlineIndex = stdoutBuffer.indexOf("\n")) !== -1) {
    const line = stdoutBuffer.slice(0, newlineIndex);
    stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
    if (isJsonRpcLine(line)) {
      process.stdout.write(`${line}\n`);
    } else {
      writeStderr(`[hiai-opencode:${pkg}] `, line);
    }
  }
});

child.stdout.on("end", () => {
  if (stdoutBuffer.length > 0) {
    const line = stdoutBuffer;
    stdoutBuffer = "";
    if (isJsonRpcLine(line)) {
      process.stdout.write(`${line}\n`);
    } else {
      writeStderr(`[hiai-opencode:${pkg}] `, line);
    }
  }
});

// Child stderr is diagnostic output — never let it reach the parent stdout.
child.stderr.setEncoding("utf8");
child.stderr.on("data", (chunk) => {
  writeStderr(`[hiai-opencode:${pkg}:stderr] `, chunk);
});

child.on("exit", (code, signal) => {
  if (signal) {
    // A killed child (e.g. SIGTERM) is reported distinctly, not silently
    // inherited. We still surface the signal on stderr for diagnostics.
    process.stderr.write(
      `[hiai-opencode] ${pkg} terminated by signal ${signal}\n`,
    );
    process.exit(EXIT_CHILD_SIGNALED);
  }
  process.exit(code ?? EXIT_OK);
});

child.on("error", (error) => {
  process.stderr.write(`[hiai-opencode] Failed to launch ${pkg}: ${error?.message ?? error}\n`);
  process.exit(EXIT_LAUNCH_FAILED);
});

// If the runner itself is terminated (e.g. the MCP client shuts it down),
// forward the signal to the child and exit with a distinct, non-zero code
// instead of letting Node emit the raw 128+signal value.
for (const sig of ["SIGTERM", "SIGINT", "SIGHUP"]) {
  process.on(sig, () => {
    if (!child.killed) {
      try {
        child.kill(sig);
      } catch {
        /* child may already be gone */
      }
    }
    process.exit(EXIT_CHILD_SIGNALED);
  });
}
