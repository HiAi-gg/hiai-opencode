import type { DelegateTaskArgs } from "./types"
import type { ExecutorContext } from "./executor-types"
import type { DelegatedModelConfig } from "./types"
import { isPlanFamily } from "./constants"
import {
  SUB_AGENT_CONFIG_KEY,
  resolveCanonicalDelegateAgentKey,
} from "./sub-agent"
import { applyCategoryParams } from "./delegated-model-config"
import { resolveEffectiveFallbackEntry } from "./fallback-entry-resolution"
import { applyFallbackEntrySettings } from "./fallback-entry-settings"
import {
  type AgentInfo,
  sanitizeSubagentType,
  mergeWithClaudeCodeAgents,
  findPrimaryAgentMatch,
  findCallableAgentMatch,
  listCallableAgentNames,
} from "./subagent-discovery"
import { normalizeModelFormat } from "../../shared/model-format-normalizer"
import { AGENT_MODEL_REQUIREMENTS } from "../../shared/model-requirements"
import { normalizeFallbackModels, flattenToFallbackModelStrings } from "../../shared/model-resolver"
import { buildFallbackChainFromModels } from "../../shared/fallback-chain-from-models"
import { getAgentConfigKey, stripAgentListSortPrefix } from "../../shared/agent-display-names"
import { normalizeSDKResponse } from "../../shared"
import { log } from "../../shared/logger"
import { getAvailableModelsForDelegateTask } from "./available-models"
import type { FallbackEntry } from "../../shared/model-requirements"
import { resolveModelForDelegateTask } from "./model-selection"
import { fuzzyMatchModel } from "../../shared/model-availability"

