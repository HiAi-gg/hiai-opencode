#!/usr/bin/env bun

import { execSync } from "node:child_process";

console.log("=== Release Audit ===");
let errors = 0;

const checks = [
  ["typecheck", "bun run typecheck"],
  ["build", "bun run build"],
  ["test", "bun test"],
  ["check:docs", "bun run check:docs"],
  ["pack:check", "npm run pack:check"],
];

for (const [name, cmd] of checks) {
  try {
    execSync(cmd, { encoding: "utf-8", stdio: "pipe", timeout: 120000 });
    console.log(`  ${name}: PASS`);
  } catch (e) {
    console.log(`  ${name}: FAIL`);
    errors++;
  }
}

console.log("");
if (errors === 0) {
  console.log("=== ALL CHECKS PASSED ===");
  process.exit(0);
} else {
  console.log(`=== ${errors} CHECK(S) FAILED ===`);
  process.exit(1);
}