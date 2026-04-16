import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentOverrides } from "../types"
import type { CategoriesConfig, CategoryConfig } from "../../config/schema"
import type { AvailableAgent, AvailableCategory, AvailableSkill } from "../dynamic-agent-prompt-builder"
import { AGENT_MODEL_REQUIREMENTS, isAnyFallbackModelAvailable } from "../../shared"
import { applyEnvironmentContext } from "./environment-context"
import { applyOverrides } from "./agent-overrides"
import { applyModelResolution, getFirstFallbackModel } from "./model-resolution"
import { createBobAgent } from "../bob"
import { getGptApplyPatchPermission } from "../gpt-apply-patch-guard"

export function maybeCreateBobConfig(input: {
  disabledAgents: string[]
  agentOverrides: AgentOverrides
  uiSelectedModel?: string
  availableModels: Set<string>
  systemDefaultModel?: string
  isFirstRunNoCache: boolean
  availableAgents: AvailableAgent[]
  availableSkills: AvailableSkill[]
  availableCategories: AvailableCategory[]
  mergedCategories: Record<string, CategoryConfig>
  directory?: string
  userCategories?: CategoriesConfig
  useTaskSystem: boolean
  disableOmoEnv?: boolean
}): AgentConfig | undefined {
  const {
    disabledAgents,
    agentOverrides,
    uiSelectedModel,
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

  const bobOverride = agentOverrides["bob"]
  const bobRequirement = AGENT_MODEL_REQUIREMENTS["bob"]
  const hasBobExplicitConfig = bobOverride !== undefined
  const meetsBobAnyModelRequirement =
    !bobRequirement?.requiresAnyModel ||
    hasBobExplicitConfig ||
    isFirstRunNoCache ||
    isAnyFallbackModelAvailable(bobRequirement.fallbackChain, availableModels)

  if (disabledAgents.includes("bob") || !meetsBobAnyModelRequirement) return undefined

  let bobResolution = applyModelResolution({
    uiSelectedModel: bobOverride?.model !== undefined ? undefined : uiSelectedModel,
    userModel: bobOverride?.model,
    requirement: bobRequirement,
    availableModels,
    systemDefaultModel,
  })

  if (isFirstRunNoCache && !bobOverride?.model && !uiSelectedModel) {
    bobResolution = getFirstFallbackModel(bobRequirement)
  }

  if (!bobResolution) return undefined
  const { model: bobModel, variant: bobResolvedVariant } = bobResolution

  let bobConfig = createBobAgent(
    bobModel,
    availableAgents,
    undefined,
    availableSkills,
    availableCategories,
    useTaskSystem
  )

  if (bobResolvedVariant) {
    bobConfig = { ...bobConfig, variant: bobResolvedVariant }
  }

  bobConfig = applyOverrides(bobConfig, bobOverride, mergedCategories, directory)

  const resolvedModel = bobConfig.model ?? ""
  const gptDeny = getGptApplyPatchPermission(resolvedModel)
  if (Object.keys(gptDeny).length > 0 && bobConfig.permission) {
    Object.assign(bobConfig.permission, gptDeny)
  }

  bobConfig = applyEnvironmentContext(bobConfig, directory, {
    disableOmoEnv,
  })

  return bobConfig
}
