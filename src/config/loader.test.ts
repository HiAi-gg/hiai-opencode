import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "./loader.js";

function withTempProject(
  config: unknown,
  run: (projectDir: string) => void,
): void {
  const originalHome = process.env.HOME;
  const projectDir = mkdtempSync(join(tmpdir(), "hiai-opencode-project-"));
  const fakeHomeDir = mkdtempSync(join(tmpdir(), "hiai-opencode-home-"));

  try {
    process.env.HOME = fakeHomeDir;
    writeFileSync(
      join(projectDir, "hiai-opencode.json"),
      JSON.stringify(config),
      "utf-8",
    );
    run(projectDir);
  } finally {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(fakeHomeDir, { recursive: true, force: true });
  }
}

const requiredModels = {
  bob: { model: "openrouter/test/bob", recommended: "xhigh" },
  coder: { model: "openrouter/test/coder", recommended: "high" },
  strategist: { model: "openrouter/test/strategist", recommended: "high" },
  guard: "openrouter/test/guard",
  critic: "openrouter/test/critic",
  designer: "openrouter/test/designer",
  researcher: "openrouter/test/researcher",
  manager: "openrouter/test/manager",
  brainstormer: "openrouter/test/brainstormer",
  vision: "openrouter/test/vision",
};

test("loadConfig accepts compact enabled-only LSP entries for builtin servers", () => {
  withTempProject(
    {
      models: requiredModels,
      lsp: {
        typescript: {
          enabled: true,
        },
      },
    },
    (projectDir) => {
      const loaded = loadConfig(projectDir);
      const tsServer = loaded.lsp?.typescript;

      expect(tsServer).toBeDefined();
      expect(tsServer?.command?.length).toBeGreaterThan(0);
      expect(tsServer?.extensions).toContain(".ts");
    },
  );
});

test("loadConfig ignores unknown compact enabled-only LSP entries", () => {
  withTempProject(
    {
      models: requiredModels,
      lsp: {
        "custom-server": {
          enabled: true,
        },
      },
    },
    (projectDir) => {
      const loaded = loadConfig(projectDir);
      expect(loaded.lsp?.["custom-server"]).toBeUndefined();
    },
  );
});
