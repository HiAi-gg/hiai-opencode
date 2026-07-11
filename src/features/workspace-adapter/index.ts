/**
 * WorkspaceAdapter — monorepo detection, workspace root resolution, and
 * project type detection for the HiAi OpenCode plugin.
 *
 * This is a FILESYSTEM-ONLY feature. It makes no network calls and adds no
 * external dependencies. It walks up directory trees looking for workspace
 * marker files, resolves workspace-relative paths, and classifies the project
 * type so agents can correctly route tasks to the right package directory.
 *
 * Results are cached per directory (Map<string, ProjectInfo>) unless caching
 * is disabled via the constructor / `configure()`.
 */

import * as fs from "node:fs";
import * as path from "node:path";

const { existsSync, statSync, readdirSync, readFileSync } = fs;

/** Project classification returned by {@link WorkspaceAdapter.detectProjectType}. */
export type ProjectType =
  | "bun"
  | "node"
  | "python"
  | "svelte"
  | "nextjs"
  | "unknown";

/** Package manager detected for a directory. */
export type PackageManager = "bun" | "npm" | "pnpm" | "yarn";

/** Resolved information about a directory. */
export interface ProjectInfo {
  /** Absolute, canonical directory this info describes. */
  dir: string;
  /** Classified project type. */
  type: ProjectType;
  /** Nearest ancestor directory containing a package.json (if any). */
  packageRoot?: string;
  /** Detected workspace root (if any). */
  workspaceRoot?: string;
  /** Whether the workspace root contains multiple packages. */
  isMonorepo: boolean;
  /** Whether a package.json exists in this directory. */
  hasPackageJson: boolean;
  /** Whether a bun lockfile exists in this directory. */
  hasBunLock: boolean;
  /** Whether a node_modules directory exists in this directory. */
  hasNodeModules: boolean;
  /** Detected package manager (if any). */
  packageManager?: PackageManager;
}

/** Options for {@link WorkspaceAdapter}. */
export interface WorkspaceAdapterOptions {
  /** Cache ProjectInfo per directory. Defaults to true. */
  cacheResults?: boolean;
}

/** Marker files (besides package.json workspaces) that signal a workspace root. */
const WORKSPACE_MARKER_FILES = [
  "pnpm-workspace.yaml",
  "lerna.json",
  "nx.json",
  "turbo.json",
];

/** Common monorepo package container directories scanned as a fallback. */
const COMMON_PACKAGE_DIRS = [
  "packages",
  "apps",
  "libs",
  "services",
  "modules",
  "projects",
];

