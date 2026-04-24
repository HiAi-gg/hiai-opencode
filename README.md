# hiai-opencode

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

Then run opencode debug config and opencode mcp list --print-logs --log-level INFO if available.
```

For the full operator playbook, see [AGENTS.md](AGENTS.md). 🤖

## What You Get

- Visible primary agents: `Bob`, `Coder`, `Strategist`, `Guard`, `Critic`, `Designer`, `Researcher`, `Manager`, `Brainstormer`, `Vision`
- Hidden system or compatibility agents: `Agent Skills`, `Sub`, `build`, `plan`
- Task routing model:
  - category-based execution routes through `Coder`
  - `quick`, `writing`, and `unspecified-low` are the fast bounded Coder contour
  - `deep`, `ultrabrain`, `visual-engineering`, `artistry`, and `unspecified-high` are the deep Coder contour
  - `Critic` and `Researcher` are selected explicitly
  - `Designer`, `Brainstormer`, `Manager`, and `Vision` are direct callable specialists
- Skill materialization into OpenCode's `skills/` view
- MCP wiring for `playwright`, `stitch`, `sequential-thinking`, `firecrawl`, `rag`, `mempalace`, `context7`, plus remote `websearch` and `grep_app`
- LSP wiring for TypeScript, Svelte, Python, Bash, and ESLint

## Requirements

Minimum:

- OpenCode installed
- Node.js 18+
- Bun 1.1+

Usually required:

- `OPENROUTER_API_KEY` if you use the default model presets

Optional, depending on which services you want:

- `FIRECRAWL_API_KEY` for Firecrawl
- `STITCH_AI_API_KEY` for Stitch
- `CONTEXT7_API_KEY` for Context7
- Python 3.9+ or `uv` for MemPalace
- a running RAG endpoint if you enable `rag`
- local language servers if you want LSP beyond the npm-bootstrapped helpers

## Install

Recommended native OpenCode install:

```bash
opencode plugin @hiai-gg/hiai-opencode@latest --global
```

Optional DCP plugin:

```bash
opencode plugin @tarquinen/opencode-dcp@latest --global
```

Manual config alternative:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@hiai-gg/hiai-opencode"]
}
```

Then start OpenCode:

```bash
opencode
```

Direct npm install is only needed for development or inspection:

```bash
npm install @hiai-gg/hiai-opencode
```

For local development:

```bash
git clone https://github.com/HiAi-gg/hiai-opencode.git
cd hiai-opencode
bun install
bun run build
```

## Register The Plugin In OpenCode

Use the OpenCode plugin CLI:

```bash
opencode plugin @hiai-gg/hiai-opencode@latest --global
```

If you also want Dynamic Context Pruning, install its separate plugin next:

```bash
opencode plugin @tarquinen/opencode-dcp@latest --global
```

If you prefer manual config, add the plugin package to your OpenCode config. OpenCode installs npm plugins automatically at startup.

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@hiai-gg/hiai-opencode"]
}
```

The packaged minimal example lives in [config/opencode.json](config/opencode.json).

The richer example config lives in [hiai-opencode.json](hiai-opencode.json).

Do not put MCP server packages such as `firecrawl-mcp`, `@playwright/mcp`, or `@modelcontextprotocol/server-sequential-thinking` into the OpenCode `plugin` array. They are MCP servers, not OpenCode plugins. `hiai-opencode` only provides the OpenCode-side launch wiring for them through its `mcp` config and helper launchers.

## Quick Start

```bash
git clone https://github.com/HiAi-gg/hiai-opencode.git
cd hiai-opencode
bun install
bun run build
```

Register the plugin in OpenCode:

```bash
opencode plugin @hiai-gg/hiai-opencode@latest --global
```

Optional:

```bash
opencode plugin @tarquinen/opencode-dcp@latest --global
```

Manual equivalent:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@hiai-gg/hiai-opencode"]
}
```

Project-level service config goes in `hiai-opencode.json` at the project root or under `.opencode/`:

```json
{
  "mcp": {
    "playwright": { "enabled": true },
    "sequential-thinking": { "enabled": true },
    "firecrawl": { "enabled": true },
    "mempalace": { "enabled": true },
    "rag": { "enabled": false },
    "stitch": { "enabled": false },
    "context7": { "enabled": true }
  }
}
```

Then verify:

```bash
opencode debug config
opencode mcp list --print-logs --log-level INFO
```

## Post-Install Bootstrap Prompt

After installing the plugin, you can ask OpenCode to finish local setup with this prompt:

