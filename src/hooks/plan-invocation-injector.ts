import type { PluginInput } from "@opencode-ai/plugin";
import type { BobConfig, HookSet } from "../types";
import { logger } from "../util/log";
import { BlockingHookError } from "./errors";

let client: PluginInput["client"] | null = null;

export function setPlanInvocationClient(c: PluginInput["client"] | null) {
  client = c;
}

const SUBAGENT_REMINDER = `[hiai-opencode] INVOCATION CONTEXT: You (plan) are running as a SUBAGENT invoked by Bob/Manager/task inside an autonomous orchestration loop. The human is not directly interacting with you.
- USER QUESTIONING IS FORBIDDEN. Never call the \`question\` tool. Never ask the human anything.
- Resolve ambiguity autonomously: research, infer from repo conventions, record material assumptions in the plan, and continue.
- Only Bob's top-level human-interaction layer may involve the human later.`;

const DIRECT_REMINDER = `[hiai-opencode] INVOCATION CONTEXT: A human is directly interacting with you (plan) for initial interactive planning.
- You MAY use the built-in \`question\` tool ONLY when the Autonomy Contract's "INITIAL INTERACTIVE PLANNING" conditions all hold.
- Never print user-facing questions as ordinary assistant text when \`question\` is available.`;

/**
 * Deterministically informs the plan agent whether it is invoked as a subagent
 * (parent session exists → part of an autonomous Bob/Manager loop) or directly
 * by a human. This is required because the plan prompt alone cannot reliably
 * distinguish the two invocation modes, and the autonomy invariant forbids
 * user questioning inside the orchestration loop.
 */
export function createPlanInvocationInjector(_config: BobConfig): HookSet {
  return {
    "experimental.chat.system.transform": async (input, output) => {
      try {
        const sessionID = (input as { sessionID?: string }).sessionID;
        if (!sessionID) return;
        if (!client) return;
        const res = await client.session.get({ path: { id: sessionID } });
        const session = res.data as
          | { agent?: string; parentID?: string }
          | undefined;
        if (session?.agent !== "plan") return;
        output.system.push(
          session.parentID ? SUBAGENT_REMINDER : DIRECT_REMINDER,
        );
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        logger.error(
          "[hiai-opencode] Hook error in plan-invocation-injector:",
          err,
        );
      }
    },
  };
}
