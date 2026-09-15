#!/usr/bin/env bun

import { readFileSync } from "node:fs";
import { join } from "node:path";

const DOCS = [
  "README.md",
  "AGENTS.md",
  "ARCHITECTURE.md",
  "LICENSE.md",
  "bob.json",
  "bob.env.example",
];

const DELETED_DOCS = [
  "start.md",
  "REGISTRY.md",
  "AGENTS_INFO.md",
  "docs/phase8-prompt-diet-report.md",
  "hiai-opencode.json",
  ".env.example",
];

const PRIVATE_PATTERNS = [
  /C:\\Users\\/,
  /C:\\hiai/,
  /\/mnt\/ai_data/,
  /\.claude(?![/\\])/,
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
        console.log(
          `ERROR: ${doc}:${i + 1}: Private path found: ${line.trim().slice(0, 60)}`,
        );
        hasError = true;
      }
    }
  }

  for (const deleted of DELETED_DOCS) {
    // Use regex with word boundaries to avoid false positives
    // (e.g. "bob.env.example" matching ".env.example")
    const escaped = deleted.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?<!bob)${escaped}`, "g");
    if (re.test(content)) {
      console.log(`ERROR: ${doc}: References deleted doc: ${deleted}`);
      hasError = true;
    }
  }
}

// Workstation operator docs must not provision Chrome. Public README still
// documents `agent-browser install` as an upstream-host option.
const agentsMdPath = join(rootDir, "AGENTS.md");
try {
  const agentsMd = readFileSync(agentsMdPath, "utf-8");
  if (/bun add -g agent-browser\s+&&\s+agent-browser install/.test(agentsMd)) {
    console.log(
      "ERROR: AGENTS.md: workstation bootstrap must not run `agent-browser install` (Chrome). Use Lightpanda; document Chrome as an upstream-host option only.",
    );
    hasError = true;
  }
  if (!/lightpanda/i.test(agentsMd)) {
    console.log("ERROR: AGENTS.md: missing Lightpanda workstation engine");
    hasError = true;
  }
} catch {
  console.log("ERROR: AGENTS.md: not found");
  hasError = true;
}

const readmePath = join(rootDir, "README.md");
try {
  const readme = readFileSync(readmePath, "utf-8");
  if (/#\s*986 tests/.test(readme)) {
    console.log(
      "ERROR: README.md: stale `986 tests` claim — do not hard-code a drifting test count",
    );
    hasError = true;
  }
  if (!readme.includes("agent-browser install")) {
    console.log(
      "ERROR: README.md: must still document `agent-browser install` as an upstream-host Chrome option",
    );
    hasError = true;
  }
  if (!/ROADMAP\.md/.test(readme)) {
    console.log("ERROR: README.md: Roadmap section must point at ROADMAP.md");
    hasError = true;
  }
} catch {
  console.log("ERROR: README.md: not found");
  hasError = true;
}

const pkgPath = join(rootDir, "package.json");
try {
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
    files?: unknown;
  };
  const files = Array.isArray(pkg.files)
    ? pkg.files.filter((entry): entry is string => typeof entry === "string")
    : [];
  if (!files.includes("ROADMAP.md")) {
    console.log(
      "ERROR: package.json files must include ROADMAP.md so the README link works in the unpacked npm package",
    );
    hasError = true;
  }
} catch {
  console.log("ERROR: package.json: not found or unparseable");
  hasError = true;
}

if (hasError) {
  console.log("\ncheck:docs FAILED");
  process.exit(1);
} else {
  console.log("check:docs PASSED");
  process.exit(0);
}
