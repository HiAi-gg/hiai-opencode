#!/usr/bin/env node

import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { spawn, spawnSync } from "node:child_process"

function resolveCacheRoot() {
  const xdgCache = process.env.XDG_CACHE_HOME?.trim()
  if (xdgCache) return xdgCache

  const scriptDir = dirname(fileURLToPath(import.meta.url))
  const pluginRoot = join(scriptDir, "..", "..")
  return join(pluginRoot, ".runtime-cache")
}

function runNpx(args, stdio = "inherit") {
  const cacheRoot = join(resolveCacheRoot(), "hiai-opencode", "npm")
  const tempRoot = join(cacheRoot, "tmp")
  mkdirSync(tempRoot, { recursive: true })

  const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx"
  return spawnSync(npxCommand, args, {
    stdio,
    shell: process.platform === "win32",
    env: {
      ...process.env,
      npm_config_cache: cacheRoot,
      NPM_CONFIG_CACHE: cacheRoot,
      TEMP: tempRoot,
      TMP: tempRoot,
    },
  })
}

function shouldInstallBrowsers() {
  const value = process.env.HIAI_PLAYWRIGHT_INSTALL_BROWSERS?.trim().toLowerCase()
  return value === "1" || value === "true" || value === "yes"
}

if (shouldInstallBrowsers()) {
  const result = runNpx(["-y", "playwright@latest", "install", "chromium"])
  if (result.status !== 0) {
    console.error("[hiai-opencode] playwright browser install failed")
  }
}

const cacheRoot = join(resolveCacheRoot(), "hiai-opencode", "npm")
const tempRoot = join(cacheRoot, "tmp")
mkdirSync(tempRoot, { recursive: true })

const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx"
const child = spawn(npxCommand, ["-y", "@playwright/mcp@latest", ...process.argv.slice(2)], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    npm_config_cache: cacheRoot,
    NPM_CONFIG_CACHE: cacheRoot,
    TEMP: tempRoot,
    TMP: tempRoot,
  },
})

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 0)
})

child.on("error", (error) => {
  console.error("[hiai-opencode] playwright launcher failed:", error)
  process.exit(1)
})
