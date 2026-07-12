# AGENTS.md

This file is for autonomous agents or tooling that need to install, configure, verify, or modify `hiai-opencode`.

## Production Environment

**This is a production project.** All tools, MCP servers, skills, and integrations must be functional at all times. If any service stops working during a session (e.g., build failures, test regressions, MCP server errors), it must be diagnosed and fixed immediately — do not leave broken state behind.

## Purpose

`hiai-opencode` is an OpenCode plugin repository published as `@hiai-gg/hiai-opencode`. It is not a standalone app. It wires OpenCode agents, prompts, skills, MCP server launch commands, LSP defaults, and compatibility behavior around external upstream tools. Do not describe MCP servers, skills, model providers, or auxiliary OpenCode plugins as owned by this repository.

The normal workflow is:

1. install it through OpenCode or build it locally
2. register `@hiai-gg/hiai-opencode` in OpenCode
3. provide required environment variables
4. verify agent and MCP runtime state

## Install Workflow

### Native OpenCode Install

Use the OpenCode plugin CLI:

```bash
opencode plugin @hiai-gg/hiai-opencode@latest --global
```

Optional Dynamic Context Pruning plugin:

```bash
opencode plugin @tarquinen/opencode-dcp@latest --global
```

Manual alternative:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@hiai-gg/hiai-opencode"]
}
```

### Local Development Build

```bash
bun install
bun run build
```

### Register In OpenCode

Use the plugin CLI:

```bash
opencode plugin @hiai-gg/hiai-opencode@latest --global
```

Manual alternative:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@hiai-gg/hiai-opencode"]
}
```

### Verify

```bash
opencode debug config
hiai-opencode doctor
hiai-opencode mcp-status
hiai-opencode export-mcp .opencode/.mcp.json
opencode mcp list --print-logs --log-level INFO
```

`opencode mcp list` reads static `.opencode/.mcp.json` files in many OpenCode versions. Runtime MCP servers launched by the plugin may work but not appear there until a static config exists. The plugin auto-exports `.opencode/.mcp.json` on startup when missing. In `always` mode it overwrites only hiai-managed exports unless forced. `hiai-opencode export-mcp .opencode/.mcp.json` can refresh it manually.

## Post-Install Bootstrap Instructions

When a user asks OpenCode or another agent to finish installing this plugin, follow this procedure.

### Operating Rules

- Keep OpenCode plugins separate from MCP servers.
- Register `@hiai-gg/hiai-opencode` as an OpenCode plugin.
- Register `@tarquinen/opencode-dcp` only when the user wants Dynamic Context Pruning; it is a separate OpenCode plugin.
- Do not add MCP server npm packages to the OpenCode `plugin` array.
- Use `hiai-opencode.json` as the project-level service switchboard.
- Use [src/features/mcp/registry.ts](src/features/mcp/registry.ts) as the source of truth for default MCP launch wiring.
- Skill discovery is deterministic: only packaged plugin skills (the `skills/` directory) are indexed. There is no `skill_discovery` config block in the current codebase.
- Do not enable global OpenCode, Claude, or Agents skill folders unless the user explicitly asks.
- Use `bob.env.example` as the key template, but never print, invent, commit, or hardcode secret values.
- Prefer user-level or project-local installs. Do not use sudo/admin rights unless the user explicitly asks.

### Bootstrap Checklist

1. Check tool availability:
   - `opencode --version`
   - `node --version`
   - `npx --version`
   - `bun --version`
   - `python --version` or `python3 --version`
   - `uv --version` when available
2. Check plugin registration with `opencode debug config`.
3. Find or create `hiai-opencode.json` in the project root or `.opencode/`.
4. Configure the `mcp` object there. Disable services that cannot run on the host. Current servers: `sequential-thinking`, `grep_app`.
5. Skills are auto-discovered from the packaged `skills/` directory only — no `skill_discovery` config is needed.
6. Check environment variables without printing values (see `bob.env.example` for canonical list):
   - `FIRECRAWL_API_KEY` (required for Firecrawl CLI skill)
   - `CONTEXT7_API_KEY` (optional/on-demand for Context7 CLI skill)
   - `AGENT_BROWSER_SESSION` (optional; browser automation session name)
   - `GREP_APP_API_KEY` (optional; only if grep.app search is configured)
   - `HIAI_MCP_AUTO_INSTALL`

   **Legacy keys (removed from default registry in v0.3.0 — configure manually only if needed)**:
   - `STITCH_AI_API_KEY` (Stitch MCP — designer UI generation)
   - `MEMPALACE_PYTHON` (MemPalace MCP — agent memory, uses `uv` or `python` fallback)
