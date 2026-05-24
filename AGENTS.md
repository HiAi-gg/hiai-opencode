# AGENTS.md

This file is for autonomous agents or tooling that need to install, configure, verify, or modify `hiai-opencode`.

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
- Use `src/mcp/registry.ts` as the source of truth for default MCP launch wiring.
- Keep skill discovery deterministic by default: packaged plugin skills, generated builtin skills, explicit config sources, and project `.opencode/skills`.
- Do not enable global OpenCode, Claude, or Agents skill folders unless the user explicitly asks.
- Use `.env.example` as the key template, but never print, invent, commit, or hardcode secret values.
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
4. Configure the `mcp` object there. Disable services that cannot run on the host.
5. Keep `skill_discovery` clean unless the user opts into external folders:
   - `config_sources: true`
   - `project_opencode: true`
   - `global_opencode: false`
   - `project_claude: false`
   - `global_claude: false`
   - `project_agents: false`
   - `global_agents: false`
6. Check environment variables without printing values:
   - `FIRECRAWL_API_KEY`
   - `STITCH_AI_API_KEY`
   - `CONTEXT7_API_KEY`
   - `MEMPALACE_PYTHON`
   
   - `HIAI_MCP_AUTO_INSTALL`
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

| `mempalace` | `uv` is available, or Python 3.9+ with pip is available | Launcher prefers `uv`; otherwise uses Python and can run `python -m pip install --user mempalace` when `HIAI_MCP_AUTO_INSTALL` is not disabled. Interpreter can be pinned via `mcp.mempalace.pythonPath` or `MEMPALACE_PYTHON` |
| `stitch` | `STITCH_AI_API_KEY` is set | Remote MCP endpoint |
| `context7` | User wants Context7 docs/search | Remote MCP endpoint; use `CONTEXT7_API_KEY` if available |
| `grep_app` | User wants GitHub/code search | Remote MCP endpoint; no key required |

### Prompt For OpenCode Users

Users can paste this into OpenCode after installing the plugin:

```text
Finish hiai-opencode setup in this workspace.

Keep OpenCode plugins separate from MCP servers. Do not add MCP server packages to the OpenCode plugin list.

Verify @hiai-gg/hiai-opencode is registered. If I ask for Dynamic Context Pruning, install @tarquinen/opencode-dcp as a separate OpenCode plugin.

Find or create hiai-opencode.json in the project root or .opencode/. Use its mcp object as the only switchboard for MCP enable/disable.

Check which services can run here:
- sequential-thinking: node/npx.
- mempalace: uv or Python 3.9+ with pip; set `mcp.mempalace.pythonPath` (or `MEMPALACE_PYTHON`) if needed; `HIAI_MCP_AUTO_INSTALL` controls first-run pip install.
- stitch: STITCH_AI_API_KEY.
- context7: optional CONTEXT7_API_KEY.
- grep_app: no key required.

Report missing keys without printing secret values. Never invent or hardcode API keys.

Run hiai-opencode mcp-status and opencode debug config. If the user wants opencode mcp list visibility, run hiai-opencode export-mcp .opencode/.mcp.json before opencode mcp list --print-logs --log-level INFO. If something is missing, propose or run only user-level/project-local install commands.
```

## Expected Agent State

Visible primary agents:

- `Bob`
- `Coder`
- `Strategist`
- `Manager`
- `Critic`
- `Designer`
- `Researcher`
- `Writer`
- `Vision`

Hidden/system or compatibility agents:

- `Agent Skills`
- `Sub`
- `build`
- `plan`
- `quality-guardian`

Automatic task distribution:

- Category-based task execution routes through `Coder`
- `quick`, `writing`, and `unspecified-low` use Coder's fast bounded contour
- `deep`, `ultrabrain`, `visual-engineering`, `artistry`, and `unspecified-high` use Coder's deep contour
- `Critic` is selected explicitly for review and verification passes
- `Researcher` is selected explicitly for codebase and documentation discovery
- `Designer`, `Writer`, `Manager`, and `Vision` are direct callable specialists, not category executors
- `Bob` and `Manager` are orchestration agents, not normal subagent routing targets

If runtime output differs from that set, inspect:

- [src/plugin-handlers/agent-config-handler.ts](src/plugin-handlers/agent-config-handler.ts)
- [src/shared/agent-display-names.ts](src/shared/agent-display-names.ts)
- `src/shared/migration/*`

## Model Configuration

There is one source of truth for model IDs:

- [hiai-opencode.json](hiai-opencode.json)

The runtime loader is:

- [src/config/defaults.ts](src/config/defaults.ts)

