#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { parse as parseJsonc } from "jsonc-parser";

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

function resolveEnvTemplate(value) {
  if (typeof value !== "string") return "";
  return value.replace(/\{env:([^}]+)\}/g, (_match, expression) => {
    const [name, fallback] = String(expression).split(":-", 2);
    return process.env[name] || fallback || "";
  }).trim();
}

function candidateConfigPaths() {
  const cwd = process.cwd();
  const home = homedir();
  const paths = [
    join(cwd, "hiai-opencode.json"),
    join(cwd, "hiai-opencode.jsonc"),
    join(cwd, ".opencode", "hiai-opencode.json"),
    join(cwd, ".opencode", "hiai-opencode.jsonc"),
    join(home, ".config", "opencode", "hiai-opencode.json"),
    join(home, ".config", "opencode", "hiai-opencode.jsonc"),
  ];

  if (process.platform === "win32" && process.env.APPDATA) {
    paths.push(join(process.env.APPDATA, "opencode", "hiai-opencode.json"));
    paths.push(join(process.env.APPDATA, "opencode", "hiai-opencode.jsonc"));
  }

  return paths;
}

function loadUserConfig() {
  for (const path of candidateConfigPaths()) {
    if (!existsSync(path)) continue;
    try {
      return parseJsonc(readFileSync(path, "utf-8")) ?? {};
    } catch {
      return {};
    }
  }
  return {};
}

function getConfiguredPythonPath() {
  const config = loadUserConfig();
  const value = config?.mcp?.mempalace?.pythonPath;
  return resolveEnvTemplate(typeof value === "string" ? value : "");
}

function resolveVenvPythonCandidates(basePath) {
  if (!basePath) return [];

  if (process.platform === "win32") {
    return [
      join(basePath, ".venv", "Scripts", "python.exe"),
      join(basePath, "venv", "Scripts", "python.exe"),
    ];
  }

  return [
    join(basePath, ".venv", "bin", "python"),
    join(basePath, ".venv", "bin", "python3"),
    join(basePath, "venv", "bin", "python"),
    join(basePath, "venv", "bin", "python3"),
  ];
}

function pythonCandidates() {
  const configPython = getConfiguredPythonPath();
  const explicit = process.env.MEMPALACE_PYTHON?.trim();
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const pluginRoot = join(scriptDir, "..", "..");
  const candidates = [];

  if (explicit) {
    candidates.push({ command: explicit, args: [] });
  }

  if (configPython) {
    candidates.push({ command: configPython, args: [] });
  }

  for (const candidate of resolveVenvPythonCandidates(process.cwd())) {
    if (existsSync(candidate)) {
      candidates.push({ command: candidate, args: [] });
    }
  }

  for (const candidate of resolveVenvPythonCandidates(pluginRoot)) {
    if (existsSync(candidate)) {
      candidates.push({ command: candidate, args: [] });
    }
  }

  for (const candidate of resolveVenvPythonCandidates(join(homedir(), ".config", "opencode", "plugins", "hiai-opencode"))) {
    if (existsSync(candidate)) {
      candidates.push({ command: candidate, args: [] });
    }
  }

  if (process.platform === "win32") {
    candidates.push({ command: "py", args: ["-3"] });
  }

  candidates.push({ command: "python3", args: [] });
  candidates.push({ command: "python", args: [] });

  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = `${candidate.command}\0${candidate.args.join("\0")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
    [...candidate.args, "-c", `import importlib, sys; importlib.import_module("${moduleName}")`],
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

function resolvePythonForPip() {
  for (const candidate of pythonCandidates()) {
    const probe = spawnSync(
      candidate.command,
      [...candidate.args, "-m", "pip", "--version"],
      { stdio: "ignore", timeout: 10000 },
    );

    if (probe.status === 0) {
      return candidate;
    }
  }

  return null;
}

function shouldAutoInstall() {
  const value = process.env.HIAI_MCP_AUTO_INSTALL?.trim().toLowerCase();
  return value !== "0" && value !== "false" && value !== "no";
}

function installMempalaceWithPip(candidate) {
  const result = spawnSync(
    candidate.command,
    [...candidate.args, "-m", "pip", "install", "--user", "mempalace"],
    { stdio: "inherit", timeout: 300000 },
  );

  return result.status === 0 && canRunModule(candidate, "mempalace.mcp_server");
}

function spawnWithUv(uvBinary, palacePath) {
  return spawn(
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

  const configuredPython =
    process.env.MEMPALACE_PYTHON?.trim() || getConfiguredPythonPath();
  if (configuredPython) {
    const configuredCandidate = { command: configuredPython, args: [] };
    if (canRunModule(configuredCandidate, "mempalace.mcp_server")) {
      const configuredChild = spawn(
        configuredCandidate.command,
        [...configuredCandidate.args, "-m", "mempalace.mcp_server", "--palace", palacePath],
        {
          stdio: "inherit",
          env: {
            ...process.env,
            MEMPALACE_PALACE_PATH: palacePath,
          },
        },
      );
      forwardChildExit(configuredChild, "[hiai-opencode] mempalace launcher failed:");
      return;
    }
  }

  const uvBinary = hasUv();
  if (uvBinary) {
    const child = spawnWithUv(uvBinary, palacePath);

    forwardChildExit(child, "[hiai-opencode] mempalace uv launcher failed:");
    return;
  }

  const python = resolvePythonForMempalace();
  const fallbackPython =
    python
    || (shouldAutoInstall()
      ? (() => {
        const pipPython = resolvePythonForPip();
        if (pipPython && installMempalaceWithPip(pipPython)) {
          return pipPython;
        }

        const fallbackUv = hasUv();
        if (fallbackUv) {
          const uvChild = spawnWithUv(fallbackUv, palacePath);
          forwardChildExit(uvChild, "[hiai-opencode] mempalace uv fallback failed:");
          return "__uv_fallback_started__";
        }

        return null;
      })()
      : null);

  if (fallbackPython === "__uv_fallback_started__") {
    return;
  }

  if (!fallbackPython) {
    console.error(
      "[hiai-opencode] mempalace skipped: install uv or Python 3.9+ with `pip install --user mempalace`",
    );
    process.exit(0);
  }

  const child = spawn(
    fallbackPython.command,
    [...fallbackPython.args, "-m", "mempalace.mcp_server", "--palace", palacePath],
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
