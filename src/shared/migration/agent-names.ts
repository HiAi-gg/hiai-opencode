export const AGENT_NAME_MAP: Record<string, string> = {
  // Bob variants (subsumes General, Zoe, Build)
  omo: "bob",
  bob: "bob",
  "bob (ultraworker)": "bob",
  "bob - ultraworker": "bob",
  general: "bob",
  zoe: "bob",
  build: "bob",

  // Coder variants
  coder: "coder",
  "coder (deep agent)": "coder",
  "coder - deep agent": "coder",

  // Strategist variants (subsumes pre-plan/logician/athena)
  "omo-plan": "strategist",
  "planner-bob": "strategist",
  strategist: "strategist",
  "strategist - plan builder": "strategist",
  "strategist (plan builder)": "strategist",
  "pre-plan": "strategist",
  "plan-consultant": "strategist",
  "pre-plan - plan consultant": "strategist",
  "pre-plan (plan consultant)": "strategist",
  logician: "strategist",
  athena: "strategist",
  "athena-junior": "strategist",

  // Critic remains explicit and canonical
  critic: "critic",
  "critic - plan critic": "critic",
  "critic (plan critic)": "critic",
  "quality-guardian": "critic",
  "quality guardian - verifier": "critic",
  "code-reviewer": "critic",
  "systematic-debugger": "critic",

  // Guard variants
  "orchestrator-bob": "guard",
  guard: "guard",
  "guard (plan executor)": "guard",
  "guard - plan executor": "guard",

  // Researcher variants (subsumes Librarian, Explore)
  librarian: "researcher",
  explore: "researcher",
  researcher: "researcher",
  "researcher - codebase explorer": "researcher",

  // Platform Manager variants (subsumes Ledger, Bootstrapper, Initializer, Mindmodel)
  "ledger-creator": "platform-manager",
  "bootstrapper": "platform-manager",
  "project-initializer": "platform-manager",
  "mindmodel": "platform-manager",
  "platform-manager": "platform-manager",
  manager: "platform-manager",
  "platform manager - utility": "platform-manager",

  // SubAgent
  subagent: "coder",
  sub: "coder",

  // Designer
  designer: "designer",

  // Multimodal (runtime key remains "ui" for compatibility)
  ui: "ui",
  vision: "ui",
  multimodal: "ui",
}

export const BUILTIN_AGENT_NAMES = new Set([
  "bob",
  "coder",
  "strategist",
  "critic",
  "designer",
  "researcher",
  "ui",
  "platform-manager",
  "guard",
])

export function migrateAgentNames(
  agents: Record<string, unknown>
): { migrated: Record<string, unknown>; changed: boolean } {
  const migrated: Record<string, unknown> = {}
  let changed = false

  for (const [key, value] of Object.entries(agents)) {
    const newKey = AGENT_NAME_MAP[key.toLowerCase()] ?? AGENT_NAME_MAP[key] ?? key
    if (newKey !== key) {
      changed = true
    }
    migrated[newKey] = value
  }

  return { migrated, changed }
}
