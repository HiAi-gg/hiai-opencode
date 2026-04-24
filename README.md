# hiai-opencode

`hiai-opencode` is an OpenCode plugin that bundles:

- a curated multi-agent runtime
- project and built-in skills
- MCP integrations
- LSP defaults
- migration and compatibility wiring

This repository is intended to be usable by someone who clones it from GitHub without any internal context.

## What You Get

- Visible primary agents: `Bob`, `Coder`, `Strategist`, `Guard`, `Critic`, `Designer`, `Researcher`, `Manager`, `Brainstormer`, `Vision`
- Hidden system or compatibility agents: `Agent Skills`, `Sub`, `build`, `plan`
- Task routing model:
  - category-based execution routes through `Coder`
  - `quick`, `writing`, and `unspecified-low` are the fast bounded Coder contour
  - `deep`, `ultrabrain`, `visual-engineering`, `artistry`, and `unspecified-high` are the deep Coder contour
  - `Critic` and `Researcher` are selected explicitly
  - `Designer`, `Brainstormer`, `Manager`, and `Vision` are direct callable specialists
- Built-in skill materialization into OpenCode's `skills/` view
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

From npm, once published:

```bash
npm install hiai-opencode
```

From GitHub:

```bash
npm install github:HiAi-gg/hiai-opencode
```

For local development:

```bash
git clone https://github.com/HiAi-gg/hiai-opencode.git
cd hiai-opencode
bun install
bun run build
```

## Register The Plugin In OpenCode

Add this to your OpenCode config:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["hiai-opencode"]
}
```

The packaged minimal example lives in [config/opencode.json](config/opencode.json).

The richer example config lives in [hiai-opencode.json](hiai-opencode.json).

## Quick Start

```bash
git clone https://github.com/HiAi-gg/hiai-opencode.git
cd hiai-opencode
bun install
bun run build
```

Register the plugin in OpenCode:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["hiai-opencode"]
}
```

Then verify:

```bash
opencode debug config
opencode mcp list --print-logs --log-level INFO
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

Packaged project skills live under:

- [skills](skills)

Built-in skill materialization logic:

- [src/features/builtin-skills/materialize.ts](src/features/builtin-skills/materialize.ts)

### MCP

Default MCP definitions:

- [src/config/defaults.ts](src/config/defaults.ts)

Fallback MCP assembly:

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

### Works well as remote MCP

- `stitch`
- `context7`
- `websearch`
- `grep_app`

### Works with local helper bootstrap

- `playwright`

### Needs upstream runtime or extra setup

- `mempalace`: requires `uv` or Python with `mempalace` installed
- `firecrawl`: requires `FIRECRAWL_API_KEY`
- `rag`: requires your own running endpoint
- `sequential-thinking`: uses upstream stdio launch

### Important Windows note

On some Windows/OpenCode environments, local MCP process spawning can fail with `EPERM` for `cmd` or `node`. If you see that:

- the plugin config is likely correct
- the remaining issue is the host runtime's local process spawn behavior

This most often affects `sequential-thinking` and `mempalace`, and sometimes local `npx`-backed tools.

## Optional External Plugin

`opencode-dcp` is intentionally not bundled.

Install it separately if you want it:

```bash
opencode plugin @tarquinen/opencode-dcp@latest --global
```

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
2. verify OpenCode loads the plugin
3. verify `debug config`
4. verify `mcp list`

## Documentation Map

- [AGENTS.md](AGENTS.md): instructions for autonomous agents or tooling that need to install or modify the plugin
- [ARCHITECTURE.md](ARCHITECTURE.md): runtime wiring, prompting layers, and modification map
- [LICENSE.md](LICENSE.md): licensing and attribution
