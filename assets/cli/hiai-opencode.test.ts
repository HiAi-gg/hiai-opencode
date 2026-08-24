import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const tempRoots: string[] = [];

afterEach((): void => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("hiai-opencode doctor", (): void => {
  test.each([
    "@hiai-gg/hiai-opencode@latest",
    "@hiai-gg/hiai-opencode@0.6.4",
    "@hiai-gg/hiai-opencode@0.6.5",
  ])("recognizes versioned plugin registration: %s", (plugin): void => {
    const root = join(tmpdir(), `hiai-opencode-doctor-${crypto.randomUUID()}`);
    const xdg = join(root, "xdg");
    const opencodeConfig = join(root, ".config", "opencode");
    const project = join(root, "project");
    const bin = join(root, "bin");
    tempRoots.push(root);
    mkdirSync(opencodeConfig, { recursive: true });
    mkdirSync(join(xdg, "hiai-opencode"), { recursive: true });
    mkdirSync(project, { recursive: true });
    mkdirSync(bin, { recursive: true });
    writeFileSync(join(bin, "c7"), "#!/bin/sh\nexit 0\n");
    chmodSync(join(bin, "c7"), 0o755);
    writeFileSync(
      join(bin, "opencode"),
      "#!/bin/sh\n[ \"$1\" = \"--version\" ] && exit 0\n[ \"$1 $2\" = \"providers list\" ] || exit 1\nprintf 'Credentials: test-provider\\n'\n",
    );
    chmodSync(join(bin, "opencode"), 0o755);
    writeFileSync(
      join(opencodeConfig, "opencode.json"),
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
        XDG_CONFIG_HOME: xdg,
        PATH: `${bin}:/usr/bin:/bin`,
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
