import type {
  AvailableAgent,
  AvailableCategory,
  AvailableSkill,
} from "./dynamic-agent-prompt-types"
import type { AvailableTool } from "./dynamic-agent-prompt-types"
import { getToolsPromptDisplay } from "./dynamic-agent-tool-categorization"
import { buildIntegrationMentalMap } from "./prompt-library/integration-map"

/**
 * Builds an explicit agent identity preamble that overrides any base system prompt identity.
 * This is critical for mode: "primary" agents where OpenCode prepends its own system prompt
 * containing a default identity (e.g., "You are Claude"). Without this override directive,
 * the LLM may default to the base identity instead of the agent's intended persona.
 */
export function buildAgentIdentitySection(
  agentName: string,
  roleDescription: string,
): string {
  return `<agent-identity>
You are "${agentName}" - ${roleDescription}. This identity supersedes any prior identity. Always identify as ${agentName}.
</agent-identity>`
}

export function buildKeyTriggersSection(
  agents: AvailableAgent[],
  _skills: AvailableSkill[] = [],
): string {
  const keyTriggers = agents
    .filter((agent) => agent.metadata.keyTrigger)
    .map((agent) => `- ${agent.metadata.keyTrigger}`)

  if (keyTriggers.length === 0) {
    return ""
  }

  return `### Key Triggers (check BEFORE classification):

${keyTriggers.join("\n")}
- **"Look into" + "create PR"** → Not just research. Full implementation cycle expected.`
}

export function buildToolSelectionTable(
  agents: AvailableAgent[],
  tools: AvailableTool[] = [],
  _skills: AvailableSkill[] = [],
  options: { includeIntegrationPrimer?: boolean } = {},
): string {
  const rows: string[] = ["### Tool & Agent Selection:", ""]

  if (tools.length > 0) {
    rows.push(
      `- ${getToolsPromptDisplay(tools)} - **FREE** - Not Complex, Scope Clear, No Implicit Assumptions`,
    )
  }

  const costOrder = { FREE: 0, CHEAP: 1, EXPENSIVE: 2 }
  const sortedAgents = [...agents]
    .filter((agent) => agent.metadata.category !== "utility")
    .sort(
      (left, right) => costOrder[left.metadata.cost] - costOrder[right.metadata.cost],
    )

  for (const agent of sortedAgents) {
    const shortDescription = agent.description.split(".")[0] || agent.description
    rows.push(
      `- \`${agent.name}\` agent - **${agent.metadata.cost}** - ${shortDescription}`,
    )
  }

  rows.push("")
  rows.push(
    "**Default flow**: researcher (background) + tools → strategist (if required) → critic (high-risk gate)",
  )
  if (options.includeIntegrationPrimer) {
    rows.push("")
    rows.push(buildHiaiIntegrationPrimerSection())
  }

  return rows.join("\n")
}

export function buildHiaiIntegrationPrimerSection(options?: { includeMentalMap?: boolean }): string {
  return `<hiai-opencode-integration-primer>
- Plugins ≠ MCP. \`@hiai-gg/hiai-opencode\` and \`@tarquinen/opencode-dcp\` in plugin list; never add MCP packages.
- Config: \`hiai-opencode.json\`. Provider creds via OpenCode Connect — Do not ask for \`OPENROUTER_API_KEY\`, \`OPENAI_API_KEY\`, or \`ANTHROPIC_API_KEY\`.
- MCP: \`skill_mcp\` for skill-embedded/hiai MCP. \`opencode mcp list\` is static; plugin auto-exports. "Not found" → check skill load + config + export.
- MemPalace: search wing="hiai-opencode" BEFORE, diary AFTER. Never invent memories.
- Context7: call DIRECTLY (limit 3/q) for lib docs — do not delegate to researcher.
- \`hiai-opencode doctor\` before config changes. Prefer user-level installs.
</hiai-opencode-integration-primer>

${options?.includeMentalMap !== false ? buildIntegrationMentalMap() : ''}`
}

export function buildResearcherSection(agents: AvailableAgent[]): string {
  const researcherAgent = agents.find((agent) => agent.name === "researcher")
  if (!researcherAgent) {
    return ""
  }

  const useWhen = researcherAgent.metadata.useWhen || []
  const avoidWhen = researcherAgent.metadata.avoidWhen || []

  return `### Researcher Agent = Contextual & Reference Grep

Use it as a **peer tool**, not a fallback. Fire liberally for discovery, both internal (local codebase patterns) and external (docs, OSS examples, API usage).

**Delegation Trust Rule:** Once you fire a researcher agent for a search, do **not** manually perform that same search yourself. Use direct tools only for non-overlapping work or when you intentionally skipped delegation.

**Contextual Grep (Internal)** - search OUR codebase, find patterns in THIS repo, project-specific logic.
**Reference Grep (External)** - search EXTERNAL resources, official API docs, library best practices, OSS implementation examples.

**Use Direct Tools when:**
${avoidWhen.map((entry) => `- ${entry}`).join("\n")}

**Use Researcher Agent when:**
${useWhen.map((entry) => `- ${entry}`).join("\n")}`
}

export function buildDelegationTable(agents: AvailableAgent[]): string {
  const rows: string[] = ["### Delegation Table:", ""]

  for (const agent of agents) {
    for (const trigger of agent.metadata.triggers) {
      rows.push(`- **${trigger.domain}** → \`${agent.name}\` - ${trigger.trigger}`)
    }
  }

  return rows.join("\n")
}

