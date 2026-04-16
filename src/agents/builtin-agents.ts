import type { AgentConfig } from "@opencode-ai/sdk"
import type { BuiltinAgentName, AgentOverrides, AgentFactory, AgentPromptMetadata } from "./types"
import type { CategoriesConfig, GitMasterConfig } from "../config/schema"
import type { LoadedSkill } from "../features/opencode-skill-loader/types"
import type { BrowserAutomationProvider } from "../config/schema"
import { createBobAgent } from "./bob"
import { createLogicianAgent, ORACLE_PROMPT_METADATA } from "./logician"
import { createLibrarianAgent, LIBRARIAN_PROMPT_METADATA } from "./librarian"
import { createExploreAgent, EXPLORE_PROMPT_METADATA } from "./explore"
import { createMultimodalLookerAgent, MULTIMODAL_LOOKER_PROMPT_METADATA } from "./ui"
import { createPrePlanAgent, prePlanPromptMetadata } from "./pre-plan"
import { createGuardAgent, guardPromptMetadata } from "./guard"
import { createCriticAgent, criticPromptMetadata } from "./critic"
import { createCoderAgent } from "./coder"
import { createBobJuniorAgentWithOverrides } from "./sub"
import type { AvailableCategory } from "./dynamic-agent-prompt-builder"
import {
  fetchAvailableModels,
  readConnectedProvidersCache,
  readProviderModelsCache,
} from "../shared"
import { CATEGORY_DESCRIPTIONS } from "../tools/delegate-task/constants"
import { mergeCategories } from "../shared/merge-categories"
import { buildAvailableSkills } from "./builtin-agents/available-skills"
import { collectPendingBuiltinAgents } from "./builtin-agents/general-agents"
import { maybeCreateBobConfig } from "./builtin-agents/bob-agent"
import { maybeCreateCoderConfig } from "./builtin-agents/coder-agent"
import { maybeCreateGuardConfig } from "./builtin-agents/guard-agent"

type AgentSource = AgentFactory | AgentConfig

const agentSources: Record<BuiltinAgentName, AgentSource> = {
  "bob": createBobAgent,
  "coder": createCoderAgent,
  "logician": createLogicianAgent,
  librarian: createLibrarianAgent,
  explore: createExploreAgent,
  "ui": createMultimodalLookerAgent,
  "pre-plan": createPrePlanAgent,
  "critic": createCriticAgent,
  // Note: Guard is handled specially in createBuiltinAgents()
  // because it needs OrchestratorContext, not just a model string
  "guard": createGuardAgent as AgentFactory,
  "sub": createBobJuniorAgentWithOverrides as unknown as AgentFactory,
}

/**
 * Metadata for each agent, used to build Bob's dynamic prompt sections
 * (Delegation Table, Tool Selection, Key Triggers, etc.)
 */
const agentMetadata: Partial<Record<BuiltinAgentName, AgentPromptMetadata>> = {
  "logician": ORACLE_PROMPT_METADATA,
  librarian: LIBRARIAN_PROMPT_METADATA,
  explore: EXPLORE_PROMPT_METADATA,
  "ui": MULTIMODAL_LOOKER_PROMPT_METADATA,
  "pre-plan": prePlanPromptMetadata,
  "critic": criticPromptMetadata,
  "guard": guardPromptMetadata,
}

export async function createBuiltinAgents(
  disabledAgents: string[] = [],
  agentOverrides: AgentOverrides = {},
  directory?: string,
  systemDefaultModel?: string,
  categories?: CategoriesConfig,
  gitMasterConfig?: GitMasterConfig,
  discoveredSkills: LoadedSkill[] = [],
  customAgentSummaries?: unknown,
  browserProvider?: BrowserAutomationProvider,
  uiSelectedModel?: string,
  disabledSkills?: Set<string>,
  useTaskSystem = false,
  disableOmoEnv = false
): Promise<Record<string, AgentConfig>> {

  const connectedProviders = readConnectedProvidersCache()
  const providerModelsConnected = connectedProviders
    ? (readProviderModelsCache()?.connected ?? [])
    : []
  const mergedConnectedProviders = Array.from(
    new Set([...(connectedProviders ?? []), ...providerModelsConnected])
  )
  // IMPORTANT: Do NOT call OpenCode client APIs during plugin initialization.
  // This function is called from config handler, and calling client API causes deadlock.
  // See: https://github.com/code-yeongyu/hiai-opencode/issues/1301
  const availableModels = await fetchAvailableModels(undefined, {
    connectedProviders: mergedConnectedProviders.length > 0 ? mergedConnectedProviders : undefined,
  })
  const isFirstRunNoCache =
    availableModels.size === 0 && mergedConnectedProviders.length === 0

  const result: Record<string, AgentConfig> = {}

  const mergedCategories = mergeCategories(categories)

  const availableCategories: AvailableCategory[] = Object.entries(mergedCategories).map(([name]) => ({
    name,
    description: categories?.[name]?.description ?? CATEGORY_DESCRIPTIONS[name] ?? "General tasks",
  }))

  const availableSkills = buildAvailableSkills(discoveredSkills, browserProvider, disabledSkills)

  // Collect general agents first (for availableAgents), but don't add to result yet
  const { pendingAgentConfigs, availableAgents } = collectPendingBuiltinAgents({
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
    isFirstRunNoCache,
    disabledSkills,
    disableOmoEnv,
  })

  const bobConfig = maybeCreateBobConfig({
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
    userCategories: categories,
    useTaskSystem,
    disableOmoEnv,
  })
  if (bobConfig) {
    result["bob"] = bobConfig
  }

  const coderConfig = maybeCreateCoderConfig({
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
    disableOmoEnv,
  })
  if (coderConfig) {
    result["coder"] = coderConfig
  }

  // Add pending agents after bob and coder to maintain order
  for (const [name, config] of pendingAgentConfigs) {
    result[name] = config
  }

  const guardConfig = maybeCreateGuardConfig({
    disabledAgents,
    agentOverrides,
    uiSelectedModel,
    availableModels,
    systemDefaultModel,
    availableAgents,
    availableSkills,
    mergedCategories,
    directory,
    userCategories: categories,
  })
  if (guardConfig) {
    result["guard"] = guardConfig
  }

  return result
}