7. Verify with:
   - `opencode debug config`
   - `hiai-opencode doctor`
   - `hiai-opencode mcp-status`
   - `hiai-opencode export-mcp .opencode/.mcp.json` when static MCP visibility is needed
   - `opencode mcp list --print-logs --log-level INFO`

### MCP Setup Matrix

| Service | Enable when | Dependency behavior |
|---|---|---|
| `sequential-thinking` | Node and npx are available | Helper launcher runs `@modelcontextprotocol/server-sequential-thinking` |
| `grep_app` | User wants GitHub/code search | Remote MCP endpoint; no key required |

**Removed from default MCP registry in v0.3.0**: `mempalace`, `stitch`, `context7`. Context7 is available as an on-demand CLI skill via `skill("explore/context7")`.

### Prompt For OpenCode Users

Users can paste this into OpenCode after installing the plugin:

```text
Finish hiai-opencode setup in this workspace.

Keep OpenCode plugins separate from MCP servers. Do not add MCP server packages to the OpenCode plugin list.

Verify @hiai-gg/hiai-opencode is registered. If I ask for Dynamic Context Pruning, install @tarquinen/opencode-dcp as a separate OpenCode plugin.

Find or create hiai-opencode.json in the project root or .opencode/. Use its mcp object as the only switchboard for MCP enable/disable.

Check which services can run here:
- sequential-thinking: node/npx.
- grep_app: no key required.

CLI skills (not MCP):
- firecrawl: requires FIRECRAWL_API_KEY.
- context7: on-demand via skill("explore/context7").

Report missing keys without printing secret values. Never invent or hardcode API keys.

Run hiai-opencode mcp-status and opencode debug config. If the user wants opencode mcp list visibility, run hiai-opencode export-mcp .opencode/.mcp.json before opencode mcp list --print-logs --log-level INFO. If something is missing, propose or run only user-level/project-local install commands.
```

## Expected Agent State

`createAllAgents()` registers 8 agents. bob.json additionally defines 10 model slots.

Visible primary agent:

- `Bob` / `bob` — Orchestrator, router, entry point

Registered subagent/hidden agents:

- `Manager` / `manager` — Delegation orchestrator, TODO tracker, memory steward
- `Critic` / `critic` — Review gate (binary APPROVED/REJECTED)
- `Writer` / `writer` — Content, copy, positioning, SEO
- `Designer` / `designer` — UI/visual direction, design tokens, component specs
- `Vision` / `vision` — Browser operator, multimodal analysis, PDF/image extraction
- `Dream Consolidator` / `dream-consolidator` — Memory consolidation, cross-session synthesis
- `Distill Packager` / `distill-packager` — Workflow packaging, pattern discovery

Model slots (bob.json) — additionally upgraded as native agents in src/index.ts:

- `build` / `Coder` — Implementation (deep/bounded), hidden subagent
- `plan` / `Strategist` — Deep planning, architecture analysis, visible (mode: all)
- `explore` / `Explorer` — Codebase discovery (grep, firecrawl, grep_app), hidden subagent
- `general` / `General` — General-purpose executor/fallback, visible (mode: all)

