#!/usr/bin/env bun

console.log("=== Release Audit ===");
let errors = 0;

const checks = [
  ["typecheck", ["bun", "run", "typecheck"]],
  ["test", ["bun", "test"]],
  ["ci", ["bun", "run", "ci"]],
  ["check:docs", ["bun", "run", "check:docs"]],
  ["pack:check", ["bun", "run", "pack:check"]],
];

function diagnosticText(value) {
  const text = new TextDecoder().decode(value).trim();
  return text.length > 4000 ? `${text.slice(0, 4000)}\n…truncated` : text;
}

for (const [name, command] of checks) {
  const result = Bun.spawnSync({
    cmd: command,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 120000,
  });
  if (result.exitCode === 0) {
    console.log(`  ${name}: PASS`);
  } else {
    console.log(
      `  ${name}: FAIL (exit=${result.exitCode}, command=${command.join(" ")})`,
    );
    const stderr = diagnosticText(result.stderr);
    const stdout = diagnosticText(result.stdout);
    if (stderr) console.log(stderr);
    else if (stdout) console.log(stdout);
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
