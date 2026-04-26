#!/usr/bin/env bun

console.log("=== hiai-opencode Doctor ===");
console.log("");

console.log("Versions:");
try {
  const { execSync } = require("node:child_process");
  const cmds = [
    ["opencode", ["--version"]],
    ["node", ["--version"]],
    ["bun", ["--version"]],
  ];
  for (const [name, args] of cmds) {
    try {
      const result = execSync(`${name} ${args.join(" ")}`, { encoding: "utf-8", timeout: 5000 }).trim();
      console.log(`  ${name}: ${result}`);
    } catch {
      console.log(`  ${name}: NOT FOUND`);
    }
  }
} catch {
  console.log("  (exec unavailable)");
}

console.log("");
console.log("Python:");
try {
  const { execSync } = require("node:child_process");
  for (const cmd of ["python --version", "python3 --version"]) {
    try {
      const result = execSync(cmd, { encoding: "utf-8", timeout: 5000 }).trim();
      console.log(`  ${result}`);
      break;
    } catch {}
  }
} catch {}

console.log("");
console.log("Plugin:");
try {
  const { execSync } = require("node:child_process");
  const result = execSync("opencode debug config 2>/dev/null", { encoding: "utf-8", timeout: 10000 });
  if (result.includes("hiai")) {
    console.log("  Plugin found in config");
  } else {
    console.log("  Plugin NOT found in config");
  }
} catch {
  console.log("  Cannot check plugin status (opencode may not be available)");
}

console.log("");
console.log("Config files:");
const fs = require("node:fs");
const checks = [
  ["hiai-opencode.json", "hiai-opencode.json"],
  [".env.example", ".env.example"],
  ["AGENTS.md", "AGENTS.md"],
  ["README.md", "README.md"],
];
for (const [label, path] of checks) {
  const exists = fs.existsSync(path);
  console.log(`  ${label}: ${exists ? "EXISTS" : "MISSING"}`);
}

console.log("");
console.log("=== Doctor complete ===");