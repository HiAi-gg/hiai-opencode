import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { delimiter, join } from "node:path";
import { tmpdir } from "node:os";

const tempRoots: string[] = [];
const isWindows = process.platform === "win32";

afterEach((): void => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function writeStub(bin: string, name: string, unixBody: string, cmdBody: string): void {
  if (isWindows) {
    writeFileSync(join(bin, `${name}.cmd`), cmdBody);
    return;
  }
  const path = join(bin, name);
  writeFileSync(path, unixBody);
  chmodSync(path, 0o755);
}

describe("hiai-opencode doctor", (): void => {
  test.each([
    "@hiai-gg/hiai-opencode@latest",
    "@hiai-gg/hiai-opencode@0.6.4",
    "@hiai-gg/hiai-opencode@0.6.5",
    "@hiai-gg/hiai-opencode@0.6.6",
  ])("recognizes versioned plugin registration: %s", (plugin): void => {
    const root = join(tmpdir(), `hiai-opencode-doctor-${crypto.randomUUID()}`);
    const xdg = join(root, "xdg");
    const project = join(root, "project");
    const bin = join(root, "bin");
    const appData = join(root, "AppData", "Roaming");
    tempRoots.push(root);
    mkdirSync(join(xdg, "hiai-opencode"), { recursive: true });
    mkdirSync(join(project, ".opencode"), { recursive: true });
    mkdirSync(bin, { recursive: true });
    mkdirSync(appData, { recursive: true });

    writeStub(
      bin,
      "c7",
      "#!/bin/sh\nexit 0\n",
      "@echo off\r\nexit /b 0\r\n",
    );
    writeStub(
      bin,
      "opencode",
      "#!/bin/sh\n[ \"$1\" = \"--version\" ] && exit 0\n[ \"$1 $2\" = \"providers list\" ] || exit 1\nprintf 'Credentials: test-provider\\n'\n",
      "@echo off\r\nif \"%~1\"==\"--version\" exit /b 0\r\nif \"%~1\"==\"providers\" if \"%~2\"==\"list\" (\r\n  echo Credentials: test-provider\r\n  exit /b 0\r\n)\r\nexit /b 1\r\n",
    );
    writeFileSync(
      join(project, ".opencode", "opencode.json"),
      JSON.stringify({ plugin: [plugin] }),
    );
    writeFileSync(
      join(xdg, "hiai-opencode", "bob.json"),
      JSON.stringify({ mcp: { "sequential-thinking": { enabled: false }, grep_app: { enabled: false } } }),
    );
    writeFileSync(
      join(xdg, "hiai-opencode", "bob.env"),
      "FIRECRAWL_API_KEY=test-firecrawl-key\nCONTEXT7_API_KEY=test-context7-key\n",
    );

    const result = Bun.spawnSync({
      cmd: [process.execPath, join(import.meta.dir, "hiai-opencode.mjs"), "doctor"],
      cwd: project,
      env: {
        ...process.env,
        HOME: root,
        USERPROFILE: root,
        APPDATA: appData,
        XDG_CONFIG_HOME: xdg,
        PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`,
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    const output = `${result.stdout.toString()}\n${result.stderr.toString()}`;

    expect(output).toContain("OpenCode plugin registration");
    expect(output).not.toContain("is not registered");
    expect(output).not.toContain("FIRECRAWL_API_KEY not set");
    expect(output).not.toContain("test-firecrawl-key");
    expect(output).not.toContain("test-context7-key");
    expect(output).toContain("Context7 CLI - c7 available");
    expect(output).not.toContain("skill registry missing");
    expect(output).toContain("OpenCode Providers visible");
    expect(output).toContain("✅ OpenCode plugin registration");
  });
});