```text
Inspect this OpenCode workspace and finish hiai-opencode setup.

Do not add MCP server packages to the OpenCode plugin list. Keep OpenCode plugins separate from MCP servers.

Check that @hiai-gg/hiai-opencode is registered. If Dynamic Context Pruning is requested, install @tarquinen/opencode-dcp as a separate OpenCode plugin.

Find or create hiai-opencode.json in the project root or .opencode/. Use its mcp object as the single switchboard for enabling or disabling MCP services.

Enable only services that can run on this machine:
- playwright: requires node/npx; optionally set HIAI_PLAYWRIGHT_INSTALL_BROWSERS=1 before first run if browser binaries are needed.
- sequential-thinking: requires node/npx.
- firecrawl: requires FIRECRAWL_API_KEY.
- mempalace: requires uv or Python 3.9+ with pip; set MEMPALACE_PYTHON if needed. Leave HIAI_MCP_AUTO_INSTALL enabled unless the user forbids package installation.
- rag: requires OPENCODE_RAG_URL or a running local endpoint at http://localhost:9002/tools/search.
- stitch: requires STITCH_AI_API_KEY.
- context7: works without a key but use CONTEXT7_API_KEY if available.

Check .env.example, report missing keys without printing secret values, and never invent or hardcode API keys.

Run verification commands where available:
- opencode debug config
- opencode mcp list --print-logs --log-level INFO

If a dependency is missing, install only user-level or project-local dependencies, explain every command before running it, and do not use sudo/admin rights unless the user explicitly asks.
```

## Where To Change Things

### Models

Model presets and role guidance:

- [src/config/models.ts](src/config/models.ts)

Runtime defaults for agents, categories, MCP, LSP:

- [src/config/defaults.ts](src/config/defaults.ts)

User-facing example config:

- [hiai-opencode.json](hiai-opencode.json)

If you want to change which model a specific agent uses by default, edit `src/config/defaults.ts`.

If you want to change the shared preset values like `fast`, `mid`, `high`, `vision`, or `reasoning`, edit `src/config/models.ts`.

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

Name mapping and visibility:

- [src/shared/agent-display-names.ts](src/shared/agent-display-names.ts)
- [src/plugin-handlers/agent-config-handler.ts](src/plugin-handlers/agent-config-handler.ts)

### Skills

Project skill definitions live under:

- [skills](skills)

Skill materialization logic:

- [src/features/builtin-skills/materialize.ts](src/features/builtin-skills/materialize.ts)

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

Important keys:

- `OPENROUTER_API_KEY`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `DEEPSEEK_API_KEY`
- `GLM_API_KEY`
- `MINIMAX_API_KEY`
- `QWEN_API_KEY`
- `STITCH_AI_API_KEY`
- `FIRECRAWL_API_KEY`
- `CONTEXT7_API_KEY`
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`
- `MEMPALACE_PYTHON`

Use [.env.example](.env.example) as the reference template. Create a local `.env` in your OpenCode environment or export these variables in your shell before startup.

## MCP Service Notes

The user-facing MCP switchboard is the `mcp` object in `hiai-opencode.json`:

```json
{
  "mcp": {
    "playwright": { "enabled": true },
    "mempalace": { "enabled": false }
  }
}
```

The source of truth for default MCP wiring is `src/mcp/registry.ts`. Change that file when adding a new MCP integration or changing its launch command, required env vars, or install strategy.

### Works well as remote MCP

- `stitch`
- `context7`
- `websearch`
- `grep_app`

### Works with local helper bootstrap

- `playwright`: launches `@playwright/mcp@latest` through the helper npm runner. Set `HIAI_PLAYWRIGHT_INSTALL_BROWSERS=1` if you want the launcher to install Chromium on first start.
- `sequential-thinking`: launches `@modelcontextprotocol/server-sequential-thinking` through the helper npm runner.
- `firecrawl`: launches `firecrawl-mcp` through the helper npm runner and requires `FIRECRAWL_API_KEY`.

### Needs upstream runtime or extra setup

- `mempalace`: prefers `uv`; otherwise uses Python. If `HIAI_MCP_AUTO_INSTALL` is not `0`, `false`, or `no`, the launcher can run `python -m pip install --user mempalace` on first start.
- `rag`: requires your own running endpoint

### Additional OpenCode Plugin

`opencode-dcp` is a separate OpenCode plugin, not an MCP server:

```bash
opencode plugin @tarquinen/opencode-dcp@latest --global
```

### Important Windows note

On some Windows/OpenCode environments, local MCP process spawning can fail with `EPERM` for `cmd` or `node`. If you see that:

- the plugin config is likely correct
- the remaining issue is the host runtime's local process spawn behavior

This most often affects `sequential-thinking` and `mempalace`, and sometimes local `npx`-backed tools.

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
4. verify `mcp list`

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
