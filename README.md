# @hiai-gg/hiai-opencode

[![CI](https://github.com/HiAi-gg/hiai-opencode/actions/workflows/ci.yml/badge.svg?branch=main&event=push)](https://github.com/HiAi-gg/hiai-opencode/actions/workflows/ci.yml?query=branch%3Amain)
[![Release](https://img.shields.io/github/v/release/HiAi-gg/hiai-opencode?style=flat-square&logo=github)](https://github.com/HiAi-gg/hiai-opencode/releases/latest)
[![npm](https://img.shields.io/npm/v/@hiai-gg/hiai-opencode?style=flat-square&logo=npm)](https://www.npmjs.com/package/@hiai-gg/hiai-opencode)
[![npm downloads](https://img.shields.io/npm/dm/@hiai-gg/hiai-opencode?style=flat-square)](https://www.npmjs.com/package/@hiai-gg/hiai-opencode)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE.md)
[![GitHub stars](https://img.shields.io/github/stars/HiAi-gg/hiai-opencode?style=flat-square)](https://github.com/HiAi-gg/hiai-opencode/stargazers)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](CONTRIBUTING.md)
[![Bun](https://img.shields.io/badge/runtime-Bun-f9f1e1?style=flat-square&logo=bun)](https://bun.sh)
[![Node](https://img.shields.io/badge/node-%E2%89%A520-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![OpenCode](https://img.shields.io/badge/host-OpenCode-blue?style=flat-square)](https://opencode.ai)

Multi-agent orchestration plugin for OpenCode. 10 specialized agents, 30 hooks, BM25 FTS5 memory search, LSP diagnostics, agent-browser integration, completion controller, auto dream/distill memory consolidation. One prompt to set up and run.

---

## Install

```bash
opencode plugin @hiai-gg/hiai-opencode@latest --global
```

After installing, verify the plugin is registered:

```bash
opencode debug config
```

## Config

`hiai-opencode` uses two configuration files that ship with the plugin:

### 1. `bob.json` — Agent Models & Behaviour

This file ships as part of the plugin package and contains agent models, MCP settings, LSP configuration, and feature flags.

```jsonc
{
  "models": {
    "bob": { "model": "kimi-for-coding/k2p6", "recommended": "xhigh" },
    "coder": { "model": "minimax-coding-plan/MiniMax-M2.7", "recommended": "high" },
    "strategist": { "model": "deepseek/deepseek-v4-pro", "recommended": "high" },
    "manager": { "model": "opencode-go/qwen3.6-plus", "recommended": "middle" },
    "critic": { "model": "opencode-go/mimo-v2.5-pro", "recommended": "high" },
    "designer": { "model": "openrouter/google/gemini-3.1-pro-preview", "recommended": "design" },
    "researcher": { "model": "openrouter/deepseek/deepseek-v4-flash", "recommended": "fast" },
    "writer": { "model": "openrouter/mistralai/mistral-small-2603", "recommended": "writing" },
    "vision": { "model": "openrouter/google/gemma-4-26b-a4b-it", "recommended": "vision" }
  },
  "mcp": {
    "sequential-thinking": { "enabled": true },
    "mempalace": { "enabled": true, "pythonPath": "{env:MEMPALACE_PYTHON:-\./.venv/bin/python}" },
    "stitch": { "enabled": false },
    "context7": { "enabled": true },
    "grep_app": { "enabled": true }
  },
  "lsp": {
    "typescript": { "enabled": true },
    "svelte": { "enabled": true },
    "eslint": { "enabled": true },
    "pyright": { "enabled": true },
    "bash": { "enabled": true }
  },
  "completion": {
    "enabled": true,
    "max_auto_continues": 25,
    "require_critic": true
  },
  "dream": { "auto": true, "interval_days": 7 },
  "distill": { "auto": true, "interval_days": 30 },
  "telemetry": { "enabled": false, "serviceName": "hiai-opencode" }
}
```

### 2. Environment Variables — API Keys

API keys are loaded from multiple paths in priority order. Create a local `.env` file in your OpenCode environment or export these variables in your shell before starting OpenCode.

```bash
# Project root or .opencode/
STITCH_AI_API_KEY=your_stitch_key
FIRECRAWL_API_KEY=fc-your_key
CONTEXT7_API_KEY=ctx7-your_key
MEMPALACE_PYTHON=./.venv/bin/python
```

Use [.env.example](.env.example) as the canonical template.

## Agents

| Agent | Role | Mode | Visible |
|-------|------|------|---------|
| bob | Orchestrator — delegates, verifies. Never mutates files. | primary | ✅ |
| strategist | Principal Architect — deep planning, architecture analysis. | primary | ✅ |
| designer | UI/visual direction, design tokens, component specs. | primary | ✅ |
| writer | Content, copy, positioning, SEO specialist. | primary | ✅ |
| coder | Senior Staff Engineer — implements from plans. | subagent | hidden |
| researcher | Explore Agent — firecrawl + grep_app + context7. | subagent | hidden |
| manager | Coordinator — parallel wave execution. | subagent | hidden |
| critic | Quality Guardian — reviews, binary APPROVED/REJECTED. | subagent | hidden |
| vision | Browser operator + multimodal analysis. | subagent | hidden |
| sub | Cheap bounded executor — fast, simple tasks. | subagent | hidden |

### Mode-Based Task Routing

Mode determines which agent executes the task:

| Mode | Agent | When to use |
|------|-------|-------------|
| `quick` | coder (fast bounded) | Small targeted changes |
| `writing` | writer | Content, i18n, copy |
| `deep` | coder | Complex implementation |
| `ultrabrain` | strategist | Architecture, hard logic |
| `visual-engineering` | designer | Visual problems |
| `artistry` | designer | Brand, creative |
| `git` | manager | Version control operations |
| `bounded` | coder (fast bounded) | Moderate effort changes |
| `cross-module` | coder | Multi-component changes |
| `unspecified-low` | coder (fast bounded) | Unclassified small tasks |
| `unspecified-high` | coder | Unclassified substantial tasks |

## Tools

### LSP — 6 Tools

Live diagnostics, navigation, and refactoring powered by language servers.

- `lsp_diagnostics` — Run diagnostics across your codebase
- `lsp_goto_definition` — Jump to definition
- `lsp_find_references` — Find all references
- `lsp_symbols` — List symbols in a file
- `lsp_prepare_rename` — Prepare rename operations
- `lsp_rename` — Rename symbols across files

Supports TypeScript, Svelte, ESLint, Python (Pyright), Bash, HTML, CSS, JSON, Vue, Go (gopls), Rust (rust-analyzer), YAML. Servers auto-install via npx on first use.

**Important**: The Coder agent runs `lsp_diagnostics` after every file edit as part of the verify loop.

### Agent Browser — 14 Tools

Full browser automation via the `/agent-browser` CLI skill (not an MCP server).

- `agent_browser_navigate` — Navigate to a URL
- `agent_browser_snapshot` — Take an accessibility snapshot
- `agent_browser_click` — Click an element
- `agent_browser_fill` — Fill an input
- `agent_browser_type` — Type text
- `agent_browser_screenshot` — Take a screenshot
- `agent_browser_eval` — Evaluate JavaScript
- `agent_browser_wait` — Wait for a duration
- `agent_browser_close` — Close the browser
- `agent_browser_console` — Get console logs
- `agent_browser_select` — Select an option
- `agent_browser_hover` — Hover over an element
- `agent_browser_press` — Press a key
- `agent_browser_batch` — Execute multiple commands sequentially

**Screenshots**: `agent_browser_screenshot` saves captured images to `.opencode/screenshots/agent-browser-<timestamp>.png` in the project directory. It returns a compact path descriptor (file path + byte size) — never raw base64.

### Memory — BM25 FTS5 Search

`hiai_memory_search` — Search MEMORY.md, checkpoint.md, notes.md, and task progress files using SQLite FTS5 with BM25 ranking. Own database at `~/.hiai-opencode/data/hiai-memory.db`. Supports scope, type, and project filters.

### Session Manager — 4 Tools

- `session_list` — List all sessions
- `session_read` — Read a session
- `session_search` — Search across all sessions
- `session_info` — Get session metadata

### Background Tasks — 2 Tools

- `background_output` — Poll background subagent output
- `background_cancel` — Cancel a background task

### Skills — 1 Tool

`skill` — Load bundled skill workflows. Supports namespaced names:

- `build/shadcn-ui`, `build/incremental-implementation`, `build/systematic-debugging`
- `plan/interview-me`, `plan/spec-driven-development`
- `explore/context7`
- `writer/documentation-and-adrs`
- `designer/theme-factory`
- Top-level group names also work: `build`, `plan`, `writer`, `explore`, etc.

## Hooks — 30 Registered

| Category | Hooks |
|----------|-------|
| **Safety** | legal-gate, non-interactive-env, write-existing-file-guard |
| **Quality** | quality-gate, tool-pair-validator, thinking-block-validator |
| **Recovery** | edit-error-recovery, json-error-recovery, context-window-limit-recovery, runtime-fallback |
| **System** | closure-injector, rules-injector, context-window-monitor, think-mode, caveman-system-injector, caveman-message-compressor |
| **Lifecycle** | compaction-context-injector, compaction-todo-preserver, reasoning-content-cache, preemptive-compaction, token-budget |

## Features

### Completion Controller

Auto-continue state machine: blocked workflows stop, incomplete todos trigger another turn, complete work triggers critic review, critic-APPROVED work injects a summary card. Max 25 auto-continues per session. Configurable in `bob.json`.

### Background Manager

Tracks background subagent lifecycle with circuit breaker (4000 total tool calls, 20 consecutive same-tool threshold), concurrency limit (5 parallel), stale timeout (45 minutes). Auto-polls every 5 seconds.

### Dream & Distill — Memory Consolidation

- **Dream** (7-day interval): Reads checkpoints + raw trajectory DB, promotes durable knowledge to MEMORY.md under Rules, Architecture Decisions, Discovered Knowledge, Patterns, and Gotchas sections. Keeps MEMORY.md under 200 lines/10KB.
- **Distill** (30-day interval): Discovers repeated workflows across sessions, verifies against trajectory DB, packages into skills/subagents/commands. Creates nothing if no strong evidence exists.

### Memory — FTS5 Full-Text Search

SQLite FTS5 index at `~/.hiai-opencode/data/hiai-memory.db`. Reconciles filesystem and index bidirectionally on each search. Fingerprint-based change detection skips unchanged files. BM25 ranking with relative score floor (default 0.15, configurable).

### Caveman Internal Protocol

Integrates the **Caveman** internal communication protocol for compressed agent-to-agent messaging. Coverage across the full interaction pipeline:

| Domain | What Caveman Does |
|--------|------------------|
| **bob internal reasoning** | Bob's own chain-of-thought uses terse, artifact-focused language — drops filler, fragments OK, no boilerplate. |
| **bob → agents (briefs)** | Delegation briefs from Bob to subagents are compressed: stripped of polite formality, focused on task + evidence + expected outcome. |
| **agents → bob (evidence)** | Subagent responses back to Bob use terse evidence reports: status line, findings, files touched — no narrative wrapping. |
| **final user output** | Always decoded to normal, structured language with a valid `<CLOSURE>` block. No caveman fragments ever reach the user. |
| **disk / persistent storage** | MEMORY.md, session checkpoints, and task progress files remain human-readable. Caveman compresses only in-context LLM tokens, never on-disk storage. |

**CLOSURE preserved**: The `<CLOSURE>` protocol at the end of every agent response is never modified or suppressed by Caveman.

**Disable mechanism**: Add `"caveman-system-injector"` or `"caveman-message-compressor"` to `hooks.disabled` in bob.json.

**Vision excluded**: Vision agent never receives caveman fragments, ensuring full-context prompts for visual work.

Configuration in `bob.json`:

```jsonc
{
  "caveman": {
    "enabled": true,
    "level": "full",
    "bob_internal": true,
    "bob_to_agents": true,
    "agents_to_bob": true,
    "final_user_output": "normal",
    "target_agents": ["bob", "strategist", "coder", "manager", "critic", "designer", "researcher", "writer", "vision"],
    "exclude_agents": [],
    "min_messages_to_compress": 5
  }
}
```

## Architecture

- **Zero core modifications** — pure plugin via `@opencode-ai/plugin` hooks
- **Bundled config** — `bob.json` ships in the package; user overrides in project root or `.opencode/`
- **Own SQLite** — memory DB at `~/.hiai-opencode/data/hiai-memory.db`, never touches OpenCode storage
- **Postinstall** — echoes setup reminder
- **No external services** — all infrastructure is local: SQLite (Bun), LSP (npx), agent-browser (CLI skill)

### MCP Integrations

| Service | Type | Key env var | Agent(s) | What it's for |
|---------|------|-------------|----------|---------------|
| Stitch | **MCP** | `STITCH_AI_API_KEY` | designer | UI generation, design systems, screen variants |
| Context7 | **MCP** | `CONTEXT7_API_KEY` (optional) | researcher, coder | Library API documentation |
| grep_app | **MCP** | — | researcher | GitHub OSS code pattern search |
| MemPalace | **MCP** | `MEMPALACE_PYTHON` (optional) | manager (primary), all agents | Project memory and past decisions |
| Sequential-Thinking | **MCP** | — | strategist, critic | Deep reasoning for planning/review |
| Firecrawl | **CLI skill** | `FIRECRAWL_API_KEY` | researcher | Web scraping, crawl, extract, search (NOT an MCP server) |
| agent-browser | **CLI skill** | `AGENT_BROWSER_*` (optional) | coder, vision | Playwright-free browser automation via native Chrome + CDP (NOT an MCP server, NOT Playwright) |

**Important**: Firecrawl and `agent-browser` are CLI skills, not MCP servers. Do not add either to the `mcp` section of `hiai-opencode.json`.

## Post-Install Setup

After installing the plugin, copy the environment template and fill in your API keys:

```bash
cp bob.env.example bob.env
# Edit your keys in bob.env (git-ignored, never committed)
```

Install external CLIs manually if needed:

```bash
bun add -g agent-browser firecrawl-cli && agent-browser install
```

You can also ask OpenCode to finish local setup with this prompt:

```text
Read AGENTS.md and finish hiai-opencode setup for this workspace.

Keep OpenCode plugins separate from MCP servers. Do not add MCP server packages to the OpenCode plugin list.

Check that @hiai-gg/hiai-opencode is registered.

Enable only MCP services that can run on this machine:
- sequential-thinking: requires node/npx.
- grep_app: no key required.

CLI skills (NOT MCP):
- firecrawl-cli: requires FIRECRAWL_API_KEY. Just set the env var.
- agent-browser: requires bun add -g agent-browser && agent-browser install.

Check bob.env.example, report missing keys without printing secret values, and never invent or hardcode API keys.

Run verification commands where available:
- opencode debug config
```

## Development Install

```bash
bun install
```

Local development:

```bash
git clone https://github.com/HiAi-gg/hiai-opencode.git
cd hiai-opencode
bun install
bun run build
```

## Build & Publish

```bash
bun run build
bun run typecheck
```

Before publishing:

1. Run `bun run build`
2. Run `npm pack --dry-run`
3. Verify `opencode debug config`
4. Run `hiai-opencode export-mcp .opencode/.mcp.json` if you need static `mcp list` visibility

Publish:

```bash
npm publish --access public
```

## Roadmap

- Unattended CI npm publish with provenance
- Finish the BackgroundManager refactor and raise test coverage toward 20%+
- Configurable agent roster + mode→agent routing from `hiai-opencode.json`
- Optional run telemetry export to [HiAi Observe](https://github.com/HiAi-gg/hiai-observe)
- Skill + design-system marketplace and an agent-analytics dashboard

## Documentation Map

- [AGENTS.md](AGENTS.md): instructions for autonomous agents or tooling that need to install, configure, verify, or modify the plugin
- [ARCHITECTURE.md](ARCHITECTURE.md): runtime wiring, prompting layers, and modification map
- [CHANGELOG.md](CHANGELOG.md): version history
- [LICENSE.md](LICENSE.md): licensing and attribution