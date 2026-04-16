import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentOverrides } from "../types"
import type { CategoriesConfig, CategoryConfig } from "../../config/schema"
import type { AvailableAgent, AvailableSkill } from "../dynamic-agent-prompt-builder"
import { AGENT_MODEL_REQUIREMENTS } from "../../shared"
import { applyOverrides } from "./agent-overrides"
import { applyModelResolution } from "./model-resolution"
import { createGuardAgent } from "../guard"

export function maybeCreateGuardConfig(input: {
  disabledAgents: string[]
  agentOverrides: AgentOverrides
  uiSelectedModel?: string
  availableModels: Set<string>
  systemDefaultModel?: string
  availableAgents: AvailableAgent[]
  availableSkills: AvailableSkill[]
  mergedCategories: Record<string, CategoryConfig>
  directory?: string
  userCategories?: CategoriesConfig
  useTaskSystem?: boolean
}): AgentConfig | undefined {
  const {
    disabledAgents,
    agentOverrides,
    uiSelectedModel,
    availableModels,
    systemDefaultModel,
    availableAgents,
    availableSkills,
    mergedCategories,
    directory,
    userCategories,
  } = input

  if (disabledAgents.includes("guard")) return undefined

  const orchestratorOverride = agentOverrides["guard"]
  const guardRequirement = AGENT_MODEL_REQUIREMENTS["guard"]

  const guardResolution = applyModelResolution({
    uiSelectedModel: orchestratorOverride?.model !== undefined ? undefined : uiSelectedModel,
    userModel: orchestratorOverride?.model,
    requirement: guardRequirement,
    availableModels,
    systemDefaultModel,
  })

  if (!guardResolution) return undefined
  const { model: guardModel, variant: guardResolvedVariant } = guardResolution

  let orchestratorConfig = createGuardAgent({
    model: guardModel,
    availableAgents,
    availableSkills,
    userCategories,
  })

  if (guardResolvedVariant) {
    orchestratorConfig = { ...orchestratorConfig, variant: guardResolvedVariant }
  }

  orchestratorConfig = applyOverrides(orchestratorConfig, orchestratorOverride, mergedCategories, directory)

  return orchestratorConfig
}
