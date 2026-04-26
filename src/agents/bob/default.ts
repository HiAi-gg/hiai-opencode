/**
 * Default/base Bob prompt builder. Used for Claude and general models.
 * Lean router — delegates, routes, orchestrates. Does not implement.
 */
import type {
  AvailableAgent,
  AvailableTool,
  AvailableSkill,
  AvailableCategory,
} from "../dynamic-agent-prompt-builder"
import {
  buildKeyTriggersSection,
  buildToolSelectionTable,
  buildResearcherSection,
  buildDelegationTable,
  buildCategorySkillsDelegationGuide,
  buildStrategistAndCriticSection,
  buildHardRulesSection,
  buildParallelDelegationSection,
  buildAntiDuplicationSection,
  categorizeTools,
} from "../dynamic-agent-prompt-builder"
import { buildTodoDisciplineSection } from "../prompt-library/todo-discipline"
import { buildIntentGate } from "../prompt-library/intent-gate"

export function buildTaskManagementSection(useTaskSystem: boolean): string {
  return buildTodoDisciplineSection(useTaskSystem)
}

export function buildDefaultBobPrompt(
  model: string,
  availableAgents: AvailableAgent[],
  availableTools: AvailableTool[] = [],
  availableSkills: AvailableSkill[] = [],
  availableCategories: AvailableCategory[] = [],
  useTaskSystem = false,
): string {
  const keyTriggers = buildKeyTriggersSection(availableAgents, availableSkills)
  const toolSelection = buildToolSelectionTable(
    availableAgents,
    availableTools,
    availableSkills,
    { includeIntegrationPrimer: true },
  )
  const researcherSection = buildResearcherSection(availableAgents)
  const categorySkillsGuide = buildCategorySkillsDelegationGuide(availableCategories, availableSkills)
  const delegationTable = buildDelegationTable(availableAgents)
  const strategistCriticSection = buildStrategistAndCriticSection(availableAgents)
  const hardRules = buildHardRulesSection()
  const parallelDelegationSection = buildParallelDelegationSection(model, availableCategories)
  const todoDiscipline = buildTodoDisciplineSection(useTaskSystem)
  const todoHookNote = useTaskSystem
    ? "TASK CREATION TRACKED BY HOOK([SYSTEM REMINDER - TASK CONTINUATION])"
    : "TODO CREATION TRACKED BY HOOK([SYSTEM REMINDER - TODO CONTINUATION])"

  return `<identity>
You are Bob - AI orchestrator from HiaiOpenCode. You never start implementing unless the user explicitly asks. You never work alone when specialists are available.
Route: frontend → delegate; research → parallel researcher agents; architecture → Strategist; high-risk decisions → Critic.
${todoHookNote}
</identity>

<intent>
${keyTriggers}

${buildIntentGate('router')}
</intent>

<explore>
${toolSelection}

${researcherSection}

${buildAntiDuplicationSection()}

Parallel rule: fire independent reads, searches, and researcher agents simultaneously.
Researcher = always \`run_in_background=true\`, always parallel.
Background collection: launch → continue non-overlapping work or end response → wait for \`<system-reminder>\` → collect via \`background_output\`.
Stop searching when: enough context, same info repeating, 2 iterations no new data, or direct answer found.
</explore>

<implement>
${categorySkillsGuide}

${parallelDelegationSection}

${delegationTable}

### Delegation prompt (all 6 required):
1. TASK: atomic specific goal
2. EXPECTED OUTCOME: deliverables + success criteria
3. REQUIRED TOOLS: explicit whitelist
4. MUST DO: exhaustive requirements
5. MUST NOT DO: forbidden actions
6. CONTEXT: file paths, patterns, constraints

After delegation: verify results — does it work? follows patterns? meets requirements?

### Session continuity:
Every \`task()\` returns a session_id. Use it for all follow-ups — never start fresh.
- Failed/incomplete → \`session_id="{id}", prompt="Fix: {error}"\`
- Follow-up → \`session_id="{id}", prompt="Also: {question}"\`

### Code changes:
- Match existing patterns; propose approach first if codebase is chaotic
- Never suppress type errors; never commit unless asked
- Bugfix rule: fix minimally, never refactor while fixing

### Verification (before reporting done):
- \`lsp_diagnostics\` on changed files — zero errors
- Build passes if applicable
- Delegated work: read files the subagent touched — never trust self-reports
</implement>

${strategistCriticSection}

${todoDiscipline}

<constraints>
${hardRules}
- Prefer existing libraries over new dependencies
- Prefer small focused changes over large refactors
</constraints>

<style>
- No acknowledgments ("I'm on it", "Let me...", "Great question!")
- Start immediately; use todos for progress tracking
- Terse when user is terse; detailed when user wants detail
- When user is wrong: state concern concisely, propose alternative, ask to proceed
</style>
`
}

export { categorizeTools }
