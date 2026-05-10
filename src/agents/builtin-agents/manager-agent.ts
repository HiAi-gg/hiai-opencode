import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentOverrides } from "../types"
import type { CategoriesConfig, CategoryConfig } from "../../config/schema"
import type { AvailableAgent, AvailableSkill } from "../dynamic-agent-prompt-builder"
import { AGENT_MODEL_REQUIREMENTS } from "../../shared"
import { applyOverrides } from "./agent-overrides"
import { applyModelResolution } from "./model-resolution"
import { createManagerAgent } from "../manager"

export function maybeCreateManagerConfig(input: {
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

  if (disabledAgents.includes("manager")) return undefined

  const orchestratorOverride = agentOverrides["manager"]
  const managerRequirement = AGENT_MODEL_REQUIREMENTS["manager"]

  const managerResolution = applyModelResolution({
    uiSelectedModel: orchestratorOverride?.model !== undefined ? undefined : uiSelectedModel,
    userModel: orchestratorOverride?.model,
    requirement: managerRequirement,
    availableModels,
    systemDefaultModel,
  })

  if (!managerResolution) return undefined
  const { model: managerModel, variant: managerResolvedVariant } = managerResolution

  let orchestratorConfig = createManagerAgent({
    model: managerModel,
    availableAgents,
    availableSkills,
    userCategories,
  })

  if (managerResolvedVariant) {
    orchestratorConfig = { ...orchestratorConfig, variant: managerResolvedVariant }
  }

  orchestratorConfig = applyOverrides(orchestratorConfig, orchestratorOverride, mergedCategories, directory)

  return orchestratorConfig
}