/** Safe JSON parse — returns undefined on any error. */
function readJson(file: string): Record<string, unknown> | undefined {
  try {
    const text = readFileSync(file, "utf8");
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/** Whether a directory contains a workspace marker. */
function hasWorkspaceMarker(dir: string): boolean {
  const pkg = readJson(path.join(dir, "package.json"));
  if (pkg && pkg.workspaces !== undefined && pkg.workspaces !== null) {
    return true;
  }
  for (const marker of WORKSPACE_MARKER_FILES) {
    if (existsSync(path.join(dir, marker))) return true;
  }
  return false;
}

/** Extract `packages:` list from a pnpm-workspace.yaml (minimal YAML parse). */
function readPnpmWorkspacePackages(file: string): string[] {
  if (!existsSync(file)) return [];
  try {
    const lines = readFileSync(file, "utf8").split("\n");
    const pkgs: string[] = [];
    let inPackages = false;
    for (const raw of lines) {
      const line = raw.trim();
      if (/^packages\s*:/.test(line)) {
        inPackages = true;
        continue;
      }
      if (!inPackages) continue;
      if (/^-\s+/.test(line)) {
        // Strip inline comments and surrounding quotes.
        const value = line
          .replace(/^-\s+/, "")
          .replace(/#.*$/, "")
          .replace(/^["']|["']$/g, "")
          .trim();
        if (value.length > 0) pkgs.push(value);
      } else if (line.length === 0 || /^[A-Za-z]/.test(line)) {
        // Blank line or a new top-level key ends the list block.
        if (/^[A-Za-z]/.test(line)) inPackages = false;
      }
    }
    return pkgs;
  } catch {
    return [];
  }
}

/** Collect workspace glob patterns from package.json / pnpm / lerna. */
function collectWorkspaceGlobs(root: string): string[] {
  const globs: string[] = [];
  const pkg = readJson(path.join(root, "package.json"));
  if (pkg?.workspaces) {
    const ws = pkg.workspaces;
    if (Array.isArray(ws)) {
      globs.push(...(ws as unknown[]).map(String));
    } else if (
      typeof ws === "object" &&
      Array.isArray((ws as Record<string, unknown>).packages)
    ) {
      globs.push(
        ...((ws as Record<string, unknown>).packages as unknown[]).map(String),
      );
    }
  }
  globs.push(
    ...readPnpmWorkspacePackages(path.join(root, "pnpm-workspace.yaml")),
  );
  const lerna = readJson(path.join(root, "lerna.json"));
  if (lerna && Array.isArray(lerna.packages)) {
    globs.push(...(lerna.packages as unknown[]).map(String));
  }
  return globs.filter((g) => typeof g === "string" && g.length > 0);
}

/** Resolve workspace globs to a set of directories that contain package.json. */
function resolveWorkspaceGlobs(root: string, globs: string[]): Set<string> {
  const dirs = new Set<string>();
  for (const pattern of globs) {
    try {
      const glob = new Bun.Glob(pattern);
      for (const entry of glob.scanSync({
        cwd: root,
        onlyFiles: false,
        absolute: false,
      })) {
        const full = path.join(root, entry);
        try {
          if (
            statSync(full).isDirectory() &&
            existsSync(path.join(full, "package.json"))
          ) {
            dirs.add(path.resolve(full));
          }
        } catch {
          // ignore unreadable entries
        }
      }
    } catch {
      // ignore invalid glob patterns
    }
  }
  return dirs;
}

/**
 * Detects workspace roots, resolves workspace-relative paths, and classifies
 * project types. Filesystem-only; no network, no external dependencies.
 */
export class WorkspaceAdapter {
  private cacheResults: boolean;
  private readonly cache = new Map<string, ProjectInfo>();
  private readonly workspaceRootCache = new Map<string, string | undefined>();
  private _workspaceRoot: string | null = null;
  private _workspaceRootResolved = false;

  constructor(opts?: WorkspaceAdapterOptions) {
    this.cacheResults = opts?.cacheResults ?? true;
  }

  /** Reconfigure the adapter (e.g. from BobConfig.workspace.cache_results). */
  configure(opts: WorkspaceAdapterOptions): void {
    if (opts.cacheResults !== undefined) this.cacheResults = opts.cacheResults;
    if (!this.cacheResults) this.clearCache();
  }

  /** Clear all cached results. */
  clearCache(): void {
    this.cache.clear();
    this.workspaceRootCache.clear();
    this._workspaceRoot = null;
    this._workspaceRootResolved = false;
  }

  /**
   * Walk up from `dir` (or the current working directory) looking for a
   * workspace marker file. Returns the workspace root path or undefined.
   */
  detectWorkspaceRoot(dir?: string): string | undefined {
    const start = path.resolve(dir ?? process.cwd());
    if (this.workspaceRootCache.has(start)) {
      return this.workspaceRootCache.get(start);
    }
    let current = start;
    let found: string | undefined;
    while (true) {
      if (hasWorkspaceMarker(current)) {
        found = current;
        break;
      }
      const parent = path.dirname(current);
      if (parent === current) break; // reached filesystem root
      current = parent;
    }
    this.workspaceRootCache.set(start, found);
    return found;
  }

  /**
   * Return the detected workspace root (from the current working directory).
   * Caches the result; call {@link clearCache} to force re-detection.
   */
  getWorkspaceRoot(): string | undefined {
    if (!this._workspaceRootResolved) {
      this._workspaceRoot = this.detectWorkspaceRoot() ?? null;
      this._workspaceRootResolved = true;
    }
    return this._workspaceRoot ?? undefined;
  }

  /**
   * Whether the detected workspace root contains multiple packages.
   * Returns false when no workspace root is detected.
   */
  isMonorepo(): boolean {
    const root = this.getWorkspaceRoot();
    if (!root) return false;
    return this.countPackages(root) >= 2;
  }

  /**
   * Resolve a file (or directory) path to the nearest ancestor directory that
   * contains a package.json. Returns undefined when none is found.
   */
  getPackageRoot(filePath: string): string | undefined {
    const resolved = path.resolve(filePath);
    let current: string;
    try {
      current = statSync(resolved).isDirectory()
        ? resolved
        : path.dirname(resolved);
    } catch {
      // Path may not exist yet — treat it as a file path.
      current = path.dirname(resolved);
    }
    while (true) {
      if (existsSync(path.join(current, "package.json"))) return current;
      const parent = path.dirname(current);
      if (parent === current) return undefined;
      current = parent;
    }
  }

  /**
   * Classify the project type of `dir`. Results are cached per directory.
   */
  detectProjectType(dir: string): ProjectType {
    return this.getProjectInfo(dir).type;
  }

  /**
   * Return full {@link ProjectInfo} for `dir`, including project type, package
   * root, workspace root, and monorepo status. Cached per directory.
   */
  getProjectInfo(dir: string): ProjectInfo {
    const key = path.resolve(dir);
    if (this.cacheResults && this.cache.has(key)) {
      return this.cache.get(key) as ProjectInfo;
    }
    const info = this.computeProjectInfo(key);
    if (this.cacheResults) this.cache.set(key, info);
    return info;
  }

  // --- internals ---------------------------------------------------------

  private computeProjectInfo(dir: string): ProjectInfo {
    const abs = path.resolve(dir);
    const pkgPath = path.join(abs, "package.json");
    const hasPackageJson = existsSync(pkgPath);
    const pkg = hasPackageJson ? readJson(pkgPath) : undefined;
    const type = this.classifyProjectType(abs, pkg);
    const packageRoot =
      this.getPackageRoot(abs) ?? (hasPackageJson ? abs : undefined);
    const workspaceRoot = this.detectWorkspaceRoot(abs);
    const isMonorepo = workspaceRoot
      ? this.countPackages(workspaceRoot) >= 2
      : false;

    return {
      dir: abs,
      type,
      packageRoot,
      workspaceRoot,
      isMonorepo,
      hasPackageJson,
      hasBunLock:
        existsSync(path.join(abs, "bun.lockb")) ||
        existsSync(path.join(abs, "bun.lock")),
      hasNodeModules: existsSync(path.join(abs, "node_modules")),
      packageManager: this.detectPackageManager(abs, pkg),
    };
  }

  private classifyProjectType(
    dir: string,
    pkg: Record<string, unknown> | undefined,
  ): ProjectType {
    // Python projects take precedence when present.
    if (
      existsSync(path.join(dir, "pyproject.toml")) ||
      existsSync(path.join(dir, "requirements.txt"))
    ) {
      return "python";
    }

    if (pkg) {
      const deps = {
        ...((pkg.dependencies as Record<string, unknown>) ?? {}),
        ...((pkg.devDependencies as Record<string, unknown>) ?? {}),
      };
      const has = (name: string): boolean => name in deps;

      if (
        has("next") ||
        existsSync(path.join(dir, "next.config.js")) ||
        existsSync(path.join(dir, "next.config.mjs")) ||
        existsSync(path.join(dir, "next.config.ts"))
      ) {
        return "nextjs";
      }
      if (
        has("svelte") ||
        existsSync(path.join(dir, "svelte.config.js")) ||
        existsSync(path.join(dir, "svelte.config.ts"))
      ) {
        return "svelte";
      }
      if (
        has("bun") ||
        existsSync(path.join(dir, "bun.lockb")) ||
        existsSync(path.join(dir, "bun.lock"))
      ) {
        return "bun";
      }
      if (
        existsSync(path.join(dir, "vite.config.js")) ||
        existsSync(path.join(dir, "vite.config.ts")) ||
        existsSync(path.join(dir, "vite.config.mjs"))
      ) {
        return "node";
      }
      return "node";
    }

    // No package.json — check for framework config files alone.
    if (
      existsSync(path.join(dir, "vite.config.js")) ||
      existsSync(path.join(dir, "vite.config.ts")) ||
      existsSync(path.join(dir, "vite.config.mjs"))
    ) {
      return "node";
    }

    return "unknown";
  }

  private detectPackageManager(
    dir: string,
    pkg: Record<string, unknown> | undefined,
  ): PackageManager | undefined {
    if (
      existsSync(path.join(dir, "bun.lockb")) ||
      existsSync(path.join(dir, "bun.lock"))
    ) {
      return "bun";
    }
    if (existsSync(path.join(dir, "pnpm-lock.yaml"))) return "pnpm";
    if (existsSync(path.join(dir, "yarn.lock"))) return "yarn";
    if (existsSync(path.join(dir, "package-lock.json"))) return "npm";
    if (typeof pkg?.packageManager === "string") {
      const pm = pkg.packageManager;
      if (pm.startsWith("bun")) return "bun";
      if (pm.startsWith("pnpm")) return "pnpm";
      if (pm.startsWith("yarn")) return "yarn";
      if (pm.startsWith("npm")) return "npm";
    }
    return undefined;
  }

  /** Count the number of packages under a workspace root. */
  private countPackages(root: string): number {
    const dirs = new Set<string>();

    const globs = collectWorkspaceGlobs(root);
    if (globs.length > 0) {
      for (const d of resolveWorkspaceGlobs(root, globs)) dirs.add(d);
    }

    // Fallback: scan common monorepo container directories for package.json.
    for (const sub of COMMON_PACKAGE_DIRS) {
      const full = path.join(root, sub);
      if (!existsSync(full)) continue;
      try {
        if (!statSync(full).isDirectory()) continue;
        for (const child of readdirSync(full)) {
          const childFull = path.join(full, child);
          try {
            if (
              statSync(childFull).isDirectory() &&
              existsSync(path.join(childFull, "package.json"))
            ) {
              dirs.add(path.resolve(childFull));
            }
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore unreadable container
      }
    }

    return dirs.size;
  }
}

// --- module-level singleton + accessor (mirrors background-manager pattern) ---

let activeAdapter: WorkspaceAdapter = new WorkspaceAdapter();

/** Replace the active workspace adapter instance (called from src/index.ts). */
export function setWorkspaceAdapter(adapter: WorkspaceAdapter): void {
  activeAdapter = adapter;
}

/** Get the active workspace adapter instance. */
export function getWorkspaceAdapter(): WorkspaceAdapter {
  return activeAdapter;
}

/** Default singleton instance, exported for convenience. */
export const workspaceAdapter = new WorkspaceAdapter();
