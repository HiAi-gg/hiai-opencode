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

const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const child = spawn(npxCommand, ["-y", pkg, ...forwardArgs], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    npm_config_cache: cacheRoot,
    NPM_CONFIG_CACHE: cacheRoot,
    TEMP: tempRoot,
    TMP: tempRoot,
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error(`[hiai-opencode] Failed to launch ${pkg}:`, error);
  process.exit(1);
});
