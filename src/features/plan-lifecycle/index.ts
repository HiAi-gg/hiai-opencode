import {
  planIdFromPath,
  readDiskSession,
  type TodoSnapshot,
  writeDiskSession,
  writeSessionTodos,
} from "./persist";

export type PlanLifecycleStatus =
  | "none"
  | "frozen"
  | "executing"
  | "done"
  | "invalidated";

export interface PlanLifecycleState {
  status: PlanLifecycleStatus;
  planId: string | null;
  planPath: string | null;
  checksum: string | null;
  frozenAt: number | null;
  implementingWorkerCompleted: boolean;
  todos: TodoSnapshot[];
  hydratedFromDisk: boolean;
}

const MAX_SESSIONS = 200;
const store = new Map<string, PlanLifecycleState>();

const IMPLEMENTING_WORKERS = new Set([
  "build",
  "general",
  "designer",
  "writer",
  "manager",
]);

export const INVALIDATE_PLAN_TOKEN = "INVALIDATE_PLAN";

export { setPlansRoot } from "./persist";

function empty(): PlanLifecycleState {
  return {
    status: "none",
    planId: null,
    planPath: null,
    checksum: null,
    frozenAt: null,
    implementingWorkerCompleted: false,
    todos: [],
    hydratedFromDisk: false,
  };
}

function enforceCap(): void {
  while (store.size > MAX_SESSIONS) {
    const oldest = store.keys().next().value;
    if (oldest === undefined) break;
    store.delete(oldest);
  }
}

export function getPlanLifecycle(sessionID: string): PlanLifecycleState {
  let s = store.get(sessionID);
  if (!s) {
    s = empty();
    store.set(sessionID, s);
    enforceCap();
  }
  if (s.status === "none") hydrateFromDisk(sessionID, s);
  return s;
}

function hydrateFromDisk(sessionID: string, s: PlanLifecycleState): void {
  const disk = readDiskSession(sessionID);
  if (!disk) return;
  if (disk.status !== "frozen" && disk.status !== "executing") return;
  s.status = disk.status;
  s.planId = disk.planId;
  s.planPath = disk.planPath;
  s.checksum = disk.checksum;
  s.frozenAt = disk.frozenAt;
  s.implementingWorkerCompleted = disk.implementingWorkerCompleted ?? false;
  s.todos = disk.todos ?? [];
  s.hydratedFromDisk = true;
}

function persist(sessionID: string, s: PlanLifecycleState): void {
  if (!s.planPath && s.status === "none") return;
  writeDiskSession(sessionID, {
    planId: s.planId ?? (s.planPath ? planIdFromPath(s.planPath) : "plan"),
    planPath: s.planPath ?? "",
    status: s.status,
    checksum: s.checksum,
    frozenAt: s.frozenAt,
    implementingWorkerCompleted: s.implementingWorkerCompleted,
    todos: s.todos,
  });
}

export function recordFrozenPlan(
  sessionID: string,
  planPath: string | null,
  checksum: string | null,
): PlanLifecycleState {
  const s = getPlanLifecycle(sessionID);
  s.status = "frozen";
  s.planPath = planPath;
  s.planId = planPath ? planIdFromPath(planPath) : "plan";
  s.checksum = checksum;
  s.frozenAt = Date.now();
  s.implementingWorkerCompleted = false;
  persist(sessionID, s);
  return s;
}

export function markExecuting(sessionID: string): PlanLifecycleState {
  const s = getPlanLifecycle(sessionID);
  if (s.status === "frozen") s.status = "executing";
  persist(sessionID, s);
  return s;
}

export function markImplementingWorkerCompleted(
  sessionID: string,
): PlanLifecycleState {
  const s = getPlanLifecycle(sessionID);
  s.implementingWorkerCompleted = true;
  persist(sessionID, s);
  return s;
}

export function markPlanDone(sessionID: string): PlanLifecycleState {
  const s = getPlanLifecycle(sessionID);
  s.status = "done";
  persist(sessionID, s);
  return s;
}

export function invalidatePlan(sessionID: string): PlanLifecycleState {
  const s = getPlanLifecycle(sessionID);
  s.status = "invalidated";
  s.implementingWorkerCompleted = false;
  persist(sessionID, s);
  return s;
}

export function setPlanTodos(
  sessionID: string,
  todos: TodoSnapshot[],
): PlanLifecycleState {
  const s = getPlanLifecycle(sessionID);
  s.todos = todos;
  if (s.status === "frozen" || s.status === "executing") {
    writeSessionTodos(sessionID, todos);
  }
  return s;
}

export type { TodoSnapshot } from "./persist";

export function resetPlanLifecycle(sessionID: string): void {
  store.set(sessionID, empty());
}

export function clearPlanLifecycle(sessionID: string): void {
  store.delete(sessionID);
}

export function isImplementingWorker(agent: string): boolean {
  return IMPLEMENTING_WORKERS.has(agent);
}

export function promptRequestsInvalidate(prompt: string | undefined): boolean {
  return typeof prompt === "string" && prompt.includes(INVALIDATE_PLAN_TOKEN);
}

export function canSpawnPlan(
  sessionID: string,
  opts?: { invalidate?: boolean },
): { allow: boolean; reason: string } {
  const s = getPlanLifecycle(sessionID);
  if (s.status === "frozen" || s.status === "executing") {
    if (opts?.invalidate) {
      return {
        allow: true,
        reason: "invalidate requested — frozen plan discarded",
      };
    }
    return {
      allow: false,
      reason:
        "Frozen plan is still active. Execute its waves. Include INVALIDATE_PLAN only if scope changed, a worker proved the plan wrong, or delivery Critic said it is unexecutable.",
    };
  }
  return { allow: true, reason: "plan spawn allowed" };
}

export function canSpawnCritic(
  sessionID: string,
  opts: {
    hasIncompleteTodos: boolean;
    /** Manager closing its assigned phase — not Bob's delivery critic. */
    caller?: "bob" | "manager" | "other";
  },
): { allow: boolean; reason: string } {
  if (opts.caller === "manager") {
    const s = getPlanLifecycle(sessionID);
    if (!s.implementingWorkerCompleted) {
      return {
        allow: false,
        reason:
          "Phase workers have not finished. Manager may call Critic once at phase close, not after each sub.",
      };
    }
    return {
      allow: true,
      reason: "phase-close critic allowed",
    };
  }

  const s = getPlanLifecycle(sessionID);
  if (
    s.status === "none" ||
    s.status === "done" ||
    s.status === "invalidated"
  ) {
    return { allow: true, reason: "delivery critic allowed" };
  }
  // frozen | executing (Bob delivery)
  if (opts.hasIncompleteTodos) {
    return {
      allow: false,
      reason:
        "Plan waves are still open (incomplete todos). Delivery Critic runs after all waves finish. A Manager may still run a phase-close Critic on its own session.",
    };
  }
  if (!s.implementingWorkerCompleted) {
    return {
      allow: false,
      reason:
        "No implementing worker has finished yet. Critic runs once at delivery after implementation waves.",
    };
  }
  return {
    allow: true,
    reason: "plan waves complete — delivery critic allowed",
  };
}

export function checksumText(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}
