import type { PluginInput } from "@opencode-ai/plugin";
import { getPlanLifecycle } from "../features/plan-lifecycle";
import type { BobConfig, HookSet } from "../types";
import { BlockingHookError } from "./errors";
import { logger } from "../util/log";

let client: PluginInput["client"] | null = null;

export function setHostInteractionClient(c: PluginInput["client"] | null) {
  client = c;
}

function isQuestionTool(tool: string | undefined): boolean {
  if (!tool) return false;
  const t = tool.toLowerCase();
  return t === "question" || t.endsWith("_question");
}

/**
 * Native OpenCode `question` opens the host interview UI.
 * Plan/Bob may use it only as the top-level human session (no parentID).
 * Any subagent — including Plan spawned by Bob — must not interview.
 */
export function createHostInteractionGate(_config: BobConfig): HookSet {
  return {
    "tool.execute.before": async (input) => {
      try {
        if (!isQuestionTool(input.tool)) return;
        const sid = input.sessionID;
        if (!sid || !client) return;
        const res = await client.session.get({ path: { id: sid } });
        const session = res.data as { parentID?: string; agent?: string } | undefined;
        if (session?.parentID) {
          logger.log(
            `[hiai-opencode] host-interaction: denied question in subagent ${session.agent ?? "unknown"}`,
          );
          throw new BlockingHookError(
            "[hiai-opencode] QUESTION blocked: this agent is a subagent. Only a directly invoked Plan (or Bob) may interview the human. Record an assumption and continue.",
          );
        }
        const plan = getPlanLifecycle(sid);
        if (plan.status === "frozen" || plan.status === "executing") {
          logger.log(
            `[hiai-opencode] host-interaction: denied question while plan ${plan.status}`,
          );
          throw new BlockingHookError(
            "[hiai-opencode] QUESTION blocked: a frozen plan is executing. Do not re-ask the user. Continue the remaining waves or the delivery Critic.",
          );
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        logger.error("[hiai-opencode] Hook error in host-interaction-gate:", err);
      }
    },
  };
}
