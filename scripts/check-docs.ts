#!/usr/bin/env bun

import { readFileSync } from "node:fs";
import { join } from "node:path";

const DOCS = [
  "README.md",
  "AGENTS.md",
  "ARCHITECTURE.md",
  "LICENSE.md",
  "hiai-opencode.json",
  ".env.example",
];

const DELETED_DOCS = [
  "start.md",
  "REGISTRY.md",
  "AGENTS_INFO.md",
  "docs/phase8-prompt-diet-report.md",
];

const PRIVATE_PATTERNS = [
  /C:\\Users\\/,
  /C:\\hiai/,
  /\/mnt\/ai_data/,
  /\.claude(?![\/\\])/,
];

const CYRILLIC_PATTERN = /[а-яА-ЯёЁ]/;

let hasError = false;

const rootDir = process.cwd();

for (const doc of DOCS) {
  const filePath = join(rootDir, doc);
  let content = "";
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    console.log(`SKIP: ${doc} (not found)`);
    continue;
  }

  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (CYRILLIC_PATTERN.test(line)) {
      console.log(`ERROR: ${doc}:${i + 1}: Cyrillic text found`);
      hasError = true;
    }

    for (const pattern of PRIVATE_PATTERNS) {
      if (pattern.test(line)) {
        console.log(`ERROR: ${doc}:${i + 1}: Private path found: ${line.trim().slice(0, 60)}`);
        hasError = true;
      }
    }
  }

  for (const deleted of DELETED_DOCS) {
    if (content.includes(deleted)) {
      console.log(`ERROR: ${doc}: References deleted doc: ${deleted}`);
      hasError = true;
    }
  }
}

if (hasError) {
  console.log("\ncheck:docs FAILED");
  process.exit(1);
} else {
  console.log("check:docs PASSED");
  process.exit(0);
}