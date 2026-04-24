import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentOverrides } from "../types"
import type { CategoryConfig } from "../../config/schema"
import type { AvailableAgent, AvailableCategory, AvailableSkill } from "../dynamic-agent-prompt-builder"
import { AGENT_MODEL_REQUIREMENTS, isAnyProviderConnected } from "../../shared"
import { createCoderAgent } from "../coder"
import { applyEnvironmentContext } from "./environment-context"
import { applyCategoryOverride, mergeAgentConfig } from "./agent-overrides"
import { applyModelResolution, getFirstFallbackModel } from "./model-resolution"
import { getGptApplyPatchPermission } from "../gpt-apply-patch-guard"

export function maybeCreateCoderConfig(input: {
  disabledAgents: string[]
  agentOverrides: AgentOverrides
  availableModels: Set<string>
  systemDefaultModel?: string
  isFirstRunNoCache: boolean
  availableAgents: AvailableAgent[]
  availableSkills: AvailableSkill[]
  availableCategories: AvailableCategory[]
  mergedCategories: Record<string, CategoryConfig>
  directory?: string
  useTaskSystem: boolean
  disableOmoEnv?: boolean
}): AgentConfig | undefined {
  const {
    disabledAgents,
    agentOverrides,
    availableModels,
    systemDefaultModel,
    isFirstRunNoCache,
    availableAgents,
    availableSkills,
    availableCategories,
    mergedCategories,
    directory,
    useTaskSystem,
    disableOmoEnv = false,
  } = input

  if (disabledAgents.includes("coder")) return undefined

  const coderOverride = agentOverrides["coder"]
  const coderRequirement = AGENT_MODEL_REQUIREMENTS["coder"]
  const hasCoderExplicitConfig = coderOverride !== undefined

  const hasRequiredProvider =
    !coderRequirement?.requiresProvider ||
    hasCoderExplicitConfig ||
    isFirstRunNoCache ||
    isAnyProviderConnected(coderRequirement.requiresProvider, availableModels)

  if (!hasRequiredProvider) return undefined

  let coderResolution = applyModelResolution({
    userModel: coderOverride?.model,
    requirement: coderRequirement,
    availableModels,
    systemDefaultModel,
  })

  if (isFirstRunNoCache && !coderOverride?.model) {
    coderResolution = getFirstFallbackModel(coderRequirement)
  }

  if (!coderResolution) return undefined
  const { model: coderModel, variant: coderResolvedVariant } = coderResolution

  let coderConfig = createCoderAgent(
    coderModel,
    availableAgents,
    undefined,
    availableSkills,
    availableCategories,
    useTaskSystem
  )

  coderConfig = { ...coderConfig, variant: coderResolvedVariant ?? "medium" }

  const hepOverrideCategory = (coderOverride as Record<string, unknown> | undefined)?.category as string | undefined
  if (hepOverrideCategory) {
    coderConfig = applyCategoryOverride(coderConfig, hepOverrideCategory, mergedCategories)
  }

  coderConfig = applyEnvironmentContext(coderConfig, directory, { disableOmoEnv })

  if (coderOverride) {
    coderConfig = mergeAgentConfig(coderConfig, coderOverride, directory)
  }

  const resolvedModel = coderConfig.model ?? ""
  const gptDeny = getGptApplyPatchPermission(resolvedModel)
  if (Object.keys(gptDeny).length > 0 && coderConfig.permission) {
    Object.assign(coderConfig.permission, gptDeny)
  }

  return coderConfig
}
