import { tool, type PluginInput, type ToolDefinition } from "@opencode-ai/plugin"
import {
  CALL_OMO_AGENT_DESCRIPTION,
  PRIMARY_ALLOWED_AGENTS,
} from "./constants"
import type { AllowedAgentType, CallOmoAgentArgs, ToolContextWithMetadata } from "./types"
import type { BackgroundManager } from "../../features/background-agent"
import type { CategoriesConfig, AgentOverrides } from "../../config/schema"
import type { DelegatedModelConfig } from "../../shared/model-resolution-types"
import type { FallbackEntry } from "../../shared/model-requirements"
import { AGENT_MODEL_REQUIREMENTS } from "../../shared/model-requirements"
import { getAgentConfigKey, stripInvisibleAgentCharacters } from "../../shared/agent-display-names"
import { resolveCanonicalDelegateAgentKey } from "../../tools/delegate-task/sub-agent"
import { normalizeFallbackModels } from "../../shared/model-resolver"
import { buildFallbackChainFromModels } from "../../shared/fallback-chain-from-models"
import { log } from "../../shared"
import { CONFIG_BASENAME } from "../../shared/plugin-identity"
import { parseModelString } from "../delegate-task/model-string-parser"
import { executeBackground } from "./background-executor"
import { executeSync } from "./sync-executor"
import { resolveCallableAgents } from "./agent-resolver"

function resolveModelAndFallbackChain(args: {
  subagentType: string
  agentOverrides?: AgentOverrides
  userCategories?: CategoriesConfig
}): { model: DelegatedModelConfig | undefined; fallbackChain: FallbackEntry[] | undefined } {
  const { subagentType, agentOverrides, userCategories } = args
  const agentConfigKey = getAgentConfigKey(subagentType)
  const agentRequirement = AGENT_MODEL_REQUIREMENTS[agentConfigKey]

  const agentOverride = agentOverrides?.[agentConfigKey as keyof AgentOverrides]
    ?? (agentOverrides
      ? Object.entries(agentOverrides).find(([key]) => key.toLowerCase() === agentConfigKey)?.[1]
      : undefined)
  const agentCategoryModel = agentOverride?.category
    ? userCategories?.[agentOverride.category]?.model
    : undefined
  const agentCategoryVariant = agentOverride?.category
    ? userCategories?.[agentOverride.category]?.variant
    : undefined

  let model: DelegatedModelConfig | undefined
  if (agentOverride?.model) {
    const normalized = parseModelString(agentOverride.model)
    if (normalized) {
      model = agentOverride.variant ? { ...normalized, variant: agentOverride.variant } : normalized
      log("[call_omo_agent] Resolved model override from agent config", {
        agent: subagentType,
        model: agentOverride.model,
        variant: agentOverride.variant,
      })
    }
  } else if (agentCategoryModel) {
    const normalized = parseModelString(agentCategoryModel)
    if (normalized) {
      const variantToUse = agentOverride?.variant ?? agentCategoryVariant
      model = variantToUse ? { ...normalized, variant: variantToUse } : normalized
      log("[call_omo_agent] Resolved model override from agent category", {
        agent: subagentType,
        category: agentOverride?.category,
        model: agentCategoryModel,
        variant: variantToUse,
      })
    }
  }

  const normalizedFallbackModels = normalizeFallbackModels(
    agentOverride?.fallback_models
    ?? (agentOverride?.category ? userCategories?.[agentOverride.category]?.fallback_models : undefined)
  )
  const defaultProviderID = model?.providerID
    ?? agentRequirement?.fallbackChain?.[0]?.providers?.[0]
    ?? "opencode"
  const configuredFallbackChain = buildFallbackChainFromModels(normalizedFallbackModels, defaultProviderID)

  return {
    model,
    fallbackChain: configuredFallbackChain ?? agentRequirement?.fallbackChain,
  }
}

