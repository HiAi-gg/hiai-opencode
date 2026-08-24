import type { PluginInput } from "@opencode-ai/plugin";
import { isPlanWritablePath } from "../permissions";
import type { BobConfig, HookSet } from "../types";
import { logger } from "../util/log";
import { BlockingHookError } from "./errors";

let client: PluginInput["client"] | null = null;

export function setPlanWriteClient(c: PluginInput["client"] | null) {
  client = c;
}

const MUTATION_TOOLS = new Set(["write", "edit", "apply_patch", "multiedit"]);

function mutationPath(args: unknown): string | undefined {
  if (!args || typeof args !== "object") return undefined;
  const rec = args as Record<string, unknown>;
  for (const key of ["filePath", "path", "file"]) {
    const v = rec[key];
    if (typeof v === "string" && v.trim()) return v;
  }
  return undefined;
}

async function resolveAgent(sessionID: string): Promise<string | undefined> {
  if (!client) return undefined;
  try {
    const res = await client.session.get({ path: { id: sessionID } });
    return (res.data as { agent?: string } | undefined)?.agent;
  } catch {
    return undefined;
  }
}

/**
 * Plan is read-only for code. Writes are allowed only under .bob/plans and
 * .bob/drafts. Other agents are untouched (their own restrictions apply).
 */
export function createPlanWriteGate(_config: BobConfig): HookSet {
  return {
    "tool.execute.before": async (input, output) => {
      try {
        const tool = input.tool?.toLowerCase();
        if (!tool || !MUTATION_TOOLS.has(tool)) return;
        const sid = input.sessionID;
        if (!sid) return;
        const agent = await resolveAgent(sid);
        if (agent !== "plan") return;
        const fp = mutationPath(output.args);
        if (!fp) {
          throw new BlockingHookError(
            "[hiai-opencode] PLAN WRITE: Plan may only write .bob/plans/* and .bob/drafts/*. Missing file path.",
          );
        }
        if (!isPlanWritablePath(fp)) {
          throw new BlockingHookError(
            `[hiai-opencode] PLAN WRITE: Plan may only write .bob/plans/* and .bob/drafts/*. Blocked path: ${fp}`,
          );
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        logger.error("[hiai-opencode] Hook error in plan-write-gate:", err);
      }
    },
  };
}