Users configure only the 10 primary agent model slots under `models`: `bob`, `coder`, `strategist`, `manager`, `critic`, `designer`, `researcher`, `writer`, `vision`, and `sub`.
Hidden agents and task categories are derived internally in `src/config/defaults.ts`.
Use fully qualified model IDs. Do not introduce local aliases like `hiai-fast`, `sonnet`, `fast`, or `high`.
When helping a user choose model IDs, tell them to connect providers in OpenCode, run `opencode models`, and copy the exact `provider/model-id` strings into `hiai-opencode.json`. Do not invent provider prefixes.

## Change Map

Use this table when you need to change something and want the right file immediately.

| Goal | Edit this first | Why |
|---|---|---|
| Change a user-facing default model slot | [hiai-opencode.json](hiai-opencode.json) | This is the canonical model source |
| Change how categories inherit the 10 model slots | [src/config/defaults.ts](src/config/defaults.ts) | Category routing is internal |
| Change MCP/LSP user-facing switches | [hiai-opencode.json](hiai-opencode.json) | Users only toggle enabled state there |
| Change Bob behavior or prompt text | `src/agents/bob/*` | Bob prompt authoring lives there |
| Change Coder behavior or prompt text | `src/agents/coder/*` | Coder prompt authoring lives there |
| Change Strategist behavior or prompt text | `src/agents/strategist/*` | Strategist prompt authoring lives there |
| Change Manager behavior or prompt text | `src/agents/manager/*` | Manager prompt authoring lives there |
| Change Critic prompt text | `src/agents/critic/*` | Critic prompt authoring lives there |
| Change Vision prompt text | [src/agents/ui.ts](src/agents/ui.ts) | Vision lives there |
| Change Manager prompt text | `src/agents/manager/*` | Manager lives there |
| Change reusable policy blocks used by several agents | `src/agents/prompt-library/*` | Shared prompt sections live there |
| Change dynamic prompt sections assembled from agent/tool/category context | `src/agents/dynamic-agent-*` | Dynamic sections are built there |
| Change runtime display names | [src/shared/agent-display-names.ts](src/shared/agent-display-names.ts) | Final display-name mapping lives there |
| Change legacy alias resolution | `src/shared/migration/*` | Compatibility mapping lives there |
| Change which agents are visible or hidden | [src/plugin-handlers/agent-config-handler.ts](src/plugin-handlers/agent-config-handler.ts) | Final runtime visibility is forced there |
| Change runtime fallback descriptions | [src/plugin-handlers/agent-config-handler.ts](src/plugin-handlers/agent-config-handler.ts) | Final descriptions can be injected there |
| Change strategist prompt assembly or prompt append behavior | [src/plugin-handlers/strategist-agent-config-builder.ts](src/plugin-handlers/strategist-agent-config-builder.ts) | Strategist is assembled partly outside `src/agents` |
| Change closure protocol appended to prompts | [src/shared/closure-protocol.ts](src/shared/closure-protocol.ts) | It is injected after prompt construction |
| Change prompt override / prompt_append behavior | `src/agents/builtin-agents/agent-overrides.ts` | Override merge logic lives there |
| Change environment context appended to prompts | `src/agents/builtin-agents/environment-context.ts` | Runtime environment prompt injection lives there |
| Change skill discovery source defaults | [src/config/schema/skill-discovery.ts](src/config/schema/skill-discovery.ts), [src/plugin/skill-discovery-config.ts](src/plugin/skill-discovery-config.ts) | Controls opt-in external skill folders |
| Change skill source loading behavior | [src/plugin/skill-context.ts](src/plugin/skill-context.ts), [src/plugin-handlers/command-config-handler.ts](src/plugin-handlers/command-config-handler.ts) | Skills and skill-backed commands must stay aligned |
| Change MCP defaults | [src/mcp/registry.ts](src/mcp/registry.ts) | Default MCP wiring lives there |
| Change OpenCode MCP assembly | [src/mcp/index.ts](src/mcp/index.ts) | Final MCP config assembly lives there |
| Change local MCP helper launcher logic | `assets/mcp/*` | Runtime launcher scripts live there |
| Change npm bootstrap behavior for MCP/LSP tools | [assets/runtime/npm-package-runner.mjs](assets/runtime/npm-package-runner.mjs) | Shared npm bootstrap logic lives there |
| Change LSP defaults | [src/config/defaults.ts](src/config/defaults.ts) | LSP defaults live there |

## Prompting Layout

Prompting is layered.

### Layer 1: Agent Factory Entry

These decide the high-level config object for each agent:

- Bob: `src/agents/bob/*`
- Coder: `src/agents/coder/*`
- Strategist: `src/agents/strategist/*`
- Manager: `src/agents/manager/*`
- Critic: `src/agents/critic/*`
- Vision: [src/agents/ui.ts](src/agents/ui.ts)
- Researcher: [src/agents/researcher.ts](src/agents/researcher.ts)