export async function resolveSubagentExecution(
  args: DelegateTaskArgs,
  executorCtx: ExecutorContext,
  parentAgent: string | undefined,
  categoryExamples: string
): Promise<{ agentToUse: string; categoryModel: DelegatedModelConfig | undefined; fallbackChain?: FallbackEntry[]; error?: string }> {
  const { client, agentOverrides, userCategories } = executorCtx

  if (!args.subagent_type?.trim()) {
    return { agentToUse: "", categoryModel: undefined, error: `Agent name cannot be empty.` }
  }

  const requestedAgentName = sanitizeSubagentType(args.subagent_type)
  const requestedCanonicalAgentKey = resolveCanonicalDelegateAgentKey(requestedAgentName)

  if (requestedCanonicalAgentKey === SUB_AGENT_CONFIG_KEY) {
    return {
      agentToUse: "",
      categoryModel: undefined,
      error: `Cannot use subagent_type="${args.subagent_type}" directly. Use category parameter instead (e.g., ${categoryExamples}).

SubAgent is spawned automatically when you specify a category. Pick the appropriate category for your task domain.`,
    }
  }

  if (requestedCanonicalAgentKey === "agent-skills") {
    return {
      agentToUse: "",
      categoryModel: undefined,
      error: `Cannot use subagent_type="${args.subagent_type}" directly. Agent Skills is a hidden system agent for skill registry and discovery, not a normal task executor.`,
    }
  }

  const canonicalParentAgent = parentAgent ? resolveCanonicalDelegateAgentKey(parentAgent) : undefined
  if (isPlanFamily(requestedCanonicalAgentKey) && isPlanFamily(canonicalParentAgent)) {
    return {
      agentToUse: "",
      categoryModel: undefined,
    error: `You are a plan-family agent (plan/strategist). You cannot delegate to other plan-family agents via task.

Create the work plan directly - that's your job as the planning agent.`,
    }
  }

  const ORCHESTRATOR_AGENTS: Set<string> = new Set(["bob"])
  if (ORCHESTRATOR_AGENTS.has(requestedCanonicalAgentKey)) {
    return {
      agentToUse: "",
      categoryModel: undefined,
      error: `Cannot delegate to orchestrator agent "${requestedCanonicalAgentKey}". Bob is the entry-point orchestrator and is not callable as a subagent. Use a specific subagent (researcher/strategist/coder/...) or a mode (quick/deep/...).`,
    }
  }

  if (canonicalParentAgent && canonicalParentAgent === requestedCanonicalAgentKey) {
    return {
      agentToUse: "",
      categoryModel: undefined,
      error: `Self-delegation not allowed: agent "${requestedCanonicalAgentKey}" cannot delegate to itself via task. Continue the work directly or use session_id=... to continue an existing subagent session.`,
    }
  }

  let agentToUse = requestedAgentName
  let categoryModel: DelegatedModelConfig | undefined
  let fallbackChain: FallbackEntry[] | undefined = undefined

  try {
    const agentsResult = await client.app.agents()
    const agents = normalizeSDKResponse(agentsResult, [] as AgentInfo[], {
      preferResponseOnMissingData: true,
    })

    const mergedAgents = mergeWithClaudeCodeAgents(agents, executorCtx.directory)

    const matchedPrimaryAgent = findPrimaryAgentMatch(mergedAgents, agentToUse)
    if (matchedPrimaryAgent) {
      return {
        agentToUse: "",
        categoryModel: undefined,
        error: `Cannot delegate to primary agent "${stripAgentListSortPrefix(matchedPrimaryAgent.name)}" via task. Select that agent directly instead.`,
      }
    }

    const matchedAgent = findCallableAgentMatch(mergedAgents, agentToUse)
    if (!matchedAgent) {
      return {
        agentToUse: "",
        categoryModel: undefined,
        error: `Unknown agent: "${requestedAgentName}". Available agents: ${listCallableAgentNames(mergedAgents)}`,
      }
    }

    agentToUse = stripAgentListSortPrefix(matchedAgent.name)

    const matchedAgentConfigKey = getAgentConfigKey(agentToUse).toLowerCase()
    const canonicalAgentConfigKey = resolveCanonicalDelegateAgentKey(agentToUse).toLowerCase()
    const agentConfigLookupKeys = Array.from(new Set([
      canonicalAgentConfigKey,
      matchedAgentConfigKey,
    ]))

    const agentOverride = agentOverrides
      ? Object.entries(agentOverrides).find(([key]) => agentConfigLookupKeys.includes(key.toLowerCase()))?.[1]
      : undefined
    const agentRequirement = agentConfigLookupKeys
      .map((key) => AGENT_MODEL_REQUIREMENTS[key])
      .find((requirement): requirement is NonNullable<typeof requirement> => requirement !== undefined)
    const agentCategoryConfig = agentOverride?.category
      ? userCategories?.[agentOverride.category]
      : undefined
    const agentCategoryModel = agentCategoryConfig?.model
    const normalizedAgentFallbackModels = normalizeFallbackModels(
      agentOverride?.fallback_models
      ?? agentCategoryConfig?.fallback_models
    )

    const availableModels = await getAvailableModelsForDelegateTask(client)

    if (agentOverride?.model || agentCategoryModel || agentRequirement || matchedAgent.model) {

      const normalizedMatchedModel = matchedAgent.model
        ? normalizeModelFormat(matchedAgent.model)
        : undefined
      const matchedAgentModelStr = normalizedMatchedModel
        ? `${normalizedMatchedModel.providerID}/${normalizedMatchedModel.modelID}`
        : undefined

      const resolution = resolveModelForDelegateTask({
        userModel: agentOverride?.model ?? agentCategoryModel,
        userFallbackModels: flattenToFallbackModelStrings(normalizedAgentFallbackModels),
        categoryDefaultModel: matchedAgentModelStr,
        fallbackChain: agentRequirement?.fallbackChain,
        availableModels,
        systemDefaultModel: undefined,
      })

      const resolutionSkipped = resolution && 'skipped' in resolution

      if (resolution && !resolutionSkipped) {
        const normalized = normalizeModelFormat(resolution.model)
        if (normalized) {
          const variantToUse = agentOverride?.variant ?? resolution.variant ?? agentCategoryConfig?.variant
          const resolvedModel = variantToUse ? { ...normalized, variant: variantToUse } : normalized
          categoryModel = applyCategoryParams(resolvedModel, agentCategoryConfig)
        }
      } else if (resolutionSkipped && (agentOverride?.model ?? agentCategoryModel)) {
        const normalized = normalizeModelFormat((agentOverride?.model ?? agentCategoryModel)!)
        if (normalized) {
          const variantToUse = agentOverride?.variant ?? agentCategoryConfig?.variant
          const resolvedModel = variantToUse ? { ...normalized, variant: variantToUse } : normalized
          categoryModel = applyCategoryParams(resolvedModel, agentCategoryConfig)
          log("[delegate-task] Cold cache: using explicit user override for subagent", {
            agent: agentToUse,
            model: agentOverride?.model ?? agentCategoryModel,
          })
        }
      }

      const defaultProviderID = categoryModel?.providerID
        ?? normalizedMatchedModel?.providerID
        ?? "opencode"
      const configuredFallbackChain = buildFallbackChainFromModels(
        normalizedAgentFallbackModels,
        defaultProviderID,
      )
      fallbackChain = configuredFallbackChain ?? (resolutionSkipped ? undefined : agentRequirement?.fallbackChain)
      const effectiveEntry = resolveEffectiveFallbackEntry({
        categoryModel,
        configuredFallbackChain,
        resolution,
      })

      if (categoryModel && effectiveEntry) {
        categoryModel = applyFallbackEntrySettings({
          categoryModel,
          effectiveEntry,
          variantOverride: agentOverride?.variant,
        })
      }
    }

    if (!categoryModel && matchedAgent.model) {
      const normalizedMatchedModel = normalizeModelFormat(matchedAgent.model)
      if (normalizedMatchedModel) {
        const fullModel = `${normalizedMatchedModel.providerID}/${normalizedMatchedModel.modelID}`
        if (availableModels.size === 0 || fuzzyMatchModel(fullModel, availableModels, [normalizedMatchedModel.providerID])) {
          categoryModel = normalizedMatchedModel
        } else {
          log("[delegate-task] Skipping unavailable agent default model", {
            agent: agentToUse,
            model: fullModel,
          })
        }
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    log("[delegate-task] Failed to resolve subagent execution", {
      requestedAgent: agentToUse,
      parentAgent,
      error: errorMessage,
    })

    return {
      agentToUse: "",
      categoryModel: undefined,
      error: `Failed to delegate to agent "${agentToUse}": ${errorMessage}`,
    }
  }

  return { agentToUse, categoryModel, fallbackChain }
}
