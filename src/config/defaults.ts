/**
 * Runtime defaults for hiai-opencode.
 *
 * Model defaults are intentionally not defined in TypeScript.
 * The bundled hiai-opencode.json file is the single source of truth for:
 * - agent models
 * - category models
 * - user-editable runtime defaults
 */
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, normalize } from "node:path"
import type { HiaiOpencodeConfig } from "./types.js"

function findPluginRoot(): string {
  const candidates = [
    // Source tree: src/config/defaults.ts -> repo root
    join(import.meta.dirname, "..", ".."),
    // Built package: dist/index.js bundle -> package root
    join(import.meta.dirname, ".."),
    // Non-bundled compiled output: dist/config/defaults.js -> package root
    join(import.meta.dirname, "..", ".."),
    dirname(process.argv[1] ?? ""),
    process.cwd(),
  ]

  for (const candidate of candidates) {
    const root = normalize(candidate)
    if (existsSync(join(root, "hiai-opencode.json"))) {
      return root
    }
  }

  throw new Error(
    "[hiai-opencode] Cannot find bundled hiai-opencode.json. The package is incomplete.",
  )
}

function expandPluginRootPlaceholders(value: unknown, pluginRoot: string): unknown {
  if (typeof value === "string") {
    return value.replaceAll("{pluginRoot}", pluginRoot)
  }

  if (Array.isArray(value)) {
    return value.map((item) => expandPluginRootPlaceholders(item, pluginRoot))
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        expandPluginRootPlaceholders(entry, pluginRoot),
      ]),
    )
  }

  return value
}

function loadBundledDefaultConfig(): HiaiOpencodeConfig {
  const pluginRoot = findPluginRoot()
  const configPath = join(pluginRoot, "hiai-opencode.json")
  const raw = readFileSync(configPath, "utf-8")
  const parsed = JSON.parse(raw) as HiaiOpencodeConfig

  return expandPluginRootPlaceholders(parsed, pluginRoot) as HiaiOpencodeConfig
}

export const defaultConfig: HiaiOpencodeConfig = loadBundledDefaultConfig()