### Layer 2: Model-Specific Prompt Variants

Examples:

- Bob: `src/agents/bob/claude.ts`, `src/agents/bob/gpt.ts` (model routing via index.ts)
- Coder: `src/agents/coder/agent.ts`, `src/agents/coder/core.ts` (model routing via index.ts)
- Strategist: `src/agents/strategist/index.ts` (mode variants via sub-directory files)
- Manager: `src/agents/manager/agent.ts`, `src/agents/manager/default.ts`, `src/agents/manager/default-prompt-sections.ts`

### Layer 3: Shared Prompt Sections

These are the reusable policy/prompt building blocks:

- `src/agents/prompt-library/*`
- `src/agents/dynamic-agent-prompt-builder.ts`
- `src/agents/dynamic-agent-policy-sections.ts`

### Layer 3.5: Runtime Prompt Injection

Prompt content can also be appended after the source prompt is built:

- `src/agents/builtin-agents/agent-overrides.ts`
- `src/agents/builtin-agents/environment-context.ts`
- [src/shared/closure-protocol.ts](src/shared/closure-protocol.ts)
- [src/plugin-handlers/strategist-agent-config-builder.ts](src/plugin-handlers/strategist-agent-config-builder.ts)

### Layer 4: Runtime Assembly

This is where names, visibility, descriptions, and compatibility are normalized:

- [src/plugin-handlers/agent-config-handler.ts](src/plugin-handlers/agent-config-handler.ts)

If an agent prompt seems correct in source but wrong in runtime, inspect layer 4 first.

## Prompting Truth Model

Do not treat `src/agents` as the only source of truth for the final runtime prompt.

The correct model is:

1. `src/agents` is the main prompt authoring layer
2. shared prompt-library and dynamic-agent files contribute reusable sections
3. runtime injections can append or alter the prompt after source construction
4. plugin handlers can still change final runtime behavior, naming, visibility, and descriptions

So:

- `src/agents` is the main source of authored prompts
- it is not the only source of final runtime prompting

## MCP Rules

Default MCP wiring lives in:

- [src/mcp/registry.ts](src/mcp/registry.ts)

OpenCode MCP config assembly lives in:

- [src/mcp/index.ts](src/mcp/index.ts)

Runtime helper assets live in:

- [assets/mcp](assets/mcp)
- [assets/runtime](assets/runtime)

Current MCP set:

- `sequential-thinking`
- `mempalace`
- `stitch`
- `context7`
- `grep_app`

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

- MemPalace decision hygiene: search first, deduplicate, write only durable decisions and important preferences.
- Architecture memory updates: when architecture changes, update MemPalace.
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

Use [.env.example](.env.example) as the canonical key template for local setup and release checks.

Model provider credentials are configured through OpenCode Connect. Do not ask users to put `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY` into `hiai-opencode.json` for normal model usage. The plugin stores model IDs only.

Common service keys:

- `STITCH_AI_API_KEY` (MCP)
- `FIRECRAWL_API_KEY` (CLI skill, not MCP)
- `CONTEXT7_API_KEY` (MCP)
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`
- `MEMPALACE_PYTHON` (MCP)
- `MEMPALACE_PALACE_PATH` (MCP)

- `HIAI_MCP_AUTO_INSTALL`
- `HIAI_OPENCODE_AUTO_EXPORT_MCP`
- `HIAI_OPENCODE_MCP_EXPORT_PATH`
- `HIAI_OPENCODE_EXPORT_MCP_MODE`

## Mental Map

Agent/MCP/LSP integration reference — which agents use which integrations:

```
AGENTS:
  bob (you)        — orchestrator
  coder            — implementation (deep)
  sub              — implementation (cheap, bounded)
  strategist       — planning (read-only, no code)
  critic           — review gate (APPROVED/REJECTED)
  researcher       — discovery: local grep + Context7/Firecrawl/grep_app/MemPalace
  designer         — UI via Stitch MCP, design systems from open-design
  writer     — copy/positioning/SEO (write to copy files only)
  vision           — PDF/image extraction
  manager          — MemPalace memory steward
  quality-guardian — post-impl review + bug investigation
  agent-skills      — skill registry, discovery

MCP INTEGRATIONS (who uses what):
  Stitch              -> designer (UI generation) [MCP]
  Context7            -> researcher, coder (lib docs) [MCP]
  grep_app            -> researcher (OSS code patterns) [MCP]
  MemPalace           -> manager (primary), all agents (search before answer) [MCP]
  Sequential-Thinking -> strategist, critic (deep reasoning) [MCP]

CLI SKILLS (not MCP):
  Firecrawl           -> researcher (web scraping, crawl, extract, search)

