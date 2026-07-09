import {
  BOB_DECODE_BOUNDARY,
  BOB_INTERNAL_CAVEMAN,
  DELEGATION_CAVEMAN,
  SUBAGENT_INTERNAL,
} from '../prompt-library/caveman';
import type { BobConfig, CavemanConfig, HookSet } from '../types';

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
 * Runtime Agent Identity:
 * The hook input only provides { sessionID?, model: { id } } — no explicit
 * agent name field. Agent identity is resolved via a model-ID reverse map
 * (config.models). When multiple agents share the same model (e.g. general
 * and explore both using deepseek-v4-flash), the reverse map stores only
 * the LAST such agent in iteration order — a known limitation.
 *
 * Exclusion fallback: to catch excluded agents that share a model with
 * non-excluded agents, also check modelId against exclude_agents directly.
 * This ensures an excluded agent is skipped even if the reverse map
 * resolves to a different agent sharing the same model.
 *
 * Hook not found in disable mechanism: add "caveman-system-injector" to
 * hooks.disabled in bob.json to turn off.
 */
export function createCavemanSystemInjector(config: BobConfig): HookSet {
  const caveman: CavemanConfig = config.caveman ?? {
    enabled: true,
    level: 'full',
    bob_internal: true,
    bob_to_agents: true,
    agents_to_bob: true,
    final_user_output: 'normal',
    target_agents: ['bob', 'explore', 'build', 'critic', 'general', 'designer', 'manager'],
    exclude_agents: ['vision', 'writer'],
    min_messages_to_compress: 5,
  };

  if (!caveman.enabled) {
    return {};
  }

  // Reverse-map: model ID → agent name using config.models.
  // Uses last-wins semantics for agents sharing a model — a known limitation.
  // See "Runtime Agent Identity" comment above.
  const modelToAgent = new Map<string, string>();
  if (config.models) {
    for (const [agentName, modelCfg] of Object.entries(config.models)) {
      if (modelCfg?.model) {
        modelToAgent.set(modelCfg.model, agentName);
      }
    }
  }

  return {
    'experimental.chat.system.transform': async (
      input: { sessionID?: string; model: { id: string } },
      output: { system: string[] },
    ) => {
      try {
        const modelId = input.model?.id;
        if (!modelId) return;

        // Agent identity resolved from model ID via reverse map.
        // No explicit agent field in hook input — see "Runtime Agent Identity" above.
        const agentName = modelToAgent.get(modelId) ?? modelId;

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
        if (agentName === 'bob') {
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
        console.error('[hiai-opencode] caveman-system-injector error:', err);
      }
    },
  };
}
