#!/usr/bin/env node

import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

function resolveCacheRoot() {
  const xdgCache = process.env.XDG_CACHE_HOME?.trim();
  if (xdgCache) {
    return xdgCache;
  }

  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const pluginRoot = join(scriptDir, "..", "..");
  return join(pluginRoot, ".runtime-cache");
}

function parsePalacePath(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--palace") {
      return argv[index + 1];
    }
  }

  return process.env.MEMPALACE_PALACE_PATH
    || join(resolveCacheRoot(), "hiai-opencode", "mempalace-palace");
}

function pythonCandidates() {
  const explicit = process.env.MEMPALACE_PYTHON?.trim();
  const candidates = [];

  if (explicit) {
    candidates.push({ command: explicit, args: [] });
  }

  if (process.platform === "win32") {
    candidates.push({ command: "py", args: ["-3"] });
  }

  candidates.push({ command: "python3", args: [] });
  candidates.push({ command: "python", args: [] });

  return candidates;
}

function hasUv() {
  const binary = process.platform === "win32" ? "uv.exe" : "uv";
  const probe = spawnSync(binary, ["--version"], {
    stdio: "ignore",
    timeout: 10000,
  });
  return probe.status === 0 ? binary : null;
}

function canRunModule(candidate, moduleName) {
  const probe = spawnSync(
    candidate.command,
    [...candidate.args, "-c", `import importlib.util, sys; sys.exit(0 if importlib.util.find_spec("${moduleName}") else 1)`],
    { stdio: "ignore", timeout: 10000 },
  );

  return probe.status === 0;
}

function resolvePythonForMempalace() {
  for (const candidate of pythonCandidates()) {
    if (canRunModule(candidate, "mempalace.mcp_server")) {
      return candidate;
    }
  }

  return null;
}

function resolveUvCacheRoot() {
  return process.env.UV_CACHE_DIR
    || join(resolveCacheRoot(), "hiai-opencode", "uv");
}

function forwardChildExit(child, errorLabel) {
  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 0);
  });

  child.on("error", (error) => {
    console.error(errorLabel, error);
    process.exit(1);
  });
}

function main() {
  const palacePath = parsePalacePath(process.argv.slice(2));
  mkdirSync(palacePath, { recursive: true });

  const uvBinary = hasUv();
  if (uvBinary) {
    const child = spawn(
      uvBinary,
      [
        "tool",
        "run",
        "--from",
        "mempalace[all]>=3.3.0",
        "python",
        "-m",
        "mempalace.mcp_server",
        "--palace",
        palacePath,
      ],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          UV_CACHE_DIR: resolveUvCacheRoot(),
          MEMPALACE_PALACE_PATH: palacePath,
        },
      },
    );

    forwardChildExit(child, "[hiai-opencode] mempalace uv launcher failed:");
    return;
  }

  const python = resolvePythonForMempalace();
  if (!python) {
    console.error(
      "[hiai-opencode] mempalace skipped: install uv or Python 3.9+ with `pip install mempalace`",
    );
    process.exit(0);
  }

  const child = spawn(
    python.command,
    [...python.args, "-m", "mempalace.mcp_server", "--palace", palacePath],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        MEMPALACE_PALACE_PATH: palacePath,
      },
    },
  );

  forwardChildExit(child, "[hiai-opencode] mempalace launcher failed:");
}

main();
