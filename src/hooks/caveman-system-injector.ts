import type { PluginInput } from "@opencode-ai/plugin";
import {
  BOB_DECODE_BOUNDARY,
  BOB_INTERNAL_CAVEMAN,
  DELEGATION_CAVEMAN,
  SUBAGENT_INTERNAL,
} from "../prompt-library/caveman";
import type { BobConfig, CavemanConfig, HookSet } from "../types";
import { logger } from "../util/log";
import { BlockingHookError } from "./errors";

let client: PluginInput["client"] | null = null;

export function setCavemanClient(c: PluginInput["client"] | null) {
  client = c;
}

/**
 * Caveman System Injector — injects internal communication protocol
 * fragments into the system prompt for enabled target agents.
 *
 * Hook point: experimental.chat.system.transform
 *
 * For Bob: internal caveman style + delegation terse protocol + decode boundary.
 * For subagents: understand caveman briefs + answer tersely + keep CLOSURE.
 * Excluded agents (e.g., vision, writer): skipped entirely.
 *
 * Agent identity resolution (two sources, in priority order):
 * 1. Session lookup — `client.session.get(sessionID).agent`. This is the
 *    authoritative agent name and is correct even when multiple agents share
 *    the same model (which is the norm in bob.json: manager/explore/writer/
 *    general all use deepseek-v4-flash, build/plan both use deepseek-v4-pro).
 * 2. Model-ID reverse map fallback — used only when the session client is
 *    unavailable (e.g. unit tests, headless invocation without a session).
 *    NOTE: last-wins semantics mean the fallback is WRONG for shared models —
 *    it exists purely so the hook degrades gracefully, never as the primary.
 *
 * Hook not found in disable mechanism: add "caveman-system-injector" to
 * hooks.disabled in bob.json to turn off.
 */
export function createCavemanSystemInjector(config: BobConfig): HookSet {
  const caveman: CavemanConfig = config.caveman ?? {
    enabled: true,
    level: "full",
    bob_internal: true,
    bob_to_agents: true,
    agents_to_bob: true,
    final_user_output: "normal",
    target_agents: [
      "bob",
      "explore",
      "build",
      "critic",
      "general",
      "designer",
      "manager",
    ],
    exclude_agents: ["vision", "writer"],
    min_messages_to_compress: 5,
  };

  if (!caveman.enabled) {
    return {};
  }

  // Reverse-map: model ID → agent name using config.models.
  // Used ONLY as a fallback when no session client is available. Last-wins
  // semantics for agents sharing a model — see "Agent identity resolution".
  const modelToAgent = new Map<string, string>();
  if (config.models) {
    for (const [agentName, modelCfg] of Object.entries(config.models)) {
      if (modelCfg?.model) {
        modelToAgent.set(modelCfg.model, agentName);
      }
    }
  }

  return {
    "experimental.chat.system.transform": async (
      input: { sessionID?: string; model: { id: string } },
      output: { system: string[] },
    ) => {
      try {
        const modelId = input.model?.id;
        if (!modelId) return;

        const sessionID = input.sessionID;

        // Prefer the authoritative agent name from the session when available.
        let agentName: string | null = null;
        if (sessionID && client) {
          try {
            const res = await client.session.get({
              path: { id: sessionID },
            });
            const session = res.data as
              | { agent?: string; parentID?: string }
              | undefined;
            if (session?.agent) agentName = session.agent;
          } catch (err) {
            logger.log(
              `[hiai-opencode] caveman: session lookup failed for ${sessionID.slice(0, 6)}… — falling back to model map`,
            );
            void err;
          }
        }
        // Fallback: model-ID reverse map (correct only for unique models).
        if (!agentName) agentName = modelToAgent.get(modelId) ?? modelId;

        // Skip excluded agents — check both resolved name and raw model ID.
        // The modelId check is a safety net for excluded agents that share
        // a model with non-excluded agents (reverse map may resolve incorrectly).
        if (
          caveman.exclude_agents?.includes(agentName) ||
          caveman.exclude_agents?.includes(modelId)
        ) {
          return;
        }

        // Check if this agent is in the target list
        const isTarget = caveman.target_agents?.includes(agentName) ?? true;

        if (!isTarget) return;

        // Bob gets: internal style + delegation protocol + decode boundary
        if (agentName === "bob") {
          if (caveman.bob_internal) {
            output.system.push(BOB_INTERNAL_CAVEMAN);
          }
          if (caveman.bob_to_agents) {
            output.system.push(DELEGATION_CAVEMAN);
          }
          output.system.push(BOB_DECODE_BOUNDARY);
          return;
        }

        // Subagents get: understand caveman + answer tersely
        if (caveman.agents_to_bob) {
          output.system.push(SUBAGENT_INTERNAL);
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        logger.error("[hiai-opencode] caveman-system-injector error:", err);
      }
    },
  };
}
