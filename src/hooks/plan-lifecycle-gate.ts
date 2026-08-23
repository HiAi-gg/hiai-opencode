import type { PluginInput } from "@opencode-ai/plugin";
import type { BobConfig, HookSet } from "../types";
import {
  canSpawnCritic,
  canSpawnPlan,
  checksumText,
  getPlanLifecycle,
  invalidatePlan,
  isImplementingWorker,
  markExecuting,
  markImplementingWorkerCompleted,
  markPlanDone,
  promptRequestsInvalidate,
  recordFrozenPlan,
} from "../features/plan-lifecycle";
import { get as getCompletion } from "../features/completion-controller/state";
import { BlockingHookError } from "./errors";
import { logger } from "../util/log";

let client: PluginInput["client"] | null = null;

export function setPlanLifecycleClient(c: PluginInput["client"] | null) {
  client = c;
}

function shortId(sessionID: string): string {
  if (sessionID.length <= 12) return sessionID;
  return `${sessionID.slice(0, 6)}…${sessionID.slice(-4)}`;
}

function isTaskTool(tool: string | undefined): boolean {
  return typeof tool === "string" && tool.toLowerCase() === "task";
}

function taskArgs(
  primary?: { args?: unknown } | null,
  fallback?: { args?: unknown } | null,
): Record<string, unknown> {
  const raw = primary?.args ?? fallback?.args;
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  return {};
}

async function resolveCallerAgent(
  sessionID: string,
): Promise<"bob" | "manager" | "other"> {
  if (!client) return "other";
  try {
    const res = await client.session.get({ path: { id: sessionID } });
    const agent = (res.data as { agent?: string } | undefined)?.agent;
    if (agent === "manager") return "manager";
    if (agent === "bob") return "bob";
  } catch {
    /* session lookup is best-effort */
  }
  return "other";
}

export function taskSubagentType(args: Record<string, unknown>): string | undefined {
  const v = args.subagent_type ?? args.subagentType ?? args.agent ?? args.name;
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function taskPrompt(args: Record<string, unknown>): string | undefined {
  const v = args.prompt ?? args.description;
  return typeof v === "string" ? v : undefined;
}

function planReturnedDone(text: string): boolean {
  return /\*\*Status:\*\*\s*done/i.test(text) || /\bStatus:\s*done\b/i.test(text);
}

function extractPlanPath(text: string): string | null {
  const m = text.match(/\.bob\/plans\/[^\s)`'"\]]+/);
  return m ? m[0] : null;
}

export function createPlanLifecycleGate(_config: BobConfig): HookSet {
  return {
    "experimental.chat.system.transform": async (input, output) => {
      try {
        const sid = (input as { sessionID?: string }).sessionID;
        if (!sid) return;
        const s = getPlanLifecycle(sid);
        if (!s.hydratedFromDisk) return;
        const open = s.todos.filter(
          (t) => t.status !== "completed" && t.status !== "cancelled",
        ).length;
        output.system.push(
          `[hiai-opencode] PLAN SNAPSHOT: ${open} open todos from ${s.planPath ?? "plan"} — restore via todowrite then continue. Do not start a new Plan.`,
        );
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        logger.error(
          "[hiai-opencode] Hook error in plan-lifecycle snapshot inject:",
          err,
        );
      }
    },
    "tool.execute.before": async (input, output) => {
      try {
        if (!isTaskTool(input.tool)) return;
        const sid = input.sessionID;
        if (!sid) return;
        const args = taskArgs(output, input as { args?: unknown });
        const agent = taskSubagentType(args);
        if (!agent) return;

        if (agent === "plan") {
          const invalidate = promptRequestsInvalidate(taskPrompt(args));
          const decision = canSpawnPlan(sid, { invalidate });
          if (!decision.allow) {
            logger.log(
              `[hiai-opencode] plan-lifecycle: denied_replan ${shortId(sid)}`,
            );
            throw new BlockingHookError(
              `[hiai-opencode] PLAN FREEZE: ${decision.reason}`,
            );
          }
          if (invalidate) invalidatePlan(sid);
          logger.log(
            `[hiai-opencode] plan-lifecycle: plan_spawn ${shortId(sid)}`,
          );
          return;
        }

        if (agent === "critic") {
          const caller = await resolveCallerAgent(sid);
          const hasIncompleteTodos = getCompletion(sid).hasIncompleteTodos;
          const decision = canSpawnCritic(sid, {
            hasIncompleteTodos,
            caller,
          });
          if (!decision.allow) {
            logger.log(
              `[hiai-opencode] plan-lifecycle: denied_early_critic ${shortId(sid)} caller=${caller}`,
            );
            throw new BlockingHookError(
              `[hiai-opencode] CRITIC: ${decision.reason}`,
            );
          }
          if (caller === "manager") {
            logger.log(
              `[hiai-opencode] plan-lifecycle: phase_critic ${shortId(sid)}`,
            );
            return;
          }
          markPlanDone(sid);
          logger.log(
            `[hiai-opencode] plan-lifecycle: delivery_critic ${shortId(sid)}`,
          );
          return;
        }

        markExecuting(sid);
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        logger.error("[hiai-opencode] Hook error in plan-lifecycle-gate:", err);
      }
    },

    "tool.execute.after": async (input, output) => {
      try {
        if (!isTaskTool(input.tool)) return;
        const sid = input.sessionID;
        if (!sid) return;
        const args = taskArgs(input, output as { args?: unknown });
        const agent = taskSubagentType(args);
        if (!agent) return;

        if (agent === "plan") {
          const text = typeof output.output === "string" ? output.output : "";
          if (planReturnedDone(text)) {
            recordFrozenPlan(sid, extractPlanPath(text), checksumText(text));
            logger.log(
              `[hiai-opencode] plan-lifecycle: frozen ${shortId(sid)}`,
            );
          }
          return;
        }

        if (isImplementingWorker(agent)) {
          markExecuting(sid);
          markImplementingWorkerCompleted(sid);
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        logger.error("[hiai-opencode] Hook error in plan-lifecycle-gate:", err);
      }
    },
  };
}
