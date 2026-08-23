import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { PlanLifecycleStatus } from "./index";

export interface TodoSnapshot {
  id: string;
  content: string;
  status: string;
}

export interface DiskSessionLifecycle {
  planId: string;
  planPath: string;
  status: PlanLifecycleStatus;
  checksum: string | null;
  frozenAt: number | null;
  implementingWorkerCompleted?: boolean;
  todos: TodoSnapshot[];
}

export interface DiskLifecycleFile {
  sessions: Record<string, DiskSessionLifecycle>;
}

const LIFECYCLE_NAME = ".lifecycle.json";

let plansRoot: string | null = null;

export function setPlansRoot(dir: string | null): void {
  plansRoot = dir;
}

export function getPlansRoot(): string | null {
  return plansRoot;
}

export function planIdFromPath(planPath: string): string {
  const base = basename(planPath).replace(/\.md$/i, "");
  return base || "plan";
}

function lifecyclePath(): string | null {
  if (!plansRoot) return null;
  return join(plansRoot, ".bob", "plans", LIFECYCLE_NAME);
}

export function readDiskFile(): DiskLifecycleFile {
  const fp = lifecyclePath();
  if (!fp || !existsSync(fp)) return { sessions: {} };
  try {
    const raw = JSON.parse(readFileSync(fp, "utf-8")) as DiskLifecycleFile & {
      planPath?: string;
      status?: PlanLifecycleStatus;
    };
    if (raw?.sessions && typeof raw.sessions === "object") return raw;
    // Migrate legacy single-record files (pre-0.6.2 session map).
    if (typeof raw?.planPath === "string" && raw.status) {
      return { sessions: {} };
    }
    return { sessions: {} };
  } catch {
    return { sessions: {} };
  }
}

export function readDiskSession(
  sessionID: string,
): DiskSessionLifecycle | null {
  const rec = readDiskFile().sessions[sessionID];
  return rec ?? null;
}

export function writeDiskSession(
  sessionID: string,
  state: DiskSessionLifecycle,
): void {
  const fp = lifecyclePath();
  if (!fp) return;
  mkdirSync(dirname(fp), { recursive: true });
  const file = readDiskFile();
  file.sessions[sessionID] = state;
  writeFileSync(fp, `${JSON.stringify(file, null, 2)}\n`, "utf-8");
  if (state.planPath) writePlanFrontmatter(state.planPath, state);
}

export function writeSessionTodos(
  sessionID: string,
  todos: TodoSnapshot[],
): void {
  const existing = readDiskSession(sessionID);
  if (!existing) return;
  writeDiskSession(sessionID, { ...existing, todos });
}

const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?/;

export function writePlanFrontmatter(
  planPath: string,
  state: Pick<
    DiskSessionLifecycle,
    "status" | "checksum" | "frozenAt" | "planId"
  >,
): void {
  const abs = resolvePlanPath(planPath);
  if (!abs || !existsSync(abs)) return;
  let body = readFileSync(abs, "utf-8");
  const fm = [
    "---",
    `planId: ${state.planId}`,
    `status: ${state.status}`,
    `checksum: ${state.checksum ?? ""}`,
    `frozenAt: ${state.frozenAt ?? ""}`,
    "---",
    "",
  ].join("\n");
  if (FRONTMATTER_RE.test(body)) {
    body = body.replace(FRONTMATTER_RE, fm);
  } else {
    body = fm + body;
  }
  writeFileSync(abs, body, "utf-8");
}

function resolvePlanPath(planPath: string): string | null {
  if (!planPath) return null;
  if (planPath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(planPath)) {
    return planPath;
  }
  if (plansRoot) return join(plansRoot, planPath);
  return planPath;
}
