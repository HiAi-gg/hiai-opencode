import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const runnerPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "assets",
  "runtime",
  "npm-package-runner.mjs",
);

// A fake "MCP server" package that emits a mix of valid JSON-RPC lines and
// noisy stdout (download banners, warnings). Used to prove the runner only
// forwards protocol-valid lines to its own stdout. We install it as a local
// npm package directory so `npx -y <path>` can run it fully offline.
const FAKE_SERVER_BIN = `#!/usr/bin/env node
process.stdout.write("npm WARN deprecated something\\n");
process.stdout.write("fetching package metadata...\\n");
process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: 1, result: { ok: true } }) + "\\n");
process.stdout.write("some non-json noise line\\n");
process.stdout.write(JSON.stringify({ jsonrpc: "2.0", method: "notification/initialized" }) + "\\n");
process.stderr.write("child diagnostic to stderr\\n");
// Stay alive long enough for the runner to be killed mid-session.
setTimeout(() => process.exit(0), 1000);
`;

const FAKE_SERVER_PKG = JSON.stringify({
  name: "fake-mcp",
  version: "1.0.0",
  bin: { "fake-mcp": "fake-mcp.mjs" },
});

describe("npm-package-runner (Phase 6.1)", () => {
  let fixtureDir: string;
  let fakePkgDir: string;

  beforeAll(() => {
    fixtureDir = mkdtempSync(join(tmpdir(), "npm-runner-smoke-"));
    fakePkgDir = join(fixtureDir, "fake-mcp");
    mkdirSync(fakePkgDir, { recursive: true });
    writeFileSync(join(fakePkgDir, "package.json"), FAKE_SERVER_PKG, "utf8");
    writeFileSync(join(fakePkgDir, "fake-mcp.mjs"), FAKE_SERVER_BIN, "utf8");
  });

  afterAll(() => {
    rmSync(fixtureDir, { recursive: true, force: true });
  });

  it("forwards only valid JSON-RPC to stdout and filters noise to stderr", async () => {
    const child = spawn("node", [runnerPath, fakePkgDir], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));

    const code = await new Promise<number>((resolve) => {
      child.on("exit", (c) => resolve(c ?? 0));
    });

    expect(code).toBe(0);

    const stdoutLines = stdout.split("\n").filter((l) => l.trim().length > 0);
    // Exactly the two JSON-RPC messages should reach stdout.
    expect(stdoutLines).toHaveLength(2);
    for (const line of stdoutLines) {
      const parsed = JSON.parse(line);
      expect(parsed.jsonrpc).toBe("2.0");
    }

    // Noise must NOT appear on stdout.
    expect(stdout).not.toContain("npm WARN");
    expect(stdout).not.toContain("fetching package metadata");
    expect(stdout).not.toContain("non-json noise");

    // Noise + child stderr must be on stderr instead.
    expect(stderr).toContain("npm WARN deprecated something");
    expect(stderr).toContain("fetching package metadata");
    expect(stderr).toContain("non-json noise line");
    expect(stderr).toContain("child diagnostic to stderr");
  });

  it("exits non-zero with a distinct code when the child is killed by a signal", async () => {
    const child = spawn("node", [runnerPath, fakePkgDir], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    // Give the runner time to spawn the grandchild, then kill the runner.
    child.once("spawn", () => setTimeout(() => child.kill("SIGTERM"), 500));

    const code = await new Promise<number>((resolve) => {
      child.on("exit", (c) => resolve(c ?? 0));
    });

    // EXIT_CHILD_SIGNALED = 2 (distinct from 0/1).
    expect(code).toBe(2);
  });

  it("exits with code 1 and a clear message when no package name is given", async () => {
    const child = spawn("node", [runnerPath], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (d) => (stderr += d));

    const code = await new Promise<number>((resolve) => {
      child.on("exit", (c) => resolve(c ?? 0));
    });

    expect(code).toBe(1);
    expect(stderr).toContain("requires a package name");
  });
});