Task routing (from Bob's prompt — sole source of truth):

| Category | Routes to |
|----------|-----------|
| `quick` | general (General) — cheap bounded executor |
| `deep` | build (Coder) — complex multi-file implementation |
| `visual-engineering` | designer (Designer) |
| `writing` | writer (Writer) |
| `ultrabrain` | plan (Strategist) |
| review/verification | critic (Critic) — explicit selection |
| research/discovery | explore (Explorer) — explicit selection |
| browser/visual | vision (Vision) — explicit selection |

> **v0.3.0 clean-slate note**: Legacy agent names (`coder`, `strategist`, `researcher`, `sub`) are preserved as internal compatibility aliases mapped to canonical slots (`build`, `plan`, `explore`, `general`). Bob.json defines these as model slots; they are additionally upgraded as native agents in `src/index.ts`.

## Model Configuration

There is one source of truth for model IDs:

- [hiai-opencode.json](hiai-opencode.json)

The runtime loader is:

- [src/config.ts](src/config.ts) — `loadConfig()`, `mergeConfig()`, `DEFAULT_CONFIG`

Users configure the 10 primary agent model slots under `models`: `bob`, `build`, `plan`, `manager`, `critic`, `designer`, `explore`, `writer`, `vision`, and `general`.
Hidden agents and task categories are derived internally in [src/config.ts](src/config.ts).
Use fully qualified model IDs. Do not introduce local aliases like `hiai-fast`, `sonnet`, `fast`, or `high`.
When helping a user choose model IDs, tell them to connect providers in OpenCode, run `opencode models`, and copy the exact `provider/model-id` strings into `hiai-opencode.json`. Do not invent provider prefixes.

> **Legacy name mapping**: `coder`→`build`, `strategist`→`plan`, `researcher`→`explore`, `sub`→`general`, `guard`→`manager`, `brainstormer`→`writer`. There is no separate migration module — these mappings exist only in the CLI doctor diagnostics (`DEPRECATED_MODEL_KEYS` in [assets/cli/hiai-opencode.mjs](assets/cli/hiai-opencode.mjs)).

## Change Map

Use this table when you need to change something and want the right file immediately.

| Goal | Edit this first | Why |
|---|---|---|
| Change a user-facing default model slot | [hiai-opencode.json](hiai-opencode.json) | This is the canonical model source |
| Change internal defaults (permissions, mcp, lsp, completion) | [src/config.ts](src/config.ts) | `DEFAULT_CONFIG` lives here |
| Change MCP/LSP user-facing switches | [hiai-opencode.json](hiai-opencode.json) | Users only toggle enabled state there |
| Change Bob behavior or prompt text | [src/agents/bob.ts](src/agents/bob.ts) | Bob prompt authoring lives there |
| Change Coder (build slot) behavior or prompt text | [src/agents/build.ts](src/agents/build.ts) | Build prompt authoring lives there |
| Change Strategist (plan slot) behavior or prompt text | [src/agents/plan.ts](src/agents/plan.ts) | Plan prompt authoring lives there |
| Change Manager behavior or prompt text | [src/agents/manager.ts](src/agents/manager.ts) | Manager prompt authoring lives there |
| Change Critic prompt text | [src/agents/critic.ts](src/agents/critic.ts) | Critic prompt authoring lives there |
| Change Designer prompt text | [src/agents/designer.ts](src/agents/designer.ts) | Designer prompt authoring lives there |
| Change Writer prompt text | [src/agents/writer.ts](src/agents/writer.ts) | Writer prompt authoring lives there |
| Change Vision prompt text | [src/agents/vision.ts](src/agents/vision.ts) | Vision prompt authoring lives there |
| Change Explorer (explore slot) prompt text | [src/agents/explore.ts](src/agents/explore.ts) | Explore prompt authoring lives there |
| Change General slot prompt text | [src/agents/general.ts](src/agents/general.ts) | General prompt authoring lives there |
| Change reusable policy blocks used by several agents | [src/prompt-library/*](src/prompt-library) | Shared prompt sections live there |
| Change runtime display names, visibility, mode | [src/agents/index.ts](src/agents/index.ts) + [src/index.ts](src/index.ts) | `createAllAgents()` defines 8 agents; native upgrades for explore/plan/build/general in `hooks.config` |
| Change per-agent permissions/tool restrictions | [src/permissions.ts](src/permissions.ts) | `applyAgentPermissions()` maps restrictions to deny/disable |
| Change closure protocol appended to prompts | [src/shared/closure.ts](src/shared/closure.ts) | `CLOSURE_SCHEMA_PROMPT` + `validateClosure()` live there |
| Change prompt override / prompt_append behavior | [src/agents/index.ts](src/agents/index.ts) | `applyPromptOverride()` lives there |
| Change skill tool behavior | [src/tools/skill.ts](src/tools/skill.ts) | `createSkillTool()` loads and serves SKILL.md files |
| Change worktree tools or manager | [src/features/worktree/index.ts](src/features/worktree/index.ts), [src/tools/worktree.ts](src/tools/worktree.ts) | Worktree isolation feature core |
| Change worktree hooks | [src/hooks/worktree-lifecycle.ts](src/hooks/worktree-lifecycle.ts) | Worktree lifecycle hook implementations |
| Change worktree skill | [skills/general/using-git-worktrees/SKILL.md](skills/general/using-git-worktrees/SKILL.md) | Packaged worktree skill definition |
| Change worktree prompt integration | [src/prompt-library/worktree.ts](src/prompt-library/worktree.ts) | Worktree context for agent prompts |
| Change MCP defaults (server set) | [src/features/mcp/registry.ts](src/features/mcp/registry.ts) | `MCP_REGISTRY` + `getMcpConfig()` live there |
| Change MCP auto-export behavior | [src/features/mcp/auto-export.ts](src/features/mcp/auto-export.ts) | `autoExportStaticMcp()` writes `.opencode/.mcp.json` |
| Change MCP assembly into OpenCode config | [src/index.ts](src/index.ts) `hooks.config` | Final MCP dict assembly happens inline there |
| Change npm bootstrap behavior for MCP/LSP tools | [assets/runtime/npm-package-runner.mjs](assets/runtime/npm-package-runner.mjs) | Shared npm bootstrap logic lives there |
| Change LSP defaults | [src/config.ts](src/config.ts) | `DEFAULT_CONFIG.lsp` lives there |
| Change completion-controller gates | [src/features/completion-controller/](src/features/completion-controller) | `decide()`, state, signals live there |
| Change circuit breaker thresholds | [src/features/background-manager/index.ts](src/features/background-manager/index.ts) | `BackgroundManager` circuit breaker config |
| Change CLI commands (doctor, mcp-status, export-mcp) | [assets/cli/hiai-opencode.mjs](assets/cli/hiai-opencode.mjs) | CLI implementation lives there |

## Prompting Layout

Prompting is layered. Each agent prompt is a template literal assembled from imported fragments.

### Layer 1: Agent Prompt Source Files

Each agent's prompt is authored in a single flat file under `src/agents/`:

- Bob: [src/agents/bob.ts](src/agents/bob.ts)
- Build (Coder): [src/agents/build.ts](src/agents/build.ts)
- Plan (Strategist): [src/agents/plan.ts](src/agents/plan.ts)
- Manager: [src/agents/manager.ts](src/agents/manager.ts)
- Critic: [src/agents/critic.ts](src/agents/critic.ts)
- Designer: [src/agents/designer.ts](src/agents/designer.ts)
- Writer: [src/agents/writer.ts](src/agents/writer.ts)
- Vision: [src/agents/vision.ts](src/agents/vision.ts)
- Explore: [src/agents/explore.ts](src/agents/explore.ts)
- General: [src/agents/general.ts](src/agents/general.ts)

There are no model-specific prompt variants — each agent has a single unified prompt.

### Layer 2: Shared Prompt Fragments

Reusable policy/behavior blocks imported by the agent prompts, living under `src/prompt-library/`:

- [src/prompt-library/browser.ts](src/prompt-library/browser.ts) — `BROWSER_VIA_VISION`
- [src/prompt-library/caveman.ts](src/prompt-library/caveman.ts) — caveman protocol fragments
- [src/prompt-library/native-memory.ts](src/prompt-library/native-memory.ts) — native memory/tasks reminders
- [src/prompt-library/postgres-rules.ts](src/prompt-library/postgres-rules.ts) — DB query rules
- [src/prompt-library/workspace.ts](src/prompt-library/workspace.ts) — `getWorkspaceContext()`
- [src/prompt-library/worktree.ts](src/prompt-library/worktree.ts) — `WORKTREE_AWARENESS`

### Layer 3: Runtime Prompt Injection

Prompt content appended/transformed after the source prompt is built:

- [src/shared/closure.ts](src/shared/closure.ts) — `CLOSURE_SCHEMA_PROMPT` + `validateClosure()`
- [src/hooks/closure-injector.ts](src/hooks/closure-injector.ts) — appends closure schema when missing
- [src/hooks/caveman-system-injector.ts](src/hooks/caveman-system-injector.ts) — resolves agent identity and injects caveman protocol
- [src/agents/index.ts](src/agents/index.ts) — `applyPromptOverride()` applies `prompt_append`

### Layer 4: Runtime Assembly

Final agent registration into OpenCode's `cfg.agent` dict happens in the `hooks.config` callback in [src/index.ts](src/index.ts). This is where model resolution, visibility, mode, temperature, thinking budgets, and per-agent permissions (`applyAgentPermissions`) are applied. If an agent prompt looks correct in source but wrong at runtime, inspect the `hooks.config` callback first.

## Prompting Truth Model

Do not treat `src/agents` as the only source of truth for the final runtime prompt.

The correct model is:

1. `src/agents/*.ts` is the main prompt authoring layer
2. `src/prompt-library/*.ts` contributes reusable fragments imported by agent prompts
3. runtime hooks (closure-injector, caveman-system-injector) can append or alter prompts
4. `hooks.config` in [src/index.ts](src/index.ts) applies model, visibility, permissions

So:

- `src/agents` is the main source of authored prompts
- it is not the only source of final runtime prompting

## MCP Rules

Default MCP wiring lives in:

- [src/features/mcp/registry.ts](src/features/mcp/registry.ts) — `MCP_REGISTRY` (2 servers) + `getMcpConfig()`

OpenCode MCP config assembly happens inline in:

- [src/index.ts](src/index.ts) `hooks.config` callback

Static `.opencode/.mcp.json` auto-export:

- [src/features/mcp/auto-export.ts](src/features/mcp/auto-export.ts) — `autoExportStaticMcp()` writes the file at startup (controlled by `HIAI_OPENCODE_AUTO_EXPORT_MCP`)

Runtime helper assets live in:

- [assets/runtime/npm-package-runner.mjs](assets/runtime/npm-package-runner.mjs) — shared npm bootstrap

> **Note**: The `assets/mcp/` directory was removed in v0.3.6 — the mempalace launcher is gone.

Current MCP set (v0.3.0+):

- `sequential-thinking` — local, npx-backed
- `grep_app` — remote, no key required

**Removed in v0.3.0**: `mempalace`, `stitch`, `context7` (removed from default MCP registry). Context7 is available as an on-demand CLI skill via `skill("explore/context7")`.

The CLI's `MCP_REGISTRY` in [assets/cli/hiai-opencode.mjs](assets/cli/hiai-opencode.mjs) must mirror the runtime registry — keep them in sync when adding/removing servers.

## Writing And Website Copy

Public-facing website/product copy is owned by `writer`.
`writer`, `copywriter`, `content-writer`, and `website-writer` are aliases for `writer`.

Use the `website-copywriting` skill for:

- landing pages
- hero sections
- CTA labels
- feature copy
- positioning and naming
- onboarding, empty states, and product microcopy

Preferred invocation:

```text
task(subagent_type="writer", load_skills=["website-copywriting"], run_in_background=false, description="Write landing page copy", prompt="...")
```

Use `designer` or `visual-engineering` for visual direction. Use `writer` for words.

## Manager Memory Stewardship

Use `platform-manager` / `manager` when durable project memory or handoff state must stay current.

Manager owns:

- Project memory hygiene: search before writing, deduplicate, write only durable decisions and important preferences.
- Architecture memory updates: when architecture changes, update project MEMORY.md.
- TODO hygiene: mark completed items complete, preserve unfinished tasks with blocker and next action, remove duplicate stale TODOs.
- Session continuity: write concise handoff ledgers, not raw transcripts.

Do not ask Manager to implement code. Use Coder for implementation and Manager for memory/task state.

## Skill Discovery Rules

Default behavior is intentionally deterministic.

Enabled by default:

- packaged `hiai-opencode` skill definitions mirrored into OpenCode's skill view
- generated builtin helper skills
- explicit `skills.sources` entries
- project-local `.opencode/skills` and `.opencode/skill`

Disabled by default:

- global OpenCode skills
- project and global Claude skills
- project and global Agents skills

Opt-in example:

```json
{
  "skill_discovery": {
    "global_opencode": true,
    "project_claude": true,
    "global_claude": false,
    "project_agents": false,
    "global_agents": false
  }
}
```

Use `skills.disable` for noisy individual skills:

```json
{
  "skills": {
    "disable": ["claude-md-management"]
  }
}
```

## Environment Variables

Use [bob.env.example](bob.env.example) as the canonical key template for local setup and release checks.

Model provider credentials are configured through OpenCode Connect. Do not ask users to put `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY` into `hiai-opencode.json` for normal model usage. The plugin stores model IDs only.

Common service keys:

- `FIRECRAWL_API_KEY` (CLI skill, not MCP)
- `CONTEXT7_API_KEY` (on-demand CLI skill via `skill("explore/context7")`)
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`

**Removed from default registry (v0.3.0)**: `STITCH_AI_API_KEY`, `MEMPALACE_PYTHON`, `MEMPALACE_PALACE_PATH` — configure manually if needed.

- `HIAI_MCP_AUTO_INSTALL`
- `HIAI_OPENCODE_AUTO_EXPORT_MCP`
- `HIAI_OPENCODE_MCP_EXPORT_PATH`
- `HIAI_OPENCODE_EXPORT_MCP_MODE`

## MemPalace (Removed)

MemPalace MCP was removed from the default registry in v0.3.0, and the bundled launcher (`assets/mcp/mempalace.mjs`) was removed in v0.3.6. The host runtime provides a native `memory` tool. Do not re-add a memory MCP unless the user explicitly asks.

## Mental Map

Agent/MCP/LSP integration reference — which agents use which integrations:

```
AGENTS (runtime slot / display name):
  bob (you)           — orchestrator
  build (Coder)       — implementation (deep/bounded)
  plan (Strategist)   — planning (read-only, no code)
  explore (Explorer)  — discovery: local grep + Firecrawl/grep_app + Context7 CLI skill
  critic              — review gate (APPROVED/REJECTED)
  designer            — UI/visual direction
  writer              — copy/positioning/SEO
  vision              — PDF/image extraction, browser UI verification
  manager             — delegation orchestrator, memory steward
  general             — general-purpose executor (fallback)
  quality-guardian    — post-impl review + bug investigation
  agent-skills        — skill registry, discovery

MCP INTEGRATIONS (who uses what, v0.3.0):
  grep_app            -> explore, build (OSS code patterns) [MCP]
  Sequential-Thinking -> plan, critic (deep reasoning) [MCP]

DESIGN SYSTEMS:
  open-design         -> designer (150+ brand design-systems, 48 skills, craft guidelines)

CLI SKILLS (not MCP):
  Firecrawl           -> explore (web scraping, crawl, extract, search)
  Context7            -> explore, build (on-demand lib docs via skill("explore/context7"))

LSP:
  typescript, svelte, eslint, bash, pyright
  -> build MUST run lsp_diagnostics after every edit
```

## Known Runtime Caveats

Windows/OpenCode may fail to spawn local MCP processes with `EPERM` for `cmd` or `node`. When that happens:

- the plugin definition may still be correct
- the host runtime is the remaining blocker

This most often affects:

- `sequential-thinking`
- local `npx`-backed MCP processes

## Closure Protocol

All agents MUST wrap their final response in a structured `<CLOSURE>` block. The schema prompt is injected into agent prompts via `CLOSURE_SCHEMA_PROMPT` from [src/shared/closure.ts](src/shared/closure.ts), and the `closure-injector` hook ([src/hooks/closure-injector.ts](src/hooks/closure-injector.ts)) appends it when missing.

### Schema

```xml
<CLOSURE>
{
  "reasoning": "Concise summary of what was achieved and why it satisfies the request.",
  "evidence": ["Link to test results", "File path to changes", "Log snippets", "LSP diagnostics clean"],
  "readiness": "done" | "accept" | "reject"
}
</CLOSURE>
```

### Readiness Values

| Value | Meaning | Used By |
|-------|---------|---------|
| `done` | Task completed successfully | All agents |
| `accept` | Reviewer approved the proposed changes | Critic |
| `reject` | Reviewer denied the changes with feedback | Critic |

The `readiness` value is validated against this enum by `validateClosure()` in [src/shared/closure.ts](src/shared/closure.ts).

### Relationship to `<promise>DONE</promise>`

The loop continuation system uses `<promise>DONE</promise>` as its signal to stop iterating. This is separate from `<CLOSURE>`:

- `<CLOSURE>` — task completion marker, required on every agent response
- `<promise>DONE</promise>` — loop continuation signal, stops the loop when emitted

Both can appear together; they do not conflict.

### When to Inspect Closure Injection

If an agent response is missing `<CLOSURE>` at runtime but the source prompts look correct, check in order:

1. Does the agent prompt import and interpolate `CLOSURE_SCHEMA_PROMPT` from [src/shared/closure.ts](src/shared/closure.ts)?
2. Is the `closure-injector` hook disabled in config (`hooks.disabled`)?
3. Does `validateClosure()` in [src/shared/closure.ts](src/shared/closure.ts) correctly parse the block?

## Troubleshooting

### `hiai-opencode doctor` reports schema errors

1. Run `hiai-opencode doctor` and look for the specific missing or unknown key
2. Check your `hiai-opencode.json` against the schema in [config/hiai-opencode.schema.json](config/hiai-opencode.schema.json)
3. Verify all keys in `models` and `mcp` match documented shapes
4. Run `opencode debug config` to confirm the plugin is registered

### `hiai-opencode mcp-status` shows all services as ⚠️ missing

- The plugin is likely registered but cannot find its bundled `hiai-opencode.json`
- Run `bun run build` in the plugin repository to ensure `dist/` is populated
- If running from npm, reinstall: `opencode plugin @hiai-gg/hiai-opencode@latest --global`

### `opencode mcp list` does not show hiai-opencode MCP servers

- `opencode mcp list` reads static `.opencode/.mcp.json` files, not runtime plugin MCP
- Run `hiai-opencode export-mcp .opencode/.mcp.json` to write a static export
- The plugin auto-exports on startup when `HIAI_OPENCODE_AUTO_EXPORT_MCP` is not disabled

### Firecrawl tools return "FIRECRAWL_API_KEY missing" despite having the key set

Firecrawl is a CLI skill (not an MCP server). The `FIRECRAWL_API_KEY` env var must be available in the shell environment where the CLI skill runs. If your key only lives in `process.env`, export it before starting OpenCode:

```bash
export FIRECRAWL_API_KEY=fc-...
```

Or set it in `bob.env` in your project root. Firecrawl is NOT configured via `hiai-opencode.json` MCP section.

### Browser Automation (agent-browser)

For browser automation, use the `/agent-browser` skill instead of MCP. The CLI-based approach uses native Chrome via CDP, snapshot-based @eN refs, and doesn't require MCP server startup — no Playwright.

**Install** (Bun):
```bash
bun add -g agent-browser && agent-browser install
```

Or via npm:
```bash
npm i -g agent-browser && agent-browser install
```

Repo: https://github.com/vercel-labs/agent-browser

Key environment variables (`AGENT_BROWSER_*`):
- `AGENT_BROWSER_HEADED=1` — show browser window
- `AGENT_BROWSER_SESSION=name` — isolated session
- `AGENT_BROWSER_PROFILE=path` — persistent profile
- `AGENT_BROWSER_PROVIDER=name` — cloud provider (browserbase, browseruse, kernel)
- `AGENT_BROWSER_AUTO_CONNECT=1` — auto-discover running Chrome
- `AGENT_BROWSER_EXECUTABLE_PATH` — custom browser binary

Key pattern: `snapshot -i --json` → @eN refs → `click @e2` / `fill @e3 "text"`

Use `/agent-browser` skill in OpenCode for browser tasks — navigation, snapshots, screenshots, form filling, console/network inspection.

### MemPalace MCP fails with "python not found" (Legacy)

MemPalace MCP was removed from the default registry in v0.3.0. If you have manually configured it, the launcher prefers `uv`. If `uv` is not available, it falls back to `python`. Set `mcp.mempalace.pythonPath` or `MEMPALACE_PYTHON` to the correct interpreter:

```json
{
  "mcp": {
    "mempalace": {
      "enabled": true,
      "pythonPath": "/usr/bin/python3"
    }
  }
}
```

If `HIAI_MCP_AUTO_INSTALL` is not disabled, the launcher will attempt `python -m pip install --user mempalace` on first start.

### Agent prompt looks correct in source but wrong at runtime

The final runtime prompt is assembled from multiple layers:

1. Source prompt in `src/agents/<agent>.ts` (flat files, no subdirectories)
2. Shared prompt fragments from `src/prompt-library/*.ts` (imported by agent prompts)
3. Runtime injection from `src/hooks/closure-injector.ts` and `src/hooks/caveman-system-injector.ts`
4. Closure protocol from [src/shared/closure.ts](src/shared/closure.ts)
5. Agent registration assembly in [src/index.ts](src/index.ts) `hooks.config` (model, visibility, permissions)

Inspect the `hooks.config` callback in [src/index.ts](src/index.ts) first when runtime output diverges from source.

### Background task disappeared / circuit breaker triggered

Background tasks can be silently cancelled by the circuit breaker. Two thresholds:

1. **Consecutive same-tool limit (default: 20)** — If a subagent calls the same tool 20+ times consecutively with identical input, the task is cancelled. This prevents infinite loops.
2. **Total tool call limit (default: 4000)** — If a subagent makes 4000+ total tool calls, the task is cancelled. This prevents runaway token usage.

When either threshold is hit:
- Task status becomes `"cancelled"` with `source: "circuit-breaker"`
- Reason is logged (check logs for `Circuit breaker:`)
- Parent session receives a notification

To detect: search logs for `"[background-agent] Circuit breaker:"`
To adjust: set `background_task.circuit_breaker.consecutive_threshold` or `background_task.max_tool_calls` in `hiai-opencode.json`.

### Background task state is in-memory only

BackgroundManager stores all task state in memory (JavaScript Maps). If the OpenCode process restarts or crashes:
- All running/pending background tasks are lost
- Task history is lost
- Descendant counts are lost

This is by design for simplicity. A persistence layer (SQLite/journal) is planned but not yet implemented.

## Common Pitfalls

### Installing MCP server packages as OpenCode plugins

MCP servers (`@modelcontextprotocol/server-sequential-thinking`, `@upstash/context7-mcp`) are NOT OpenCode plugins. Adding them to the `plugin` array in `opencode.json` will not work. Note: Firecrawl is a CLI skill, not an MCP server.

Register only `@hiai-gg/hiai-opencode` as a plugin. MCP wiring is handled through the `mcp` object in `hiai-opencode.json`.

### Inventing model ID prefixes

When users ask which model to choose, tell them to run `opencode models` and copy the exact `provider/model-id` strings from that output into `hiai-opencode.json`. Do not invent prefixes like `openrouter/minimax/` — the provider prefix must match what OpenCode Connect has authorized.

### Confusing `{env:VAR}` with `${VAR}` placeholders

hiai-opencode uses **two different** environment variable placeholder syntaxes:

1. **`{env:VAR_NAME}`** — Used in `hiai-opencode.json` for hiai-opencode's own config resolver. Unrestricted: works for any env var name including `KEY`, `TOKEN`, `SECRET`.
2. **`${VAR_NAME}`** — Used by Claude Code and some OpenCode contexts. **Blocks** vars containing `KEY`, `TOKEN`, or `SECRET` for security.

Example in `hiai-opencode.json`:
```json
{
  "mcp": {
    "stitch": {
      "enabled": true,
      "environment": { "STITCH_AI_API_KEY": "{env:STITCH_AI_API_KEY}" }
    }
  }
}
```

If you use `${STITCH_AI_API_KEY}` here, it will be blocked because the var name contains `KEY`. Always use `{env:...}` format in hiai-opencode config files.

### Hardcoding API keys in config files

Never put actual API key values in `hiai-opencode.json`. Use `{env:VARIABLE_NAME}` placeholder format:

```json
{
  "mcp": {
    "stitch": {
      "enabled": true,
      "environment": { "STITCH_AI_API_KEY": "{env:STITCH_AI_API_KEY}" }
    }
  }
}
```

Note: Firecrawl is a CLI skill, not an MCP server. Its `FIRECRAWL_API_KEY` is set via shell env or `.env`, not in the `mcp` config block.

Check with: `grep -E '(AQ\.|fc-|ctx7sk-|sk-|key-)' hiai-opencode.json` — should return 0 matches.

### Enabling all skill sources

Global OpenCode, Claude, and Agents skill folders are disabled by default for a reason: they can pollute the skill tree with low-quality or irrelevant skills. Only enable them if the user explicitly asks.

### Writing code in Bob or Manager

Bob is an orchestrator — it MUST delegate, not implement. Manager is a memory steward — it should not write code files. Assign implementation to `Coder` or `Sub`, not to these orchestration agents.

### Confusing `<CLOSURE>` with `<promise>DONE</promise>`

`<CLOSURE>` is a mandatory task-completion marker that Manager checks on every response. `<promise>DONE</promise>` is a ralph-loop signal that stops the iteration loop. They serve different purposes and both can coexist. See the Closure Protocol section for details.

### Treating `src/agents/` as the only prompt source

Prompt assembly has 6 layers. Changing a file in `src/agents/` is necessary but not sufficient if layers 4–6 are overriding the result. See "Prompting Truth Model" for the full picture.

### Skipping `lsp_diagnostics` after edits

Coder MUST run `lsp_diagnostics` after every file edit. LSP errors will not surface automatically — agents must proactively call the diagnostic tool to catch TypeScript/Svelte/Bash/Python errors.

## Memory Systems

Two memory backends coexist in hiai-opencode, each with a different indexing scope:

| System | Backend | Source | Use Case |
|--------|---------|--------|----------|
| `memory` (native) | Full-text indexed MD files | OpenCode built-in | Session/project/global memory recall |
| `hiai_memory_search` (plugin) | SQLite FTS5 BM25 | Plugin-managed index | Cross-session search, agent trajectories |

The native `memory` tool indexes curated MD files (checkpoints, MEMORY.md, notes.md, task progress).
`hiai_memory_search` indexes raw session transcripts and tool outputs for forensic search beyond
what the native tool covers. It is maintained because it covers agent trajectories that the
native memory tool does not index.

### Memory Tools: hiai_memory_search vs Native Memory

The plugin provides two memory-search mechanisms:

#### hiai_memory_search (plugin tool)
- Registers as `hiai_memory_search` tool in the MCP registry
- Searches the plugin-managed SQLite FTS5 BM25 index
- **Use when**: You need to recall cross-session context, agent trajectories, or tool outputs
- **Returns**: Ranked file paths with scores; use Read to load full content
- **Scope**: Cross-session agent trajectories, tool outputs, and transcripts
- **Note**: This is a plugin feature specific to hiai-opencode environments

#### Native Memory (OpenCode built-in)
- Built into OpenCode runtime
- Accessed via `memory()` tool or memory MCP endpoint
- **Use when**: You need OpenCode's default memory behavior for curated knowledge
- **Scope**: Curated MD files (MEMORY.md, checkpoints, notes.md, task progress)

#### Key Differences

| Aspect | hiai_memory_search | Native Memory |
|--------|-------------------|---------------|
| Availability | hiai-opencode plugin | OpenCode core |
| Backend | SQLite FTS5 BM25 | Full-text indexed MD files |
| Scope | Agent trajectories, tool outputs, transcripts | Curated facts, decisions, patterns |
| Use Case | Forensic search, cross-session recall | Durable knowledge retrieval |
| Latency | Low | Low |

#### Recommendation
- Use `hiai_memory_search` for searching agent trajectories and tool outputs
- Use native `memory` for recalling curated durable facts and decisions
- Both tools can coexist and complement each other

## Prompt Ownership

## Root Documentation Policy

Root docs should stay minimal and non-duplicative.

Keep:

- `README.md`: install, configure, use
- `AGENTS.md`: agent/tooling operator instructions
- `ARCHITECTURE.md`: internals and modification map
- `LICENSE.md`: licensing and attribution

Avoid reintroducing extra root docs that duplicate one of those roles.
