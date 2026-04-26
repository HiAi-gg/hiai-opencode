import type { AgentConfig } from "@opencode-ai/sdk"
import type { BuiltinAgentName, AgentOverrides, AgentFactory, AgentPromptMetadata } from "./types"
import type { CategoriesConfig, GitMasterConfig } from "../config/schema"
import type { LoadedSkill } from "../features/opencode-skill-loader/types"
import type { BrowserAutomationProvider } from "../config/schema"
import { createBobAgent } from "./bob"
import { createDesignerAgent, designerPromptMetadata } from "./designer"
import { createAgentSkillsAgent, agentSkillsPromptMetadata } from "./agent-skills"
import { createCriticAgent, criticPromptMetadata } from "./critic/agent"
import { createMultimodalLookerAgent, MULTIMODAL_LOOKER_PROMPT_METADATA } from "./ui"
import { createGuardAgent, guardPromptMetadata } from "./guard"
import { createCoderAgent } from "./coder"
import { createPlatformManagerAgent, platformManagerPromptMetadata } from "./platform-manager"
import { createQualityGuardianAgent, qualityGuardianPromptMetadata } from "./quality-guardian"
import { createResearcherAgent, researcherPromptMetadata } from "./researcher"
import { createBrainstormerAgent, brainstormerPromptMetadata } from "./brainstormer"
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
import { CLOSURE_SCHEMA_PROMPT } from "../shared/closure-protocol"

type AgentSource = AgentFactory | AgentConfig

const agentSources: Record<BuiltinAgentName, AgentSource> = {
  "bob": createBobAgent,
  "coder": createCoderAgent,
  "strategist": createBobAgent, // Strategist runtime config is assembled in agent-config-handler.
  "designer": createDesignerAgent,
  "multimodal": createMultimodalLookerAgent,
  "brainstormer": createBrainstormerAgent,
  "agent-skills": createAgentSkillsAgent,
  "critic": createCriticAgent,
  "platform-manager": createPlatformManagerAgent,
  "quality-guardian": createQualityGuardianAgent,
  "researcher": createResearcherAgent,
  "guard": createGuardAgent as AgentFactory,
  "sub": createBobJuniorAgentWithOverrides as unknown as AgentFactory,
}

/**
 * Metadata for each agent, used to build Bob's dynamic prompt sections
 * (Delegation Table, Tool Selection, Key Triggers, etc.)
 */
const agentMetadata: Partial<Record<BuiltinAgentName, AgentPromptMetadata>> = {
  "researcher": researcherPromptMetadata,
  "multimodal": MULTIMODAL_LOOKER_PROMPT_METADATA,
  "guard": guardPromptMetadata,
  "critic": criticPromptMetadata,
  "quality-guardian": qualityGuardianPromptMetadata,
  "platform-manager": platformManagerPromptMetadata,
  "brainstormer": brainstormerPromptMetadata,
  "strategist": {
    category: "advisor",
    cost: "EXPENSIVE",
    promptAlias: "Strategist",
    keyTrigger: "Architecture, multi-step planning, ambiguous scope, or high-risk sequencing → consult strategist first.",
    triggers: [
      {
        domain: "Architecture planning",
        trigger: "Need system design, tradeoff analysis, migration plan, or implementation sequence",
      },
      {
        domain: "Ambiguous scope",
        trigger: "Task has unclear requirements, multiple phases, or needs decomposition before coding",
      },
    ],
    useWhen: [
      "Architecture decisions or cross-cutting changes",
      "Multi-step implementation plans before Coder work",
      "Ambiguous tasks where choosing the wrong approach is expensive",
    ],
    avoidWhen: [
      "Single-file obvious fixes",
      "Pure copywriting or visual exploration",
      "Review-only tasks where Critic is the right gate",
    ],
  },
  "designer": {
    category: "specialist",
    cost: "EXPENSIVE",
    promptAlias: "Designer",
    keyTrigger: "Visual direction, product UI feel, layout, branding, or design-system work → use designer/visual-engineering.",
    triggers: [
      {
        domain: "Visual direction",
        trigger: "Need UI concept, art direction, layout, branding, or design-system guidance",
      },
      {
        domain: "Frontend aesthetics",
        trigger: "Need polished interface design beyond functional implementation",
      },
    ],
    useWhen: [
      "Defining visual direction, layout, interaction feel, or design-system choices",
      "Reviewing UI for taste, hierarchy, and visual coherence",
    ],
    avoidWhen: [
      "Website copy or wording only (use Brainstormer/Writer)",
      "Backend or infrastructure implementation",
      "Pure file/media extraction (use Vision)",
    ],
  },
  "agent-skills": agentSkillsPromptMetadata,
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
  const runtimeDisabledAgents = Array.from(
    new Set<string>(disabledAgents),
  )

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
    disabledAgents: runtimeDisabledAgents,
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
    disabledAgents: runtimeDisabledAgents,
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
    disabledAgents: runtimeDisabledAgents,
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
    disabledAgents: runtimeDisabledAgents,
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

  // Mandatory Closure Protocol Injection
  // All agents must end their output with <CLOSURE> block for task finalization.
  for (const name in result) {
    const agent = result[name]
    if (agent && agent.prompt) {
      agent.prompt = agent.prompt + "\n\n" + CLOSURE_SCHEMA_PROMPT
    }
  }

  return result
}
