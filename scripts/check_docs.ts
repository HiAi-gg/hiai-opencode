import { readFileSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const THIS_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(THIS_DIR, "..");

const PUBLIC_FILES = [
  "README.md",
  "AGENTS.md",
  "ARCHITECTURE.md",
  "LICENSE.md",
  "hiai-opencode.json",
  ".env.example",
];

const BLOCKED_PATTERNS = [
  { pattern: /[\u0400-\u04FF]/, label: "Cyrillic text" },
  { pattern: /C:\\hiai/i, label: "Private path C:\\hiai" },
  { pattern: /\/mnt\/ai_data/i, label: "Private path /mnt/ai_data" },
  { pattern: /\.claude(?!\w)/i, label: "Private .claude path" },
];

const DELETED_DOCS = [
  "start.md",
  "REGISTRY.md",
  "AGENTS_INFO.md",
  "docs/phase8-prompt-diet-report.md",
];

const BLOCKED_IN_CONFIG = [
  { pattern: /(?<![a-z0-9-])hiai-fast(?![a-z0-9-])/i, label: "Stale model alias: hiai-fast" },
  { pattern: /(?<![a-z0-9-])sonnet(?![a-z0-9-])(?!-)/i, label: "Stale model alias: sonnet (use claude-3.5-sonnet)" },
  { pattern: /(?<![a-z0-9-])haiku(?![a-z0-9-])/i, label: "Stale model alias: haiku" },
  { pattern: /claudeModelAliases/, label: "Stale config property: claudeModelAliases" },
  { pattern: /(?<![a-z0-9-])quality-guardian(?![a-z0-9-])/i, label: "Use public key: quality-guardian → critic" },
  { pattern: /(?<![a-z0-9-])platform-manager(?![a-z0-9-])/i, label: "Use public key: platform-manager → manager" },
  { pattern: /(?<![a-z0-9-])multimodal(?![a-z0-9-])/i, label: "Use public key: multimodal → vision" },
];

interface Violation {
  file: string;
  line: number;
  text: string;
  label: string;
}

function findViolations(filePath: string, content: string): Violation[] {
  const violations: Violation[] = [];
  try {
    const content = readFileSync(filePath, "utf-8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const { pattern, label } of BLOCKED_PATTERNS) {
        if (pattern.test(line)) {
          violations.push({
            file: filePath,
            line: i + 1,
            text: line.trim().slice(0, 120),
            label,
          });
        }
      }
    }

    for (const doc of DELETED_DOCS) {
      if (content.includes(doc)) {
        violations.push({
          file: filePath,
          line: 0,
          text: `References deleted doc: ${doc}`,
          label: "Deleted doc reference",
        });
      }
    }
  } catch {
    // skip unreadable files
  }
  return violations;
}

function checkConfigPatterns(content: string, filePath: string): Violation[] {
  const violations: Violation[] = [];
  for (const item of BLOCKED_IN_CONFIG) {
    if (item.pattern.test(content)) {
      violations.push({
        file: filePath,
        line: 0,
        text: `Contains blocked pattern: ${item.label}`,
        label: "Stale config key",
      });
    }
  }
  return violations;
}

const allViolations: Violation[] = [];

for (const fileName of PUBLIC_FILES) {
  const filePath = join(ROOT, fileName);
  try {
    statSync(filePath);
    const content = readFileSync(filePath, "utf-8");
    const violations = fileName.endsWith(".json")
      ? [...findViolations(filePath, content), ...checkConfigPatterns(content, filePath)]
      : findViolations(filePath, content);
    allViolations.push(...violations);
  } catch {
    // file doesn't exist, skip
  }
}

if (allViolations.length > 0) {
  console.log("DOCS HYGIENE VIOLATIONS FOUND:\n");
  for (const v of allViolations) {
    const loc = v.line > 0 ? `:${v.line}` : "";
    console.log(`  [${v.label}] ${v.file}${loc}`);
    console.log(`    > ${v.text}`);
    console.log();
  }
  console.log(`${allViolations.length} violation(s) found.`);
  process.exit(1);
} else {
  console.log("DOCS HYGIENE CHECK PASSED — no violations found.");
  process.exit(0);
}