export function createCallOmoAgent(
  ctx: PluginInput,
  backgroundManager: BackgroundManager,
  disabledAgents: string[] = [],
  agentOverrides?: AgentOverrides,
  userCategories?: CategoriesConfig,
): ToolDefinition {
  const primaryAgentDescriptions = PRIMARY_ALLOWED_AGENTS.map((name) => {
    switch (name) {
      case "researcher":
        return "- researcher: Canonical agent for codebase exploration and research";
      case "strategist":
        return "- strategist: Canonical agent for planning and reasoning";
      case "coder":
        return "- coder: Canonical agent for implementation work";
      case "critic":
        return "- critic: Canonical agent for review and verification";
      case "designer":
        return "- designer: Canonical agent for visual direction, interface design, and creative execution";
      case "brainstormer":
        return "- brainstormer: Canonical agent for ideation, option generation, and concept exploration";
      case "platform-manager":
        return "- platform-manager: Canonical agent for project setup, continuity, and platform management tasks";
      case "multimodal":
        return "- multimodal: Canonical agent for visual and multimodal tasks (runtime display name: Vision)";
    }
  }).join("\n");

  const description = CALL_OMO_AGENT_DESCRIPTION.replace(
    "{primary_agents}",
    primaryAgentDescriptions,
  );

  return tool({
    description,
    args: {
      description: tool.schema
        .string()
        .describe("A short (3-5 words) description of the task"),
      prompt: tool.schema
        .string()
        .describe("The task for the agent to perform"),
      subagent_type: tool.schema
        .string()
        .describe(
          "The agent to invoke. Canonical names are preferred; compatibility aliases and custom agents are also accepted.",
        ),
      run_in_background: tool.schema
        .boolean()
        .describe(
          "REQUIRED. true: run asynchronously (use background_output to get results), false: run synchronously and wait for completion",
        ),
      session_id: tool.schema
        .string()
        .describe("Existing Task session to continue")
        .optional(),
    },
    async execute(args: CallOmoAgentArgs, toolContext) {
      const toolCtx = toolContext as ToolContextWithMetadata;
      log(
        `[call_omo_agent] DEPRECATED: call_omo_agent is deprecated. Use task(agent="...", load_skills=[], run_in_background=...) instead.`,
      );

      const callableAgents = await resolveCallableAgents(ctx.client);

      // Strip ZWSP and case-insensitive agent validation - allows canonical names and compatibility aliases.
      const strippedAgentType = stripInvisibleAgentCharacters(args.subagent_type)
      const preCanonicalAgentType = getAgentConfigKey(strippedAgentType)
      const canonicalAgentType = resolveCanonicalDelegateAgentKey(preCanonicalAgentType)
      const wasLegacyAlias = canonicalAgentType !== preCanonicalAgentType.toLowerCase()
      if (wasLegacyAlias) {
        log("[call_omo_agent] Legacy agent alias resolved", { from: preCanonicalAgentType, to: canonicalAgentType })
      }
      if (
        !callableAgents.some(
          (name) => name.toLowerCase() === canonicalAgentType.toLowerCase(),
        )
      ) {
        return `Error: Invalid agent type "${args.subagent_type}". Available agents: ${callableAgents.join(", ")}. Legacy aliases: oracle→strategist, hephaestus→coder, metis→strategist, momus→critic, sisyphus-junior→sub, multimodal-looker→multimodal, librarian→researcher, explore→researcher.`;
      }

      const normalizedAgent = canonicalAgentType.toLowerCase();
      args = { ...args, subagent_type: normalizedAgent };

      // Check if agent is disabled
      if (disabledAgents.some((disabled) => stripInvisibleAgentCharacters(disabled).toLowerCase() === normalizedAgent)) {
        return `Error: Agent "${normalizedAgent}" is disabled via disabled_agents configuration. Remove it from disabled_agents in your ${CONFIG_BASENAME}.json to use it.`
      }

      const { model: resolvedModel, fallbackChain } = resolveModelAndFallbackChain({
        subagentType: args.subagent_type,
        agentOverrides,
        userCategories,
      })

      if (args.run_in_background) {
        if (args.session_id) {
          return `Error: session_id is not supported in background mode. Use run_in_background=false to continue an existing session.`;
        }
        return await executeBackground(args, toolCtx, backgroundManager, ctx.client, fallbackChain, resolvedModel)
      }

      if (!args.session_id) {
        let spawnReservation: Awaited<ReturnType<BackgroundManager["reserveSubagentSpawn"]>> | undefined
        try {
          spawnReservation = await backgroundManager.reserveSubagentSpawn(toolCtx.sessionID)
          return await executeSync(args, toolCtx, ctx, undefined, fallbackChain, spawnReservation, resolvedModel)
        } catch (error) {
          spawnReservation?.rollback()
          return `Error: ${error instanceof Error ? error.message : String(error)}`
        }
      }

      return await executeSync(args, toolCtx, ctx, undefined, fallbackChain, undefined, resolvedModel)
    },
  });
}