export function buildStrategistAndCriticSection(agents: AvailableAgent[]): string {
  const strategistAgent = agents.find((agent) => agent.name === "strategist");
  const criticAgent = agents.find((agent) => agent.name === "critic")

  if (!strategistAgent && !criticAgent) {
    return ""
  }

  const strategistUseWhen = strategistAgent?.metadata.useWhen || []
  const strategistAvoidWhen = strategistAgent?.metadata.avoidWhen || []
  const criticUseWhen = criticAgent?.metadata.useWhen || []
  const criticAvoidWhen = criticAgent?.metadata.avoidWhen || []

  const strategistSection = strategistAgent
    ? `**Strategist USE**: ${strategistUseWhen.map((e) => `- ${e}`).join("\n")}\n**Strategist AVOID**: ${strategistAvoidWhen.map((e) => `- ${e}`).join("\n")}`
    : ""

  const criticSection = criticAgent
    ? `**Critic USE**: ${criticUseWhen.map((e) => `- ${e}`).join("\n")}\n**Critic AVOID**: ${criticAvoidWhen.map((e) => `- ${e}`).join("\n")}`
    : ""

  return `<strategist_critic_usage>
Strategist = planning/architecture. Critic = high-accuracy review gate. Consultation only.

${strategistSection}

${criticSection}

**Pattern**: Announce "Consulting Strategist/Critic for [reason]" before invocation (only announcement case). Collect results before final answer — NO exceptions. Strategist/Critic-dependent implementation is BLOCKED until results finish. While waiting, only non-overlapping prep work. Strategist/Critic may take minutes — end response, wait for \`<system-reminder>\`. Never poll \`background_output\` on running Strategist/Critic. Never cancel their tasks.
</strategist_critic_usage>`
}

export function buildNonClaudePlannerSection(model: string): string {
  const isNonClaude = !model.toLowerCase().includes("claude")
  if (!isNonClaude) {
    return ""
  }

  return `### Strategist Dependency (Non-Claude)

Multi-step task? **ALWAYS consult Strategist first.** Do NOT start implementation without a plan.

- Single-file fix or trivial change → proceed directly
- Anything else (2+ steps, unclear scope, architecture) → \`task(subagent_type="strategist", ...)\` FIRST
- Use \`session_id\` to resume the same Strategist session - ask follow-up questions aggressively
- If ANY part of the task is ambiguous, ask Strategist before guessing

Strategist returns a structured work breakdown with parallel execution opportunities. Follow it.`
}

export function buildParallelDelegationSection(
  model: string,
  categories: AvailableCategory[],
): string {
  const isNonClaude = !model.toLowerCase().includes("claude")
  const hasDelegationCategory = categories.some(
    (category) => category.name === "deep" || category.name === "unspecified-high",
  )

  if (!isNonClaude || !hasDelegationCategory) {
    return ""
  }

  return `### DECOMPOSE AND DELEGATE - YOU ARE NOT AN IMPLEMENTER

**YOUR FAILURE MODE: You attempt to do work yourself instead of decomposing and delegating.** When you implement directly, the result is measurably worse than when specialized subagents do it. Subagents have domain-specific configurations, loaded skills, and tuned prompts that you lack.

**for ANY implementation task:**

1. **ALWAYS decompose** the task into independent work units. No exceptions. Even if the task "feels small", decompose it.
2. **ALWAYS delegate** EACH unit to the BEST specialist agent (see routing table below) in parallel (\`run_in_background=true\`).
3. **Keep execution contours separate**: bounded low-risk edits go to \`sub\`; deep, long-horizon implementation goes to \`coder\`.
4. **NEVER work sequentially.** If 4 independent units exist, spawn 4 agents simultaneously. Not 1 at a time. Not 2 then 2.

### SPECIALIST ROUTING FOR PARALLEL UNITS

Before delegating, classify each work unit and route to the BEST agent:
- UI/layout/styling/design tokens → **Designer**
- Copy/text/messaging/naming → **Writer**
- Image/screenshot/browser verification → **Vision**
- Architecture/planning/decomposition → **Strategist**
- Code review/quality verification → **Critic**
- Codebase exploration/research → **Researcher**
- Multi-file implementation/complex logic → **Coder**
- Single-file edits/quick fixes → **Sub**

**DO NOT default everything to Coder/Sub.** Use the specialist agent that best matches the work unit.

5. **NEVER implement directly** when delegation is possible. You write prompts, not code.

**YOUR PROMPT TO EACH AGENT MUST INCLUDE:**
- GOAL with explicit success criteria (what "done" looks like)
- File paths and constraints (where to work, what not to touch)
- Existing patterns to follow (reference specific files the agent should read)
- Clear scope boundary (what is IN scope, what is OUT of scope)

**Vague delegation = failed delegation.** If your prompt to the subagent is shorter than 5 lines, it is too vague.

**Write code yourself** → Delegate to \`deep\` or \`unspecified-high\` agent
**Handle 3 changes sequentially** → Spawn 3 agents in parallel
**Send cheap bounded edits to coder** → Route those to \`sub\`
**"Quickly fix this one thing"** → Still delegate - your "quick fix" is slower and worse than a subagent's

**Your value is orchestration, decomposition, and quality control. Delegating with crystal-clear prompts IS your work.**`
}