LSP:
  typescript, svelte, eslint, bash, pyright
  -> coder MUST run lsp_diagnostics after every edit
```

## Known Runtime Caveats

Windows/OpenCode may fail to spawn local MCP processes with `EPERM` for `cmd` or `node`. When that happens:

- the plugin definition may still be correct
- the host runtime is the remaining blocker

This most often affects:

- `sequential-thinking`
- `mempalace`
- local `npx`-backed MCP processes

## Closure Protocol

All agents MUST wrap their final response in a structured `<CLOSURE>` block. This is injected into every agent prompt via `buildAgentIdentitySection()` in [src/agents/prompt-library/identity.ts](src/agents/prompt-library/identity.ts).

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
| `accept` | Reviewer approved the proposed changes | Critic, Quality Guardian |
| `reject` | Reviewer denied the changes with feedback | Critic, Quality Guardian |

**WARNING**: Responses without a valid `<CLOSURE>` block will be automatically REJECTED by the system.

### Relationship to `<promise>DONE</promise>`

The ralph-loop and ULW loop continuation systems use `<promise>DONE</promise>` as their signal to stop iterating. This is separate from `<CLOSURE>`:

- `<CLOSURE>` — task completion marker, required on every agent response
- `<promise>DONE</promise>` — ralph-loop/ULW loop continuation signal, stops the loop when emitted

Both can appear together; they do not conflict. The closure validator lives in [src/shared/closure-protocol.ts](src/shared/closure-protocol.ts).

### When to Inspect Closure Injection

If an agent response is missing `<CLOSURE>` at runtime but the source prompts look correct, check in order:

1. Does the agent factory call `buildAgentIdentitySection()`? (located in [src/agents/prompt-library/identity.ts](src/agents/prompt-library/identity.ts))
2. Does `src/shared/closure-protocol.ts` export the correct `CLOSURE_SCHEMA_PROMPT`?
3. Does `src/agents/builtin-agents/agent-overrides.ts` or [src/plugin-handlers/agent-config-handler.ts](src/plugin-handlers/agent-config-handler.ts) strip or override the closure injection?

## Troubleshooting

### `hiai-opencode doctor` reports schema errors

1. Run `hiai-opencode doctor` and look for the specific missing or unknown key
2. Check your `hiai-opencode.json` against the schema in [config/hiai-opencode.schema.json](config/hiai-opencode.schema.json)
3. Verify all keys in `models`, `mcp`, and `skill_discovery` match documented shapes
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

Or set it in `.env` in your project root. Firecrawl is NOT configured via `hiai-opencode.json` MCP section.

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

### MemPalace MCP fails with "python not found"

The launcher prefers `uv`. If `uv` is not available, it falls back to `python`. Set `mcp.mempalace.pythonPath` or `MEMPALACE_PYTHON` to the correct interpreter:

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

The final runtime prompt is assembled from multiple layers beyond `src/agents/`:

1. Source prompt in `src/agents/<agent>/*.ts`
2. Model-specific variant in `src/agents/<agent>/<model>.ts`
3. Shared prompt-library blocks in `src/agents/prompt-library/*`
4. Runtime injection from `src/agents/builtin-agents/agent-overrides.ts` and `src/agents/builtin-agents/environment-context.ts`
5. Closure protocol from `src/shared/closure-protocol.ts`
6. Plugin handler normalization in [src/plugin-handlers/agent-config-handler.ts](src/plugin-handlers/agent-config-handler.ts)

Inspect layer 6 first when runtime output diverges from source.

## Common Pitfalls

### Installing MCP server packages as OpenCode plugins

MCP servers (`@modelcontextprotocol/server-sequential-thinking`, `@upstash/context7-mcp`) are NOT OpenCode plugins. Adding them to the `plugin` array in `opencode.json` will not work. Note: Firecrawl is a CLI skill, not an MCP server.

Register only `@hiai-gg/hiai-opencode` as a plugin. MCP wiring is handled through the `mcp` object in `hiai-opencode.json`.

### Inventing model ID prefixes

When users ask which model to choose, tell them to run `opencode models` and copy the exact `provider/model-id` strings from that output into `hiai-opencode.json`. Do not invent prefixes like `openrouter/minimax/` — the provider prefix must match what OpenCode Connect has authorized.

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

## Prompt Ownership

For contributor-level detail on how prompts are assembled from source through runtime injection, see [src/agents/AGENTS.md](src/agents/AGENTS.md).

## Root Documentation Policy

Root docs should stay minimal and non-duplicative.

Keep:

- `README.md`: install, configure, use
- `AGENTS.md`: agent/tooling operator instructions
- `ARCHITECTURE.md`: internals and modification map
- `LICENSE.md`: licensing and attribution

Avoid reintroducing extra root docs that duplicate one of those roles.
