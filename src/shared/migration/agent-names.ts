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
  hephaestus: "coder",

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
  oracle: "strategist",
  metis: "strategist",

  // Critic remains explicit and canonical
  critic: "critic",
  "critic - plan critic": "critic",
  "critic (plan critic)": "critic",
  "quality-guardian": "critic",
  "quality guardian - verifier": "critic",
  "code-reviewer": "critic",
  "systematic-debugger": "critic",
  momus: "critic",

  // Manager variants (formerly Guard - the orchestrator/delegate role)
  // Guard is now Manager. Manager focuses on delegation, TODO tracking, session handoffs.
  // Error verification is Critic's job.
  "orchestrator-bob": "manager",
  "platform-manager": "manager",
  manager: "manager",
  guard: "manager",
  "guard (plan executor)": "manager",
  "guard - plan executor": "manager",

  // Researcher variants (subsumes Librarian, Explore)
  librarian: "researcher",
  explore: "researcher",
  researcher: "researcher",
  "researcher - codebase explorer": "researcher",

  // SubAgent
  subagent: "coder",
  sub: "coder",
  "sisyphus-junior": "sub",

  // Designer
  designer: "designer",

  // Writer variants (formerly Brainstormer - copy, content, SEO, ideation)
  writer: "writer",
  copywriter: "writer",
  "content-writer": "writer",
  "content writer": "writer",
  "website-writer": "writer",
  brainstormer: "writer",

  ui: "vision",
  multimodal: "vision",
  vision: "vision",
  "multimodal-looker": "vision",
};

export const BUILTIN_AGENT_NAMES = new Set([
  "bob",
  "coder",
  "strategist",
  "critic",
  "designer",
  "researcher",
  "vision",
  "manager",
  "writer",
]);

export function migrateAgentNames(agents: Record<string, unknown>): {
  migrated: Record<string, unknown>;
  changed: boolean;
} {
  const migrated: Record<string, unknown> = {};
  let changed = false;

  for (const [key, value] of Object.entries(agents)) {
    const newKey =
      AGENT_NAME_MAP[key.toLowerCase()] ?? AGENT_NAME_MAP[key] ?? key;
    if (newKey !== key) {
      changed = true;
    }
    migrated[newKey] = value;
  }

  return { migrated, changed };
}
