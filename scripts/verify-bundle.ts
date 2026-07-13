#!/usr/bin/env bun
/**
 * verify-bundle.ts — Post-build check: confirms dream/distill prompts are
 * present in the bundled dist/index.js.
 *
 * This catches the case where bun build drops the prompt files because they
 * are not imported. The check must be run after build and before publish.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const distFile = join(__dirname, "..", "dist", "index.js");

if (!existsSync(distFile)) {
  console.error("❌ dist/index.js not found — run `bun run build` first");
  process.exit(1);
}

const content = readFileSync(distFile, "utf-8");

const checks: [string, string, number][] = [
  ["Dream prompt", "Dream: Memory Consolidation", 500],
  ["Distill prompt", "Distill: Workflow Packaging", 500],
];

let failed = false;
for (const [label, needle, minLen] of checks) {
  if (!content.includes(needle)) {
    console.error(
      `❌ ${label} not found in dist/index.js — packaging will fail at runtime`,
    );
    failed = true;
  } else {
    const idx = content.indexOf(needle);
    const snippet = content.slice(idx, idx + minLen);
    if (snippet.length < minLen) {
      console.error(
        `❌ ${label} appears truncated in dist/index.js (${snippet.length} < ${minLen} chars)`,
      );
      failed = true;
    } else {
      console.log(`✅ ${label} present in dist/index.js`);
    }
  }
}

if (failed) process.exit(1);
