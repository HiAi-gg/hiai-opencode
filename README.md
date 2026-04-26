# hiai-opencode

[![CI](https://github.com/HiAi-gg/hiai-opencode/actions/workflows/ci.yml/badge.svg)](https://github.com/HiAi-gg/hiai-opencode/actions/workflows/ci.yml)

`hiai-opencode` is an OpenCode plugin that wires together:

- a curated multi-agent runtime
- project and OpenCode skills
- MCP integrations
- LSP defaults
- migration and compatibility wiring

This repository is intended to be usable by someone who clones it from GitHub without any internal context.
The external MCP servers, skills, model providers, and auxiliary OpenCode plugins remain their own upstream projects; this plugin only provides OpenCode wiring, defaults, prompts, launchers, and documentation around them.

## Why This Exists

I wanted the "one install, give me the whole cockpit" setup. More agents, more MCP servers, more skills, better defaults, fewer tiny config islands. 🚀

The problem: all those great tools do not magically become friends just because you installed them. Some are npm packages, some are Python tools, some need API keys, some need a local service, and some only wake up after the first run. Meanwhile your main agent can waste half the context window just reading everything you bolted on. Not chill. 😅

So `hiai-opencode` is my attempt to wire the best pieces I use into one OpenCode-friendly shape: agents, prompts, skills, MCP launchers, LSP defaults, and a clean config surface. It does not claim ownership of the upstream tools. It just tries to make them cooperate.

After the first install, a few MCP services may still need local dependencies or keys. You have two options:

- Follow the setup sections below: [Install](#install), [Environment](#environment), and [MCP Service Notes](#mcp-service-notes).
- Or ask OpenCode to do the boring part for you. Paste this after installing:

```text
Read AGENTS.md and finish hiai-opencode setup for this workspace.

Keep OpenCode plugins separate from MCP servers. Do not add MCP server packages to the OpenCode plugin list.

Check which MCP services can run on this machine, update hiai-opencode.json, install only missing user-level or project-local dependencies, and report missing API keys without printing secret values.

Then run `hiai-opencode doctor`, `hiai-opencode mcp-status`, and `opencode debug config`.
```

For the full operator playbook, see [AGENTS.md](AGENTS.md). 🤖

## Agents

| Agent | Role | When to use |
|-------|------|-------------|
| `Bob` | Orchestrator, router, distributor | Entry point; complex tasks needing multi-agent coordination |
| `Coder` | Deep implementation, focused execution | Complex features, refactors, deep work |
| `Sub` | Bounded cheap executor | Small targeted changes, quick fixes |
| `Strategist` | Planning, architecture, pre-check | Scope definition, architectural decisions |
| `Guard` | Final acceptor, workflow enforcer | Closure validation, output acceptance |
| `Critic` | Review gate, high-accuracy verification | Plan review, code review, regression catch |
| `Researcher` | Local + external search | Codebase exploration, documentation discovery |
| `Designer` | UI/visual, creative direction | Visual problems, UX decisions, branding |
| `Brainstormer` | Ideation, content, copy | Landing pages, CTA, feature copy, onboarding |
| `Vision` | Image/PDF/layout analysis | Visual inspection, multimodal interpretation |
| `Manager` | Memory, bootstrap, ledger | Durable state, session continuity, project init |

## Modes (Task Routing)

Mode determines prompt append, variant, and reasoning effort. The executor agent is selected via `mode → agent` mapping.

| Mode | Agent | Prompt variant | When to use |
|------|-------|----------------|-------------|
| `quick` | `sub` | Fast bounded | Small targeted changes |
| `writing` | `brainstormer` | Docs/prose | Content, i18n, copy |
| `deep` | `coder` | Deep reasoning | Complex implementation |
| `ultrabrain` | `strategist` | Plan-only | Architecture, hard logic |
| `visual-engineering` | `designer` | UI/visual | Visual problems |
| `artistry` | `designer` | Creative | Brand, SEO, creative |
| `git` | `platform-manager` | Git ops | Version control operations |
| `bounded` | `sub` | Mid-tier bounded | Moderate effort changes |
| `cross-module` | `coder` | Deep substantial | Multi-component changes |

## What You Get

- **10 visible primary agents** + **4 hidden system agents** (Agent Skills, Sub, build, plan)
- **Mode-based task routing** via `task(category=..., ...)` or `task(mode=..., ...)`
- Skill materialization into OpenCode's `skills/` view
- MCP wiring for `playwright`, `stitch`, `sequential-thinking`, `firecrawl`, `rag`, `mempalace`, `context7`, plus remote `websearch` and `grep_app`
- LSP wiring for TypeScript, Svelte, Python, Bash, and ESLint

## Requirements

Minimum:

- OpenCode installed
- Node.js 18+
- Bun 1.1+

Usually required:

- at least one model provider connected in OpenCode for the model IDs you configure

Optional, depending on which services you want:

- `FIRECRAWL_API_KEY` for Firecrawl
- `STITCH_AI_API_KEY` for Stitch
- `CONTEXT7_API_KEY` for Context7
- `EXA_API_KEY` for higher Exa websearch limits
- `TAVILY_API_KEY` when `mcp.websearch.provider` is `tavily`
- Python 3.9+ or `uv` for MemPalace
- a running RAG endpoint if you enable `rag`
- local language servers if you want LSP beyond the npm-bootstrapped helpers

## Install

### 1. Register the OpenCode plugin

```bash
opencode plugin @hiai-gg/hiai-opencode@latest --global
```

Optional Dynamic Context Pruning plugin:

```bash
opencode plugin @tarquinen/opencode-dcp@latest --global
```

Do not put MCP server packages such as `firecrawl-mcp`, `@playwright/mcp`, or `@modelcontextprotocol/server-sequential-thinking` into the OpenCode `plugin` array. They are MCP servers, not OpenCode plugins. `hiai-opencode` only provides the OpenCode-side launch wiring for them through its `mcp` config and helper launchers.

Manual OpenCode config equivalent:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@hiai-gg/hiai-opencode"]
}
```

The packaged minimal OpenCode example lives in [config/opencode.json](config/opencode.json).

### 2. Create project config

Create a project-level config file at `hiai-opencode.json` in the project root or at `.opencode/hiai-opencode.json`.

Bash:

```bash
mkdir -p .opencode
cp hiai-opencode.json .opencode/hiai-opencode.json
```

PowerShell:

```powershell
New-Item -ItemType Directory -Force .opencode
Copy-Item .\hiai-opencode.json .\.opencode\hiai-opencode.json
```

If you installed only from npm/OpenCode and do not have this repository checked out, create `.opencode/hiai-opencode.json` with the shape below and adjust it later.

```json
{
  "models": {
    "bob": { "model": "openrouter/moonshotai/kimi-k2.6", "recommended": "xhigh" },
    "coder": { "model": "openrouter/minimax/minimax-m2.7", "recommended": "high" },
    "strategist": { "model": "openrouter/anthropic/claude-opus-latest", "recommended": "high" },
    "guard": { "model": "openrouter/qwen/qwen3.6-plus", "recommended": "middle" },
    "critic": { "model": "openrouter/xiaomi/mimo-v2.5-pro", "recommended": "high" },
    "designer": { "model": "openrouter/google/gemini-3.1-pro-preview", "recommended": "design" },
    "researcher": { "model": "openrouter/deepseek/deepseek-v4-flash", "recommended": "fast" },
    "manager": { "model": "openrouter/qwen/qwen3.5-9b", "recommended": "fast" },
    "brainstormer": { "model": "openrouter/mistralai/mistral-small-2603", "recommended": "writing" },
    "vision": { "model": "openrouter/google/gemma-4-26b-a4b-it", "recommended": "vision" }
  },
  "mcp": {
    "playwright": { "enabled": true },
    "sequential-thinking": { "enabled": true },
    "firecrawl": { "enabled": true },
    "mempalace": { "enabled": true, "pythonPath": "{env:MEMPALACE_PYTHON:-./.venv/bin/python}" },
    "rag": { "enabled": false },
    "stitch": { "enabled": false },
    "context7": { "enabled": true }
  }
}
```

By default, skill discovery is deterministic: `hiai-opencode` skills plus project-local `.opencode/skills` only. Global Claude/OpenCode/Agents skill folders are opt-in.

### 3. Connect models and add service keys

Model provider credentials belong to OpenCode Connect, not to `hiai-opencode`.
This plugin only reads the 10 model IDs in `models`. Internal routing derives hidden agents and task categories from those 10 choices.

Use OpenCode Connect to authorize the providers behind your configured model IDs. Then add only the service keys for MCP or search integrations you actually use:

```bash
opencode models
```

Use the exact model IDs printed by OpenCode in `hiai-opencode.json`. For example, `openrouter/minimax/minimax-m2.7` routes through OpenRouter, while `minimax/minimax-m2.7` routes through a direct Minimax provider only if that provider is connected in OpenCode.

```bash
export FIRECRAWL_API_KEY=...
export STITCH_AI_API_KEY=...
export CONTEXT7_API_KEY=...
export EXA_API_KEY=...
# or, if mcp.websearch.provider is "tavily":
export TAVILY_API_KEY=...
```

See [Environment Variables And Keys](#environment-variables-and-keys) for the full list.

### 4. Start and verify

```bash
opencode
hiai-opencode doctor
hiai-opencode mcp-status
hiai-opencode export-mcp .mcp.json
opencode debug config
opencode mcp list --print-logs --log-level INFO
```

`opencode mcp list` reads static `.mcp.json` files in many OpenCode versions. Runtime MCP servers launched by plugins may work but not appear there. If you want `opencode mcp list` visibility, run `hiai-opencode export-mcp .mcp.json` first.

`hiai-opencode mcp-status` is the fastest visibility check. It does not change OpenCode config; it reports config location, enabled MCP services, missing keys, and basic local runtime availability.

`hiai-opencode doctor` is the broader install/runtime diagnostic. It includes MCP status, static `.mcp.json` freshness, OpenCode Connect visibility, skill materialization, agent naming/count checks, LSP runtime checks, MemPalace Python source selection, and real MCP tool probes.

## Development Install

Direct npm install is only needed for development or inspection:

```bash
npm install @hiai-gg/hiai-opencode
```

Local development:

```bash
git clone https://github.com/HiAi-gg/hiai-opencode.git
cd hiai-opencode
bun install
bun run build
```

## Post-Install Bootstrap Prompt

After installing the plugin, you can ask OpenCode to finish local setup with this prompt:

```text
Inspect this OpenCode workspace and finish hiai-opencode setup.

Do not add MCP server packages to the OpenCode plugin list. Keep OpenCode plugins separate from MCP servers.

Check that @hiai-gg/hiai-opencode is registered. If Dynamic Context Pruning is requested, install @tarquinen/opencode-dcp as a separate OpenCode plugin.

Find or create hiai-opencode.json in the project root or .opencode/. Use its mcp object as the single switchboard for enabling or disabling MCP services.

Keep skill discovery deterministic unless I explicitly ask for external skills. Leave global_opencode, project_claude, global_claude, project_agents, and global_agents disabled by default.

Enable only services that can run on this machine:
- playwright: requires node/npx; optionally set HIAI_PLAYWRIGHT_INSTALL_BROWSERS=1 before first run if browser binaries are needed.
- sequential-thinking: requires node/npx.
- firecrawl: requires FIRECRAWL_API_KEY.
- mempalace: requires uv or Python 3.9+ with pip; set `mcp.mempalace.pythonPath` (or `MEMPALACE_PYTHON`) if needed. Leave `HIAI_MCP_AUTO_INSTALL` enabled unless the user forbids package installation.
- rag: requires OPENCODE_RAG_URL or a running local endpoint at http://localhost:9002/tools/search.
- stitch: requires STITCH_AI_API_KEY.
- context7: works without a key but use CONTEXT7_API_KEY if available.

Check .env.example, report missing keys without printing secret values, and never invent or hardcode API keys.

Run verification commands where available:
- opencode debug config
- hiai-opencode mcp-status
- hiai-opencode export-mcp .mcp.json
- opencode mcp list --print-logs --log-level INFO

If a dependency is missing, install only user-level or project-local dependencies, explain every command before running it, and do not use sudo/admin rights unless the user explicitly asks.
```

## Where To Change Things

### Models

Canonical user-facing config for 10 primary agent models, MCP/LSP switches, service auth placeholders, and skill discovery:

- [hiai-opencode.json](hiai-opencode.json)

Runtime loader for the bundled canonical config:

- [src/config/defaults.ts](src/config/defaults.ts)

If you want to change model selection, edit the 10 entries in `models`. Do not add category-specific model choices unless you are intentionally developing the plugin internals.

Use fully qualified model IDs. Do not introduce local aliases like `hiai-fast`, `sonnet`, `fast`, or `high`.
After connecting providers in OpenCode, run `opencode models` and copy the exact model IDs from that output into `hiai-opencode.json`.

### Prompting

Prompting has two main layers:

1. source prompt files in [src/agents](src/agents)
2. runtime assembly in [src/plugin-handlers/agent-config-handler.ts](src/plugin-handlers/agent-config-handler.ts)

Important prompt entrypoints:

- `Bob`: [src/agents/bob.ts](src/agents/bob.ts) and `src/agents/bob/*`
- `Coder`: `src/agents/coder/*`
- `Strategist`: `src/agents/strategist/*`
- `Guard`: `src/agents/guard/*`
- `Critic`: `src/agents/critic/*`
- `Vision`: [src/agents/ui.ts](src/agents/ui.ts)
- `Manager`: [src/agents/platform-manager.ts](src/agents/platform-manager.ts)
- `Researcher`: [src/agents/researcher.ts](src/agents/researcher.ts)
- `Brainstormer` / `Writer`: [src/agents/brainstormer.ts](src/agents/brainstormer.ts)

Name mapping and visibility:

- [src/shared/agent-display-names.ts](src/shared/agent-display-names.ts)
- [src/plugin-handlers/agent-config-handler.ts](src/plugin-handlers/agent-config-handler.ts)

### Skills

Project skill definitions live under:

- [skills](skills)

Skill materialization logic:

- [src/features/builtin-skills/materialize.ts](src/features/builtin-skills/materialize.ts)

Built-in helper skills include browser automation, frontend UI/UX, review, git workflow, hiai-opencode setup, AI slop cleanup, and `website-copywriting`.

Website/product copy should use:

```text
task(subagent_type="brainstormer", load_skills=["website-copywriting"], ...)
```

`writer`, `copywriter`, and `content-writer` are aliases for `brainstormer`.

Manager memory stewardship:

- Use `task(subagent_type="platform-manager", ...)` or `task(subagent_type="manager", ...)` for MemPalace cleanup, session ledgers, TODO hygiene, and architecture decision handoff.
- Manager writes only durable decisions and important project state. It should not dump raw chat logs into memory.
- RAG is retrieval-first by default; Manager syncs architecture summaries to RAG only when the configured endpoint exposes write/upsert capability.

Skill discovery defaults:

```json
{
  "skill_discovery": {
    "config_sources": true,
    "project_opencode": true,
    "global_opencode": false,
    "project_claude": false,
    "global_claude": false,
    "project_agents": false,
    "global_agents": false
  }
}
```

This keeps clean installs reproducible and avoids accidentally mixing Codex, Claude, Antigravity, and global OpenCode skill collections. To opt into external skill folders, enable the specific source you want instead of turning everything on.

### MCP

Default MCP registry:

- [src/mcp/registry.ts](src/mcp/registry.ts)

OpenCode MCP config assembly:

- [src/mcp/index.ts](src/mcp/index.ts)

Runtime helper launchers:

- [assets/mcp](assets/mcp)
- [assets/runtime](assets/runtime)

### LSP

LSP defaults are defined in:

- [src/config/defaults.ts](src/config/defaults.ts)

## Environment Variables And Keys

Model provider keys are handled by OpenCode Connect. Do not add `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY` to `hiai-opencode` config for normal model usage.

Important service variables:

- `STITCH_AI_API_KEY`
- `FIRECRAWL_API_KEY`
- `CONTEXT7_API_KEY`
- `EXA_API_KEY`
- `TAVILY_API_KEY`
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`
- `MEMPALACE_PYTHON`
- `MEMPALACE_PALACE_PATH`
- `OPENCODE_RAG_URL`
- `HIAI_PLAYWRIGHT_INSTALL_BROWSERS`
- `HIAI_MCP_AUTO_INSTALL`
- `HIAI_OPENCODE_AUTO_EXPORT_MCP`
- `HIAI_OPENCODE_MCP_EXPORT_PATH`

Optional headless or non-Connect fallback variables are documented in [.env.example](.env.example), but they are not required for normal OpenCode model auth.

Use [.env.example](.env.example) as the reference template. Create a local `.env` in your OpenCode environment or export these variables in your shell before startup.

## MCP Service Notes

The user-facing MCP switchboard is the `mcp` object in `hiai-opencode.json`:

```json
{
  "mcp": {
    "playwright": { "enabled": true },
    "mempalace": { "enabled": false },
    "websearch": { "enabled": true, "provider": "exa" },
    "grep_app": { "enabled": true }
  }
}
```

The source of truth for default MCP wiring is `src/mcp/registry.ts`. Change that file when adding a new MCP integration or changing its launch command, required env vars, or install strategy.

### Works well as remote MCP

- `stitch`
- `context7`
- `websearch`: defaults to Exa remote MCP. `EXA_API_KEY` is optional for Exa; set `"provider": "tavily"` and `TAVILY_API_KEY` to use Tavily.
- `grep_app`

### Works with local helper bootstrap

- `playwright`: launches `@playwright/mcp@latest` through the helper npm runner. Set `HIAI_PLAYWRIGHT_INSTALL_BROWSERS=1` if you want the launcher to install Chromium on first start.
- `sequential-thinking`: launches `@modelcontextprotocol/server-sequential-thinking` through the helper npm runner.
- `firecrawl`: launches `firecrawl-mcp` through the helper npm runner and requires `FIRECRAWL_API_KEY`.

### Playwright On Minimal Linux Hosts

`hiai-opencode mcp-status` can confirm that the Playwright MCP launcher is available, but it cannot guarantee that Chromium can start on a minimal Linux image.

Playwright has two dependency layers:

- Browser binary: install with `HIAI_PLAYWRIGHT_INSTALL_BROWSERS=1` before OpenCode starts, or run `npx playwright install chromium`.
- System libraries: if Chromium errors with missing packages like `libnspr4`, `libnss3`, `libatk-bridge`, or `libgtk-3`, install them with admin rights, usually `sudo npx playwright install-deps chromium`.

If sudo is not available:

- Use an already installed system browser by editing the Playwright command in `.opencode/hiai-opencode.json`, for example:

```json
{
  "mcp": {
    "playwright": {
      "enabled": true,
      "command": ["node", "{pluginRoot}/assets/mcp/playwright.mjs", "--browser", "chrome"],
      "timeout": 600000
    }
  }
}
```

- Try `--browser msedge` if Edge is installed.
- Use a remote/CDP browser or the `agent-browser`/`playwright-cli` skill path if those tools are installed.
- Use `curl` only as a degraded HTTP check. It does not replace browser interaction, screenshots, auth flows, or client-side app verification.

### Needs upstream runtime or extra setup

- `mempalace`: prefers `uv`; otherwise uses Python. You can force interpreter selection via `mcp.mempalace.pythonPath` or `MEMPALACE_PYTHON`. If `HIAI_MCP_AUTO_INSTALL` is not `0`, `false`, or `no`, the launcher can run `python -m pip install --user mempalace` on first start.
- `rag`: requires your own running endpoint

### Important Windows note

On some Windows/OpenCode environments, local MCP process spawning can fail with `EPERM` for `cmd` or `node`. If you see that:

- the plugin config is likely correct
- the remaining issue is the host runtime's local process spawn behavior

This most often affects `sequential-thinking` and `mempalace`, and sometimes local `npx`-backed tools.

## Diagnostics

The plugin now emits startup warnings for common misconfiguration, including:

- `.opencode/opencode.json` containing `plugin: ["list"]`
- enabled MCP integrations with missing required env vars such as `FIRECRAWL_API_KEY` or `STITCH_AI_API_KEY`

Available CLI:

```bash
hiai-opencode doctor
hiai-opencode mcp-status
hiai-opencode export-mcp .mcp.json
```

By default, the plugin auto-exports `.mcp.json` at workspace startup when the file is missing. This closes the visibility gap where runtime plugin MCP works but `opencode mcp list` only reads static files. Control it with:

```bash
export HIAI_OPENCODE_AUTO_EXPORT_MCP=if-missing  # default
export HIAI_OPENCODE_AUTO_EXPORT_MCP=always      # overwrite only managed hiai-opencode exports
export HIAI_OPENCODE_AUTO_EXPORT_MCP=force       # force overwrite even non-managed files
export HIAI_OPENCODE_AUTO_EXPORT_MCP=0           # disable auto-export
export HIAI_OPENCODE_MCP_EXPORT_PATH=.mcp.json   # override path
export HIAI_OPENCODE_EXPORT_MCP_MODE=safe        # export-mcp command mode: safe|force
```

Inside OpenCode, use the slash command:

```text
/doctor
/mcp-status
```

Example output:

```text
MCP Servers:
✅ playwright           - backend ok
⚠️  rag                 - enabled, http://localhost:9002/tools/search not reachable
✅ firecrawl            - backend ok
❌ mempalace            - python not found
⚠️  stitch              - enabled, API key missing (STITCH_AI_API_KEY)
```

`hiai-opencode export-mcp` writes a standard `.mcp.json` so hosts whose `mcp list` ignores plugin runtime MCP can still show the same servers statically. Exports are marker-tagged as hiai-managed; by default, the command avoids overwriting non-managed files unless `HIAI_OPENCODE_EXPORT_MCP_MODE=force` is set.

Use:

```bash
hiai-opencode mcp-status
hiai-opencode export-mcp .mcp.json
opencode debug config
opencode mcp list --print-logs --log-level INFO
```

## Core Components And Upstream Projects

`hiai-opencode` wires these projects and ideas into an OpenCode-friendly setup. Upstream projects remain independent; this table is attribution and orientation, not an ownership claim.

| Component | Upstream | Notes |
|---|---|---|
| OpenCode host/runtime | [anomalyco/opencode](https://github.com/anomalyco/opencode) | plugin host and runtime target |
| Core orchestration influences | [code-yeongyu/oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) | architectural influence |
| Planning / workflow influences | [obra/superpowers](https://github.com/obra/superpowers) | planning, review, and debugging ideas |
| Specialist / platform influences | [vtemian/micode](https://github.com/vtemian/micode) | platform-style specialist behavior |
| Agent skill ecosystem | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | tactical workflow skill ideas |
| Optional external plugin | [Opencode-DCP/opencode-dynamic-context-pruning](https://github.com/Opencode-DCP/opencode-dynamic-context-pruning) | installed separately |
| MemPalace | [MemPalace/mempalace](https://github.com/MemPalace/mempalace) | external MCP/runtime |
| Playwright MCP | [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) | external MCP |
| Sequential Thinking | [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) | external MCP |
| Firecrawl MCP | [firecrawl-ai/firecrawl-mcp-server](https://github.com/firecrawl-ai/firecrawl-mcp-server) | external MCP |
| Context7 MCP | [upstash/context7-mcp](https://github.com/upstash/context7-mcp) | external MCP |
| bun-pty / PTY ecosystem | [shekohex/opencode-pty](https://github.com/shekohex/opencode-pty) | PTY/runtime integration influence |

## Build And Publish

Build:

```bash
bun run build
```

Typecheck:

```bash
bun run typecheck
```

Prompt snapshots:

```bash
bun run prompts:measure
```

Before publishing:

1. run `bun run build`
2. run `npm pack --dry-run`
3. verify `debug config`
4. run `hiai-opencode export-mcp .mcp.json` if you need static `mcp list` visibility

Publish:

```bash
npm publish --access public
```

User install after publish:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@hiai-gg/hiai-opencode"]
}
```

## Documentation Map

- [AGENTS.md](AGENTS.md): instructions for autonomous agents or tooling that need to install or modify the plugin
- [ARCHITECTURE.md](ARCHITECTURE.md): runtime wiring, prompting layers, and modification map
- [LICENSE.md](LICENSE.md): licensing and attribution
