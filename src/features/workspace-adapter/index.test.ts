/**
 * index.test.ts — Unit tests for WorkspaceAdapter.
 *
 * Exercises workspace-root detection, monorepo detection, package-root
 * resolution, and project-type detection against real temporary directories.
 * No mocks and no network calls; all assertions run against actual files.
 */

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { type ProjectType, WorkspaceAdapter } from "./index";

let tmp: string;
let originalCwd: string;

beforeAll(() => {
  originalCwd = process.cwd();
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ws-adapter-")));
});

afterAll(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** Create a directory and write files into it. */
function makeDir(rel: string, files: Record<string, string>): string {
  const dir = path.join(tmp, rel);
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content);
  }
  return dir;
}

describe("WorkspaceAdapter.detectWorkspaceRoot()", () => {
  test("finds root via package.json workspaces field", () => {
    const root = makeDir("npm-ws", {
      "package.json": JSON.stringify({ workspaces: ["packages/*"] }),
    });
    const child = makeDir("npm-ws/packages/a", {
      "package.json": JSON.stringify({ name: "a" }),
    });
    const adapter = new WorkspaceAdapter();
    expect(adapter.detectWorkspaceRoot(child)).toBe(path.resolve(root));
  });

  test("finds root via pnpm-workspace.yaml", () => {
    const root = makeDir("pnpm-ws", {
      "pnpm-workspace.yaml": "packages:\n  - 'apps/*'\n",
    });
    const child = makeDir("pnpm-ws/apps/web", {
      "package.json": JSON.stringify({ name: "web" }),
    });
    const adapter = new WorkspaceAdapter();
    expect(adapter.detectWorkspaceRoot(child)).toBe(path.resolve(root));
  });

  test("finds root via lerna.json / nx.json / turbo.json markers", () => {
    for (const marker of ["lerna.json", "nx.json", "turbo.json"]) {
      const root = makeDir(`marker-${marker}`, { [marker]: "{}" });
      const child = makeDir(`marker-${marker}/src`, {});
      const adapter = new WorkspaceAdapter();
      expect(adapter.detectWorkspaceRoot(child)).toBe(path.resolve(root));
    }
  });

  test("returns undefined when no marker exists walking up to fs root", () => {
    const isolated = makeDir("no-ws/leaf", { "readme.txt": "x" });
    const adapter = new WorkspaceAdapter();
    expect(adapter.detectWorkspaceRoot(isolated)).toBeUndefined();
  });

  test("honors an explicit start directory argument", () => {
    const root = makeDir("explicit-ws", {
      "package.json": JSON.stringify({ workspaces: ["pkgs/*"] }),
    });
    const adapter = new WorkspaceAdapter();
    expect(adapter.detectWorkspaceRoot(path.join(root, "pkgs", "x"))).toBe(
      path.resolve(root),
    );
  });
});

describe("WorkspaceAdapter.isMonorepo() / getWorkspaceRoot()", () => {
  test("detects a monorepo with multiple packages", () => {
    const root = makeDir("mono", {
      "package.json": JSON.stringify({ workspaces: ["packages/*"] }),
    });
    makeDir("mono/packages/a", {
      "package.json": JSON.stringify({ name: "a" }),
    });
    makeDir("mono/packages/b", {
      "package.json": JSON.stringify({ name: "b" }),
    });
    process.chdir(root);
    const adapter = new WorkspaceAdapter();
    expect(adapter.getWorkspaceRoot()).toBe(path.resolve(root));
    expect(adapter.isMonorepo()).toBe(true);
  });

  test("single-package workspace is not a monorepo", () => {
    const root = makeDir("single", {
      "package.json": JSON.stringify({ workspaces: ["packages/*"] }),
    });
    makeDir("single/packages/a", {
      "package.json": JSON.stringify({ name: "a" }),
    });
    process.chdir(root);
    const adapter = new WorkspaceAdapter();
    expect(adapter.isMonorepo()).toBe(false);
  });

  test("returns false when no workspace root is detected", () => {
    const root = makeDir("lonely", { "readme.txt": "x" });
    process.chdir(root);
    const adapter = new WorkspaceAdapter();
    expect(adapter.getWorkspaceRoot()).toBeUndefined();
    expect(adapter.isMonorepo()).toBe(false);
  });
});

