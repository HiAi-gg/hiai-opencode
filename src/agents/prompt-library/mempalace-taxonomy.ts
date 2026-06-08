/**
 * Canonical MemPalace taxonomy — single source of truth.
 *
 * Three conflicting taxonomies existed before this file:
 * - AGENTS.md: decisions, bugs, config, agents
 * - hiai-opencode-setup skill: core-architecture, core-decisions, core-plans, etc.
 * - auto-save hook: plans, tasks, reviews, designs, sessions, errors
 *
 * This file reconciles all three into 15 rooms (14 structured + 1 diary default).
 *
 * Wing convention:
 * - wing="hiai-opencode" for global/plugin-wide memory
 * - wing="<project-name>" for per-project memory (e.g., "amigo", "webs")
 * - wing="wing_<agent>" for agent-specific career diaries
 */

export const CANONICAL_WINGS = {
  PROJECT: "hiai-opencode",
  AGENT_DIARY: (agentName: string) => `wing_${agentName}`,
} as const

export const CANONICAL_ROOMS = {
  /** Architecture and design choices with rationale */
  DECISIONS: "decisions",
  /** Bug root causes, reproduction steps, fixes applied */
  BUGS: "bugs",
  /** Environment variables, port assignments, dependency choices */
  CONFIG: "config",
  /** Agent behavior changes, prompt modifications, new agents */
  AGENTS: "agents",
  /** System structure, ports, dependencies, runtime architecture */
  ARCHITECTURE: "architecture",
  /** Active and completed plans, plan summaries */
  PLANS: "plans",
  /** Task completion records (from auto-save hook) */
  TASKS: "tasks",
  /** Code review outcomes, critic reports */
  REVIEWS: "reviews",
  /** Design decisions, Stitch outputs, design tokens */
  DESIGNS: "designs",
  /** Session handoff records, session summaries */
  SESSIONS: "sessions",
  /** Error/exception records, crash reports */
  ERRORS: "errors",
  /** Reusable code patterns, coding conventions */
  PATTERNS: "patterns",
  /** Discovered constraints, project boundaries */
  CONSTRAINTS: "constraints",
  /** What was tried and didn't work */
  FAILED_APPROACHES: "failed-approaches",
  /** Free-form session logs (default if no room specified) */
  DIARY: "diary",
} as const

export type CanonicalRoom = typeof CANONICAL_ROOMS[keyof typeof CANONICAL_ROOMS]

/**
 * Build a save checklist string for inclusion in agent prompts.
 */
export function buildSaveChecklist(): string {
  return `### Save to MemPalace when you discover:

- Architecture/design decisions with rationale → \`skill_mcp({ mcp_name: "mempalace", tool_name: "mempalace_add_drawer", arguments: { wing: "<project>", room: "decisions", content: "..." }})\`
- Bug root causes and fixes → \`skill_mcp({ mcp_name: "mempalace", tool_name: "mempalace_add_drawer", arguments: { wing: "<project>", room: "bugs", content: "..." }})\`
- Configuration changes, env vars, ports → \`skill_mcp({ mcp_name: "mempalace", tool_name: "mempalace_add_drawer", arguments: { wing: "<project>", room: "config", content: "..." }})\`
- Agent behavior changes, prompt updates → \`skill_mcp({ mcp_name: "mempalace", tool_name: "mempalace_add_drawer", arguments: { wing: "<project>", room: "agents", content: "..." }})\`
- System architecture, dependencies → \`skill_mcp({ mcp_name: "mempalace", tool_name: "mempalace_add_drawer", arguments: { wing: "<project>", room: "architecture", content: "..." }})\`
- Reusable code patterns, conventions → \`skill_mcp({ mcp_name: "mempalace", tool_name: "mempalace_add_drawer", arguments: { wing: "<project>", room: "patterns", content: "..." }})\`
- Project constraints, limitations → \`skill_mcp({ mcp_name: "mempalace", tool_name: "mempalace_add_drawer", arguments: { wing: "<project>", room: "constraints", content: "..." }})\`
- Failed approaches (after reverting) → \`skill_mcp({ mcp_name: "mempalace", tool_name: "mempalace_add_drawer", arguments: { wing: "<project>", room: "failed-approaches", content: "..." }})\`

### Use \`mempalace_diary_write\` for:
- Session summaries (default)
- Free-form status notes
- Anything that doesn't fit a structured room

### Do NOT save:
- Routine status updates (use todos instead)
- Temporary debugging state
- Trivial fixes (<3 lines, obvious)
- Information already in git history`
}
