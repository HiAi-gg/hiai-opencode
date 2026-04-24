#!/usr/bin/env bun
/**
 * hiai-opencode doctor
 * Diagnostic command for open-source users to verify their local environment.
 * Run: bun run doctor
 *
 * Exit codes:
 *   0 = all required checks pass (optional warnings OK)
 *   1 = required check failed
 */

import { existsSync } from "node:fs";
import { statSync } from "node:fs";
import { readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const IS_WIN = process.platform === "win32";

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const BLUE = "\x1b[34m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

type CheckResult = "pass" | "warn" | "fail";

interface Check {
  name: string;
  result: CheckResult;
  detail: string;
  fix?: string;
}

function green(s: string) { return `${GREEN}${s}${RESET}`; }
function yellow(s: string) { return `${YELLOW}${s}${RESET}`; }
function red(s: string) { return `${RED}${s}${RESET}`; }
function blue(s: string) { return `${BLUE}${s}${RESET}`; }
function dim(s: string) { return `${DIM}${s}${RESET}`; }

function execQuiet(cmd: string): string {
  try {
    const out = execSync(cmd, { encoding: "utf-8", timeout: 10000 } as Parameters<typeof execSync>[1]);
    return String(out).trim();
  } catch {
    return "";
  }
}

function findBinary(name: string): string {
  if (IS_WIN) {
    const out = execQuiet(`where ${name}`);
    if (out) return out.split("\n")[0].trim();
    return "";
  }
  const out = execQuiet(`command -v ${name} || which ${name} 2>/dev/null || true`);
  return out;
}

function checkNode(): Check {
  const version = execQuiet("node --version");
  if (!version) {
    return {
      name: "Node.js",
      result: "warn",
      detail: "not found in PATH",
      fix: "Install Node.js >=18 if you use npx-backed MCP/LSP helpers: https://nodejs.org/",
    };
  }
  const major = parseInt(version.replace("v", "").split(".")[0]);
  if (major < 18) {
    return {
      name: "Node.js",
      result: "warn",
      detail: `found ${version}, requires >=18`,
      fix: "Upgrade Node.js to >=18: https://nodejs.org/",
    };
  }
  return { name: "Node.js", result: "pass", detail: `v${version} (>=18 OK)` };
}

function checkBun(): Check {
  const currentBun = (process.versions as { bun?: string }).bun;
  if (currentBun) {
    const parts = currentBun.replace("v", "").split(".").map(Number);
    const major = parts[0] ?? 0;
    const minor = parts[1] ?? 0;
    if (major > 1 || (major === 1 && minor >= 1)) {
      return { name: "Bun", result: "pass", detail: `v${currentBun} (current runtime, >=1.1.0 OK)` };
    }
    return {
      name: "Bun",
      result: "fail",
      detail: `current runtime is ${currentBun}, requires >=1.1.0`,
      fix: "Upgrade Bun: https://bun.sh/",
    };
  }

  const version = execQuiet("bun --version");
  if (!version) {
    return {
      name: "Bun",
      result: "fail",
      detail: "not found in PATH",
      fix: "Install Bun >=1.1.0: https://bun.sh/",
    };
  }
  const parts = version.replace("v", "").split(".").map(Number);
  const major = parts[0] ?? 0;
  const minor = parts[1] ?? 0;
  if (major < 1 || (major === 1 && minor < 1)) {
    return {
      name: "Bun",
      result: "fail",
      detail: `found ${version}, requires >=1.1.0`,
      fix: "Upgrade Bun: https://bun.sh/",
    };
  }
  return { name: "Bun", result: "pass", detail: `v${version} (>=1.1.0 OK)` };
}

function checkOpenCodeBinary(): Check {
  const path = findBinary("opencode");
  if (!path) {
    return {
      name: "OpenCode binary",
      result: "warn",
      detail: "not found in PATH",
      fix: "Install OpenCode before runtime verification: https://opencode.ai/",
    };
  }
  const version = execQuiet("opencode --version");
  return {
    name: "OpenCode binary",
    result: "pass",
    detail: `found at ${path}${version ? `, version ${version}` : ""}`,
  };
}

function getScriptDir(): string {
  return dirname(fileURLToPath(import.meta.url));
}

function checkBuild(): Check {
  const distDir = join(getScriptDir(), "..", "dist");
  if (!existsSync(distDir)) {
    return {
      name: "Plugin build",
      result: "fail",
      detail: "dist/ not found — run 'bun run build' first",
      fix: "Run: bun run build",
    };
  }
  try {
    const stat = statSync(distDir);
    if (!stat.isDirectory()) {
      return {
        name: "Plugin build",
        result: "fail",
        detail: "dist/ exists but is not a directory",
        fix: "Run: bun run build",
      };
    }
    const files = readdirSync(distDir);
    if (!files.includes("index.js")) {
      return {
        name: "Plugin build",
        result: "fail",
        detail: "dist/ exists but index.js missing",
        fix: "Run: bun run build",
      };
    }
  } catch {
    return {
      name: "Plugin build",
      result: "fail",
      detail: "dist/ exists but not readable",
      fix: "Run: bun run build",
    };
  }
  return { name: "Plugin build", result: "pass", detail: "dist/index.js present" };
}

function checkOpenCodePluginLoad(): Check {
  if (!findBinary("opencode")) {
    return {
      name: "OpenCode plugin load",
      result: "warn",
      detail: "opencode binary not available — cannot verify plugin loading",
      fix: "Install OpenCode to verify plugin loading",
    };
  }
  try {
    const out = execQuiet("opencode debug config 2>&1");
    if (out.includes("@hiai-gg/hiai-opencode") || out.includes("hiai-opencode") || out.includes("HiaiOpenCode")) {
      return {
        name: "OpenCode plugin load",
        result: "pass",
        detail: "@hiai-gg/hiai-opencode plugin detected in OpenCode config",
      };
    }
    return {
      name: "OpenCode plugin load",
      result: "warn",
      detail: "@hiai-gg/hiai-opencode plugin not detected in 'opencode debug config' output",
      fix: "Add '@hiai-gg/hiai-opencode' to the plugins array in your OpenCode config; OpenCode installs npm plugins automatically at startup",
    };
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : String(e);
    return {
      name: "OpenCode plugin load",
      result: "warn",
      detail: `could not verify plugin load: ${errMsg.slice(0, 100)}`,
      fix: "Ensure OpenCode config has '@hiai-gg/hiai-opencode' in plugins array",
    };
  }
}

function checkExpectedAgents(): Check {
  if (!findBinary("opencode")) {
    return {
      name: "Expected agent names",
      result: "warn",
      detail: "opencode not available — skipping agent name check",
    };
  }
  try {
    const out = execQuiet("opencode debug config 2>&1");
    const expected = ["Bob", "Coder", "Strategist", "Guard", "Critic", "Designer", "Researcher", "Manager", "Brainstormer", "Vision"];
    const missing: string[] = [];
    for (const agent of expected) {
      if (!out.includes(agent)) missing.push(agent);
    }
    if (missing.length === 0) {
      return {
        name: "Expected agent names",
        result: "pass",
        detail: `all 10 visible agents present: ${expected.join(", ")}`,
      };
    }
    return {
      name: "Expected agent names",
      result: "warn",
      detail: `missing from debug output: ${missing.join(", ")}`,
      fix: "Run 'opencode debug config' to diagnose",
    };
  } catch {
    return {
      name: "Expected agent names",
      result: "warn",
      detail: "could not verify agents — opencode debug config failed",
    };
  }
}

function checkHiddenAgents(): Check {
  if (!findBinary("opencode")) {
    return {
      name: "Hidden/system agents",
      result: "warn",
      detail: "opencode not available — skipping hidden agent check",
    };
  }
  try {
    const out = execQuiet("opencode debug config 2>&1");
    const shouldBeHidden = ["Sub", "Agent Skills"];
    const exposed: string[] = [];
    for (const agent of shouldBeHidden) {
      if (out.includes(`"${agent}"`)) exposed.push(agent);
    }
    if (exposed.length === 0) {
      return {
        name: "Hidden/system agents",
        result: "pass",
        detail: `${shouldBeHidden.join(", ")} not shown as primary agents`,
      };
    }
    return {
      name: "Hidden/system agents",
      result: "warn",
      detail: `potentially visible as primary: ${exposed.join(", ")}`,
      fix: "Check agent visibility in src/plugin-handlers/agent-config-handler.ts",
    };
  } catch {
    return {
      name: "Hidden/system agents",
      result: "warn",
      detail: "could not verify — opencode debug config failed",
    };
  }
}

function checkMCPNames(): Check {
  if (!findBinary("opencode")) {
    return {
      name: "Expected MCP names",
      result: "warn",
      detail: "opencode not available — skipping MCP name check",
    };
  }
  try {
    const out = execQuiet("opencode debug config 2>&1");
    const expectedMCP = ["playwright", "stitch", "sequential-thinking", "firecrawl", "rag", "mempalace", "context7"];
    const missing: string[] = [];
    for (const mcp of expectedMCP) {
      if (!out.includes(mcp)) missing.push(mcp);
    }
    if (missing.length === 0) {
      return {
        name: "Expected MCP names",
        result: "pass",
        detail: `all ${expectedMCP.length} MCPs registered: ${expectedMCP.join(", ")}`,
      };
    }
    return {
      name: "Expected MCP names",
      result: "warn",
      detail: `MCPs not detected in config: ${missing.join(", ")}`,
    };
  } catch {
    return {
      name: "Expected MCP names",
      result: "warn",
      detail: "could not verify MCP names",
    };
  }
}

function checkEnvVars(): Check[] {
  const checks: Check[] = [];
  const modelProviders = [
    "OPENROUTER_API_KEY",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "DEEPSEEK_API_KEY",
    "GLM_API_KEY",
    "MINIMAX_API_KEY",
    "QWEN_API_KEY",
  ];
  const optional: [string, string][] = [
    ["OPENROUTER_API_KEY", "OpenRouter API key (recommended - plugin defaults use OpenRouter)"],
    ["OPENAI_API_KEY", "OpenAI API key (optional — for direct OpenAI models)"],
    ["ANTHROPIC_API_KEY", "Anthropic API key (optional — for direct Anthropic models)"],
    ["DEEPSEEK_API_KEY", "DeepSeek API key (optional)"],
    ["GLM_API_KEY", "GLM API key (optional)"],
    ["MINIMAX_API_KEY", "MiniMax API key (optional)"],
    ["QWEN_API_KEY", "Qwen API key (optional)"],
    ["STITCH_AI_API_KEY", "Stitch AI API key (optional — for Stitch MCP)"],
    ["FIRECRAWL_API_KEY", "Firecrawl API key (optional — for Firecrawl MCP web scraping)"],
    ["CONTEXT7_API_KEY", "Context7 API key (optional — for Context7 MCP code search)"],
    ["OLLAMA_BASE_URL", "Ollama base URL (optional — for local models)"],
    ["OLLAMA_MODEL", "Ollama model ID (optional — e.g. qwen3.5:4b)"],
    ["MEMPALACE_PYTHON", "Python command for MemPalace MCP (optional — e.g. python3 or python)"],
  ];

  if (modelProviders.some((key) => Boolean(process.env[key]))) {
    checks.push({
      name: "ENV: model provider",
      result: "pass",
      detail: "at least one model provider key is set",
    });
  } else {
    checks.push({
      name: "ENV: model provider",
      result: "warn",
      detail: "no model provider keys detected",
      fix: "Set OPENROUTER_API_KEY for default presets, or configure another provider/model in hiai-opencode.json",
    });
  }

  for (const [key, desc] of optional) {
    if (process.env[key]) {
      checks.push({ name: `ENV: ${key}`, result: "pass", detail: `set` });
    } else {
      checks.push({
        name: `ENV: ${key}`,
        result: "warn",
        detail: `${desc} — not set (optional)`,
      });
    }
  }

  return checks;
}

function checkLSPTools(): Check[] {
  const checks: Check[] = [];
  const tools: [string, string][] = [
    ["typescript-language-server", "TypeScript LSP (optional)"],
    ["pyright-langserver", "Python LSP (optional)"],
    ["svelteserver", "Svelte LSP (optional)"],
    ["bash-language-server", "Bash LSP (optional)"],
    ["eslint-lsp", "ESLint LSP (optional)"],
  ];

  for (const [bin, desc] of tools) {
    const path = findBinary(bin);
    if (path) {
      checks.push({ name: `LSP: ${bin}`, result: "pass", detail: `found` });
    } else {
      checks.push({
        name: `LSP: ${bin}`,
        result: "warn",
        detail: `${desc} — not found`,
        fix: `Install ${bin} or configure path in hiai-opencode.json lsp section`,
      });
    }
  }

  return checks;
}

function printResult(c: Check) {
  const icon = c.result === "pass" ? green("✓") : c.result === "warn" ? yellow("⚠") : red("✗");
  console.log(`  ${icon} ${blue(c.name.padEnd(28))} ${c.detail}`);
  if (c.fix) {
    console.log(`    ${dim("→")} ${c.fix}`);
  }
}

function printTable(checks: Check[]) {
  for (const c of checks) {
    printResult(c);
  }
}

function main() {
  console.log();
  console.log(blue("═".repeat(60)));
  console.log(blue("  hiai-opencode doctor"));
  console.log(blue("═".repeat(60)));
  console.log();

  let pass = 0, warn = 0, fail = 0;

  console.log(dim("── Runtime ─────────────────────────────────────────────"));
  const node = checkNode();
  node.result === "pass" ? pass++ : node.result === "warn" ? warn++ : fail++;
  printResult(node);

  const bun = checkBun();
  bun.result === "pass" ? pass++ : bun.result === "warn" ? warn++ : fail++;
  printResult(bun);

  const opencode = checkOpenCodeBinary();
  opencode.result === "pass" ? pass++ : opencode.result === "warn" ? warn++ : fail++;
  printResult(opencode);

  console.log();
  console.log(dim("── Build ────────────────────────────────────────────────"));
  const build = checkBuild();
  build.result === "pass" ? pass++ : build.result === "warn" ? warn++ : fail++;
  printResult(build);

  console.log();
  console.log(dim("── Plugin Loading ────────────────────────────────────────"));
  const plugin = checkOpenCodePluginLoad();
  plugin.result === "pass" ? pass++ : plugin.result === "warn" ? warn++ : fail++;
  printResult(plugin);

  console.log();
  console.log(dim("── Agent Visibility ───────────────────────────────────────"));
  const agents = checkExpectedAgents();
  agents.result === "pass" ? pass++ : agents.result === "warn" ? warn++ : fail++;
  printResult(agents);

  const hidden = checkHiddenAgents();
  hidden.result === "pass" ? pass++ : hidden.result === "warn" ? warn++ : fail++;
  printResult(hidden);

  console.log();
  console.log(dim("── MCP Registration ───────────────────────────────────────"));
  const mcp = checkMCPNames();
  mcp.result === "pass" ? pass++ : mcp.result === "warn" ? warn++ : fail++;
  printResult(mcp);

  console.log();
  console.log(dim("── Environment Variables ──────────────────────────────────"));
  const envChecks = checkEnvVars();
  for (const c of envChecks) {
    c.result === "pass" ? pass++ : c.result === "warn" ? warn++ : fail++;
    printResult(c);
  }

  console.log();
  console.log(dim("── LSP Tools (optional) ───────────────────────────────────"));
  const lspChecks = checkLSPTools();
  for (const c of lspChecks) {
    c.result === "pass" ? pass++ : c.result === "warn" ? warn++ : fail++;
    printResult(c);
  }

  console.log();
  console.log(blue("─".repeat(60)));
  const total = pass + warn + fail;
  console.log(
    `  Results: ${green(`${pass} pass`)}  ${yellow(`${warn} warn`)}  ${red(`${fail} fail`)}  (total ${total})`
  );

  if (fail > 0) {
    console.log();
    console.log(red(`  Status: FAIL — ${fail} required check(s) must be fixed`));
    console.log();
    process.exit(1);
  }

  if (warn > 0) {
    console.log();
    console.log(yellow(`  Status: WARN — ${warn} optional check(s) missing (core OK)`));
    console.log();
    process.exit(0);
  }

  console.log();
  console.log(green(`  Status: PASS — all checks OK`));
  console.log();
  process.exit(0);
}

main();
