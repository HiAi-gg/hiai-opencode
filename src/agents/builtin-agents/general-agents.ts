import type { AgentConfig } from "@opencode-ai/sdk"
import type { BuiltinAgentName, AgentOverrides, AgentPromptMetadata } from "../types"
import type { CategoryConfig, GitMasterConfig } from "../../config/schema"
import type { BrowserAutomationProvider } from "../../config/schema"
import type { AvailableAgent } from "../dynamic-agent-prompt-builder"
import { AGENT_MODEL_REQUIREMENTS, isModelAvailable } from "../../shared"
import { LEGACY_AGENT_ALIAS_TO_CANONICAL } from "../../config/types"
import { buildAgent, isFactory } from "../agent-builder"
import { applyOverrides } from "./agent-overrides"
import { applyEnvironmentContext } from "./environment-context"
import { applyModelResolution, getFirstFallbackModel } from "./model-resolution"
import { log } from "../../shared/logger"

// Reverse map: canonical name -> list of legacy alias keys
// e.g. "multimodal" -> ["vision", "ui"]
const CANONICAL_TO_LEGACY_ALIASES: Record<string, string[]> = {}
for (const [alias, canonical] of Object.entries(LEGACY_AGENT_ALIAS_TO_CANONICAL)) {
  if (!CANONICAL_TO_LEGACY_ALIASES[canonical]) CANONICAL_TO_LEGACY_ALIASES[canonical] = []
  CANONICAL_TO_LEGACY_ALIASES[canonical].push(alias)
}

export function collectPendingBuiltinAgents(input: {
  agentSources: Record<BuiltinAgentName, import("../agent-builder").AgentSource>
  agentMetadata: Partial<Record<BuiltinAgentName, AgentPromptMetadata>>
  disabledAgents: string[]
  agentOverrides: AgentOverrides
  directory?: string
  systemDefaultModel?: string
  mergedCategories: Record<string, CategoryConfig>
  gitMasterConfig?: GitMasterConfig
  browserProvider?: BrowserAutomationProvider
  uiSelectedModel?: string
  availableModels: Set<string>
  isFirstRunNoCache: boolean
  disabledSkills?: Set<string>
  useTaskSystem?: boolean
  disableOmoEnv?: boolean
}): { pendingAgentConfigs: Map<string, AgentConfig>; availableAgents: AvailableAgent[] } {
  const {
    agentSources,
    agentMetadata,
    disabledAgents,
    agentOverrides,
    directory,
    systemDefaultModel,
    mergedCategories,
    gitMasterConfig,
    browserProvider,
    uiSelectedModel,
    availableModels,
    disabledSkills,
    disableOmoEnv = false,
  } = input

  const availableAgents: AvailableAgent[] = []
  const pendingAgentConfigs: Map<string, AgentConfig> = new Map()

  for (const [name, source] of Object.entries(agentSources)) {
    const agentName = name as BuiltinAgentName

    if (agentName === "bob") continue
    if (agentName === "coder") continue
    if (agentName === "manager") continue
    if (agentName === "sub") continue
    if (disabledAgents.some((name) => name.toLowerCase() === agentName.toLowerCase())) continue

    // Check override by canonical name, then by legacy alias keys
    let override = agentOverrides[agentName]
    if (!override) {
      const legacyKeys = CANONICAL_TO_LEGACY_ALIASES[agentName]
      if (legacyKeys) {
        for (const key of legacyKeys) {
          const legacyOverride = (agentOverrides as Record<string, unknown>)[key]
          if (legacyOverride) {
            override = legacyOverride as unknown as typeof override
            break
          }
        }
      }
    }

    // Check requirement by canonical name, then by legacy alias keys
    let requirement = AGENT_MODEL_REQUIREMENTS[agentName] ?? undefined
    if (!requirement) {
      const legacyReqKeys = CANONICAL_TO_LEGACY_ALIASES[agentName]
      if (legacyReqKeys) {
        for (const key of legacyReqKeys) {
          const legacyReq = AGENT_MODEL_REQUIREMENTS[key]
          if (legacyReq) {
            requirement = legacyReq
            break
          }
        }
      }
    }

    // Check if agent requires a specific model
    if (requirement?.requiresModel && availableModels) {
      if (!isModelAvailable(requirement.requiresModel, availableModels)) {
        continue
      }
    }

    const isPrimaryAgent = isFactory(source) && source.mode === "primary"

    let resolution = applyModelResolution({
      uiSelectedModel: (isPrimaryAgent && override?.model === undefined) ? uiSelectedModel : undefined,
      userModel: override?.model,
      requirement,
      availableModels,
      systemDefaultModel,
    })
    if (!resolution) {
      if (override?.model) {
        // User explicitly configured a model but resolution failed (e.g., cold cache).
        // Honor the user's choice directly instead of falling back to hardcoded chain.
        log("[agent-registration] User-configured model not resolved, using as-is", {
          agent: agentName,
          configuredModel: override.model,
        })
        resolution = { model: override.model, provenance: "override" as const }
      } else {
        resolution = getFirstFallbackModel(requirement)
      }
    }
    if (!resolution) {
      // If no model resolved but systemDefaultModel exists, use it as ultimate fallback
      // instead of silently dropping the agent from the registry.
      if (systemDefaultModel) {
        resolution = { model: systemDefaultModel, provenance: "system-default" as const }
        log("[agent-registration] No model resolved, falling back to system default", {
          agent: agentName,
          systemDefault: systemDefaultModel,
        })
      } else {
        log("[agent-registration] Skipping agent — no model available and no system default", {
          agent: agentName,
        })
        continue
      }
    }
    const { model, variant: resolvedVariant } = resolution

    let config = buildAgent(source, model, mergedCategories, gitMasterConfig, browserProvider, disabledSkills)

    // Apply resolved variant from model fallback chain
    if (resolvedVariant) {
      config = { ...config, variant: resolvedVariant }
    }

    if (agentName === "researcher") {
      config = applyEnvironmentContext(config, directory, { disableOmoEnv })
    }

    config = applyOverrides(config, override, mergedCategories, directory)

    // Store for later - will be added after bob and coder
    pendingAgentConfigs.set(name, config)

    const metadata = agentMetadata[agentName]
    if (metadata) {
      availableAgents.push({
        name: agentName,
        description: config.description ?? "",
        metadata,
      })
    }
  }

  return { pendingAgentConfigs, availableAgents }
}