describe("WorkspaceAdapter.getPackageRoot()", () => {
  test("resolves a file path to its nearest package root", () => {
    const pkgDir = makeDir("pkgroot/apps/web", {
      "package.json": JSON.stringify({ name: "web" }),
    });
    const file = path.join(pkgDir, "src", "index.ts");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "// x");
    const adapter = new WorkspaceAdapter();
    expect(adapter.getPackageRoot(file)).toBe(path.resolve(pkgDir));
  });

  test("returns undefined when no package.json exists above", () => {
    const dir = makeDir("nopkg/deep", { "x.txt": "y" });
    const adapter = new WorkspaceAdapter();
    expect(adapter.getPackageRoot(dir)).toBeUndefined();
  });
});

describe("WorkspaceAdapter.detectProjectType()", () => {
  const cases: Array<[string, Record<string, string>, ProjectType]> = [
    ["python", { "pyproject.toml": "[project]\nname='p'" }, "python"],
    ["python-req", { "requirements.txt": "requests==2.0\n" }, "python"],
    [
      "nextjs",
      {
        "package.json": JSON.stringify({ dependencies: { next: "^14" } }),
        "next.config.js": "module.exports={};",
      },
      "nextjs",
    ],
    [
      "svelte",
      {
        "package.json": JSON.stringify({ devDependencies: { svelte: "^5" } }),
        "svelte.config.js": "export default {};",
      },
      "svelte",
    ],
    [
      "bun",
      {
        "package.json": JSON.stringify({ devDependencies: { bun: "^1" } }),
        "bun.lockb": "",
      },
      "bun",
    ],
    [
      "node",
      { "package.json": JSON.stringify({ dependencies: { lodash: "^4" } }) },
      "node",
    ],
    [
      "node-vite",
      {
        "package.json": JSON.stringify({ dependencies: {} }),
        "vite.config.ts": "export default {};",
      },
      "node",
    ],
  ];

  for (const [name, files, expected] of cases) {
    test(`classifies '${name}' as '${expected}'`, () => {
      const dir = makeDir(`type-${name}`, files);
      const adapter = new WorkspaceAdapter();
      expect(adapter.detectProjectType(dir)).toBe(expected);
    });
  }

  test("returns 'unknown' for an empty directory", () => {
    const dir = makeDir("type-unknown", { "readme.txt": "x" });
    const adapter = new WorkspaceAdapter();
    expect(adapter.detectProjectType(dir)).toBe("unknown");
  });
});

describe("WorkspaceAdapter caching", () => {
  test("caches ProjectInfo per directory and clearCache resets it", () => {
    const dir = makeDir("cached", {
      "package.json": JSON.stringify({ name: "cached" }),
    });
    const adapter = new WorkspaceAdapter({ cacheResults: true });
    const first = adapter.getProjectInfo(dir);
    const second = adapter.getProjectInfo(dir);
    expect(first).toBe(second); // same cached reference

    adapter.clearCache();
    const third = adapter.getProjectInfo(dir);
    expect(third).not.toBe(first);
    expect(third.dir).toBe(first.dir);
  });

  test("does not cache when cacheResults is false", () => {
    const dir = makeDir("nocache", {
      "package.json": JSON.stringify({ name: "nocache" }),
    });
    const adapter = new WorkspaceAdapter({ cacheResults: false });
    const first = adapter.getProjectInfo(dir);
    const second = adapter.getProjectInfo(dir);
    expect(first).not.toBe(second);
  });
});

describe("WorkspaceAdapter.getProjectInfo()", () => {
  test("populates workspace root, package root, and package manager", () => {
    const root = makeDir("info", {
      "package.json": JSON.stringify({
        workspaces: ["packages/*"],
        packageManager: "pnpm@9.0.0",
      }),
      "pnpm-lock.yaml": "",
    });
    makeDir("info/packages/a", {
      "package.json": JSON.stringify({ name: "a" }),
    });
    const adapter = new WorkspaceAdapter();
    const info = adapter.getProjectInfo(root);
    expect(info.workspaceRoot).toBe(path.resolve(root));
    expect(info.packageRoot).toBe(path.resolve(root));
    expect(info.packageManager).toBe("pnpm");
    expect(info.hasPackageJson).toBe(true);
    expect(info.isMonorepo).toBe(false);
  });
});
