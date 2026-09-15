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

const REQUIRED_MODELS = {
  bob: { model: "test/bob" },
  build: { model: "test/build" },
  plan: { model: "test/plan" },
  manager: { model: "test/manager" },
  critic: { model: "test/critic" },
  designer: { model: "test/designer" },
  explore: { model: "test/explore" },
  writer: { model: "test/writer" },
  vision: { model: "test/vision" },
  general: { model: "test/general" },
};

const DISABLED_MCP = {
  "sequential-thinking": { enabled: false },
  grep_app: { enabled: false },
};

function setupDoctorWorkspace(plugin = "@hiai-gg/hiai-opencode@0.6.6"): {
  root: string;
  xdg: string;
  project: string;
  bin: string;
  appData: string;
} {
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
    join(xdg, "hiai-opencode", "bob.env"),
    "FIRECRAWL_API_KEY=test-firecrawl-key\nCONTEXT7_API_KEY=test-context7-key\n",
  );
  return { root, xdg, project, bin, appData };
}

function writeBobJson(
  project: string,
  config: Record<string, unknown> | string,
): void {
  const text = typeof config === "string" ? config : JSON.stringify(config);
  writeFileSync(join(project, "bob.json"), text);
}

function isolatedDoctorPath(bin: string): string {
  // Keep `which`/`where` resolvable so hasBinary can search the stub bin,
  // but drop the host user PATH (where Lightpanda/agent-browser live).
  if (process.platform === "win32") {
    const system32 = process.env.SystemRoot
      ? join(process.env.SystemRoot, "System32")
      : "C:\\Windows\\System32";
    return `${bin}${delimiter}${system32}`;
  }
  return `${bin}${delimiter}/usr/bin${delimiter}/bin`;
}

function runDoctor(opts: {
  root: string;
  xdg: string;
  project: string;
  bin: string;
  appData: string;
  isolatePath?: boolean;
}): { exitCode: number; output: string } {
  const path = opts.isolatePath
    ? isolatedDoctorPath(opts.bin)
    : `${opts.bin}${delimiter}${process.env.PATH ?? ""}`;
  const env: Record<string, string | undefined> = {
    ...process.env,
    HOME: opts.root,
    USERPROFILE: opts.root,
    APPDATA: opts.appData,
    XDG_CONFIG_HOME: opts.xdg,
    PATH: path,
  };
  if (opts.isolatePath) {
    delete env.AGENT_BROWSER_ENGINE;
  }
  const result = Bun.spawnSync({
    cmd: [process.execPath, join(import.meta.dir, "hiai-opencode.mjs"), "doctor"],
    cwd: opts.project,
    env,
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    exitCode: result.exitCode ?? 1,
    output: `${result.stdout.toString()}\n${result.stderr.toString()}`,
  };
}

describe("hiai-opencode doctor", (): void => {
  test.each([
    "@hiai-gg/hiai-opencode@latest",
    "@hiai-gg/hiai-opencode@0.6.4",
    "@hiai-gg/hiai-opencode@0.6.5",
    "@hiai-gg/hiai-opencode@0.6.6",
  ])("recognizes versioned plugin registration: %s", (plugin): void => {
    const workspace = setupDoctorWorkspace(plugin);
    writeBobJson(workspace.project, { mcp: DISABLED_MCP });

    const { output } = runDoctor(workspace);

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

  test("exits 1 when core orchestration models are missing", (): void => {
    const workspace = setupDoctorWorkspace();
    writeBobJson(workspace.project, { mcp: DISABLED_MCP });

    const { exitCode, output } = runDoctor(workspace);

    expect(exitCode).toBe(1);
    expect(output).toMatch(/Core models \(bob\/plan\/build\)/);
    expect(output).toMatch(/missing\/empty/);
  });

  test("exits 1 when bob.json is unparseable", (): void => {
    const workspace = setupDoctorWorkspace();
    writeBobJson(workspace.project, "{ not-json");

    const { exitCode, output } = runDoctor(workspace);

    expect(exitCode).toBe(1);
    expect(output).toMatch(/bob\.json/);
    expect(output).toMatch(/parse error/);
  });

  test("exits 1 when subagent_depth is invalid", (): void => {
    const workspace = setupDoctorWorkspace();
    writeBobJson(workspace.project, {
      models: REQUIRED_MODELS,
      mcp: DISABLED_MCP,
      subagent_depth: 0,
    });

    const { exitCode, output } = runDoctor(workspace);

    expect(exitCode).toBe(1);
    expect(output).toMatch(/invalid subagent_depth=0/);
  });

  test("exits 1 when a managed static .mcp.json is stale", (): void => {
    const workspace = setupDoctorWorkspace();
    writeBobJson(workspace.project, {
      models: REQUIRED_MODELS,
      mcp: DISABLED_MCP,
    });
    writeFileSync(
      join(workspace.project, ".opencode", ".mcp.json"),
      JSON.stringify({
        _meta: { generatedBy: "hiai-opencode", version: 1, generatedAt: "stale" },
        mcpServers: { leftover: { command: "false" } },
      }),
    );

    const { exitCode, output } = runDoctor(workspace);

    expect(exitCode).toBe(1);
    expect(output).toMatch(/static \.mcp\.json freshness/);
    expect(output).toMatch(/stale/);
  });

  test("exits 0 when models are complete; missing Lightpanda is info, not a hard fail", (): void => {
    const workspace = setupDoctorWorkspace();
    writeBobJson(workspace.project, {
      models: REQUIRED_MODELS,
      mcp: DISABLED_MCP,
    });

    const { exitCode, output } = runDoctor({
      ...workspace,
      isolatePath: true,
    });

    expect(exitCode).toBe(0);
    expect(output).toContain("✅ Core models (bob/plan/build)");
    expect(output).toMatch(/Lightpanda engine/);
    expect(output).toMatch(/not installed/);
    expect(output).not.toMatch(/❌ Lightpanda engine/);
    expect(output).not.toMatch(/binary found on PATH/);
  });

  test("exits 0 and reports Lightpanda present when the binary is on an isolated PATH", (): void => {
    const workspace = setupDoctorWorkspace();
    writeBobJson(workspace.project, {
      models: REQUIRED_MODELS,
      mcp: DISABLED_MCP,
    });
    writeStub(
      workspace.bin,
      "lightpanda",
      "#!/bin/sh\nexit 0\n",
      "@echo off\r\nexit /b 0\r\n",
    );

    const { exitCode, output } = runDoctor({
      ...workspace,
      isolatePath: true,
    });

    expect(exitCode).toBe(0);
    expect(output).toMatch(/✅ Lightpanda engine/);
    expect(output).toMatch(/binary found on PATH/);
    expect(output).not.toMatch(/not installed/);
  });
});
