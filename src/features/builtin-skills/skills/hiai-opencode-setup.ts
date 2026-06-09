import type { BuiltinSkill } from "../types";

export const hiaiOpencodeSetupSkill: BuiltinSkill = {
  name: "hiai-opencode-setup",
  description:
    "Use when install/setup/onboarding or MCP debug mentions: install, setup, bootstrap, doctor, mcp-status, MCP not found, mcp list empty, MemPalace, firecrawl, stitch, sequential-thinking, agent-browser, DCP, agents, skills, or LSP.",
  template: `# hiai-opencode Setup And Runtime Operations

Use this skill for hiai-opencode installation, diagnostics, and integration repair.

## Architecture

- hiai-opencode is an OpenCode plugin, not a standalone app.
- MCP servers are external upstream tools launched by hiai-opencode wiring.
- The user-facing config is \`hiai-opencode.json\` or \`.opencode/hiai-opencode.json\`.
- Model provider credentials belong to OpenCode Connect. Do not ask for \`OPENROUTER_API_KEY\`, \`OPENAI_API_KEY\`, or \`ANTHROPIC_API_KEY\` for normal model usage.
- Service credentials are separate: \`FIRECRAWL_API_KEY\`, \`STITCH_AI_API_KEY\`, \`CONTEXT7_API_KEY\`.

## First Diagnostic Commands

\`\`\`bash
hiai-opencode doctor
hiai-opencode mcp-status
opencode debug config
\`\`\`

If \`opencode mcp list\` is empty but doctor/mcp-status sees servers, explain that OpenCode's list may read only static \`.mcp.json\`. Refresh static visibility:

\`\`\`bash
hiai-opencode export-mcp .opencode/.mcp.json
opencode mcp list --print-logs --log-level INFO
\`\`\`

## Plugin vs MCP

Install OpenCode plugins with:

\`\`\`bash
opencode plugin @hiai-gg/hiai-opencode@latest --global
opencode plugin @tarquinen/opencode-dcp@latest --global
\`\`\`

Do not add MCP packages to the OpenCode plugin array. MCP packages are launched through \`hiai-opencode.json\` and helper scripts.

## MCP Runtime Notes

- \`agent-browser\`: npm i -g agent-browser && agent-browser install; use for browser automation tasks.
- \`sequential-thinking\`: node/npx; use for complex planning, revision, and branching.
- \`firecrawl\`: requires \`FIRECRAWL_API_KEY\`.
- \`mempalace\`: prefers \`uv\`; otherwise Python 3.9+ with \`mempalace\`. Use \`mempalace_status\` first, search before answering memory questions, and never invent memories.
- \`stitch\`: requires \`STITCH_AI_API_KEY\`.
- \`context7\`: remote docs/search; key optional but recommended for limits.

## MemPalace Configuration

The MemPalace stores project memory using a single-wing architecture:

**Wing**: \`hiai-opencode\` (shared across all projects — single codebase = shared knowledge)

**Room taxonomy (canonical)**: single source of truth at \`src/agents/prompt-library/mempalace-taxonomy.ts\`. Use simple room names (not \`project-aspect\` format):
- \`decisions\` — architecture/design choices
- \`bugs\` — bug root causes and fixes
- \`config\` — env vars, ports, dependencies
- \`agents\` — agent behavior changes
- \`architecture\` — system structure, dependencies
- \`plans\` — active and completed plans
- \`tasks\` — task completions (from auto-save hook)
- \`reviews\` — code review outcomes
- \`designs\` — design decisions
- \`sessions\` — session handoffs
- \`errors\` — error/exception records
- \`patterns\` — reusable code patterns
- \`constraints\` — project boundaries
- \`failed-approaches\` — what didn't work
- \`diary\` — free-form session logs (default)

Use \`skill_mcp({ mcp_name: "mempalace", tool_name: "mempalace_add_drawer", arguments: { wing: "hiai-opencode", room: "<room>", content: "..." }})\` to save.

**Agent MemPalace workflow**:
1. BEFORE work: \`skill_mcp({ mcp_name: "mempalace", tool_name: "mempalace_search", arguments: { query: "<topic>", limit: 5, wing: "hiai-opencode" }})\`
2. AFTER work: record via \`mempalace_diary_write\` (with \`agent_name\`) or \`mempalace_add_drawer\` for durable decisions
3. Filter by room: \`search(room="plans")\` for specific project context

**Verification**: \`hiai-opencode mcp-status\` should show mempalace as enabled.

## Calling MCP

- Use native MCP tools if OpenCode exposes them.
- Use \`skill_mcp\` for skill-embedded MCP or enabled hiai-opencode MCP.
- If \`skill_mcp\` says a server is not found, check whether the skill is loaded, whether the MCP is enabled in \`hiai-opencode.json\`, and whether \`.mcp.json\` needs export.

## Safety Rules

- Report missing keys by env var name only. Never print key values.
- Prefer project-local or user-level installs. Do not use sudo/admin rights unless the user explicitly asks.
- Do not edit unrelated OpenCode/Claude/Agents global skill folders unless the user opts in.
- Keep DCP separate: it is an optional OpenCode plugin, not part of the hiai-opencode package.
`,
  allowedTools: [
    "Bash(*)",
    "Read(*)",
    "Edit(*)",
    "Glob(*)",
    "Grep(*)",
    "skill_mcp(*)",
  ],
};
