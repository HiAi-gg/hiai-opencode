export const AGENT_NAME_MAP: Record<string, string> = {
  // Bob variants → "bob"
  omo: "bob",
  OmO: "bob",
  Bob: "bob",
  "Bob (Ultraworker)": "bob",
  bob: "bob",

  // Coder variants → "coder"
  "Coder (Deep Agent)": "coder",

  // Strategist variants → "strategist"
  "OmO-Plan": "strategist",
  "omo-plan": "strategist",
  "Planner-Bob": "strategist",
  "planner-bob": "strategist",
  "Strategist - Plan Builder": "strategist",
  "Strategist (Plan Builder)": "strategist",
  strategist: "strategist",

  // Guard variants → "guard"
  "orchestrator-bob": "guard",
  Guard: "guard",
  "Guard (Plan Executor)": "guard",
  guard: "guard",

  // Pre-Plan variants → "pre-plan"
  "plan-consultant": "pre-plan",
  "Pre-Plan - Plan Consultant": "pre-plan",
  "Pre-Plan (Plan Consultant)": "pre-plan",
  "pre-plan": "pre-plan",

  // Critic variants → "critic"
  "Critic - Plan Critic": "critic",
  "Critic (Plan Critic)": "critic",
  critic: "critic",

  // SubAgent → "sub"
  "SubAgent": "sub",
  "sub": "sub",

  // Already lowercase - passthrough
  build: "build",
  logician: "logician",
  librarian: "librarian",
  explore: "explore",
  "ui": "ui",
}

export const BUILTIN_AGENT_NAMES = new Set([
  "bob", 
  "logician",
  "librarian",
  "explore",
  "ui",
  "pre-plan", 
  "critic", 
  "strategist", 
  "guard", 
  "build",
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
