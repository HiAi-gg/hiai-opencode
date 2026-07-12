# HiAi-Opencode

[![CI](https://github.com/HiAi-gg/hiai-opencode/actions/workflows/ci.yml/badge.svg?branch=main&event=push)](https://github.com/HiAi-gg/hiai-opencode/actions/workflows/ci.yml?query=branch%3Amain)
[![Release](https://img.shields.io/github/v/release/HiAi-gg/hiai-opencode?style=flat-square&logo=github)](https://github.com/HiAi-gg/hiai-opencode/releases/latest)
[![npm](https://img.shields.io/npm/v/@hiai-gg/hiai-opencode?style=flat-square&logo=npm)](https://www.npmjs.com/package/@hiai-gg/hiai-opencode)
[![npm downloads](https://img.shields.io/npm/dm/@hiai-gg/hiai-opencode?style=flat-square)](https://www.npmjs.com/package/@hiai-gg/hiai-opencode)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE.md)
[![Bun](https://img.shields.io/badge/runtime-Bun-f9f1e1?style=flat-square&logo=bun)](https://bun.sh)
[![OpenCode](https://img.shields.io/badge/host-OpenCode-blue?style=flat-square)](https://opencode.ai)

> A multi-agent engineering team that lives inside your editor. One plugin gives [OpenCode](https://opencode.ai) an orchestrator, a planner, senior engineers, a critic, a designer, a researcher, and a browser operator — all coordinating autonomously, with enforced review gates and live diagnostics.

**hiai-opencode** is an OpenCode plugin that turns a single AI session into a self-directing team. Instead of one model doing everything, Bob (the orchestrator) routes work to specialist subagents — a Senior Engineer writes the code, a Critic must approve it, an Explorer researches the codebase, Vision drives the browser to verify UIs — while a completion controller enforces that nothing ships unreviewed.

---

## Why

Most AI coding tools drop you into one big context window and hope the model self-manages. The result is predictable: the model edits a file, declares victory, and moves on — no review, no diagnostics run, no verification that the tests pass. **hiai-opencode fixes the loop:**

- 🛡️ **Code never ships unreviewed.** A dedicated Critic agent must return `APPROVED` before any task completes. A completion-controller state machine enforces it — not just a prompt.
- 🔍 **Diagnostics are mandatory, not optional.** Edit a file and the completion gate blocks until `lsp_diagnostics` has run clean and any failing `test` / `lint` / `typecheck` passes.
- 🧠 **A real team, not a monologue.** Bob routes by category — quick work to a cheap executor, hard implementation to a Senior Engineer, architecture to a Principal Architect, UI to a Designer, docs to a Writer.
- 🗜️ **Context that survives compaction.** Long sessions compact gracefully — in-memory gate state (failed quality check, pending diagnostics, unreviewed changes) is re-injected into the compaction context so the post-compaction agent still knows what blocks completion.
- ⚡ **No external services.** Everything is local: SQLite memory (Bun), LSP via `npx`, browser via Chrome CDP. Zero cloud dependencies, zero data leaves your machine.
- 🪝 **One line to install.** No separate MCP server config, no manual wiring — `opencode plugin @hiai-gg/hiai-opencode@latest --global`.

---

## Install

### 1. Install the plugin

```bash
opencode plugin @hiai-gg/hiai-opencode@latest --global
```

That's the whole setup. The plugin self-registers its agents, hooks, tools, and MCP servers.

### 2. Connect your model providers

In OpenCode, connect your providers (Anthropic, OpenAI, OpenRouter, etc.) and run:

```bash
opencode models
```

Copy the exact `provider/model-id` strings into your `bob.json` override (see [Configuration](#configuration)).

### 3. (Optional) Set API keys for CLI skills

```bash
cp bob.env.example bob.env
# Edit bob.env — add FIRECRAWL_API_KEY for web scraping (optional)
```

### 4. Verify

```bash
opencode debug config
hiai-opencode doctor      # now a real executable since v0.3.6
hiai-opencode mcp-status
```

`doctor` exits non-zero on hard failures, so you can use it as a CI gate.

### Want OpenCode to finish setup for you?

Paste this into a fresh session:

```text
Read AGENTS.md and finish hiai-opencode setup for this workspace.
Check that @hiai-gg/hiai-opencode is registered, enable MCP services that can run here
(sequential-thinking: node/npx; grep_app: no key), verify with opencode debug config
and hiai-opencode doctor. Report missing keys without printing secret values.
```

---

## What's in the box

### Agents — a specialist team

Bob routes work; the rest execute. Three are visible in the picker (you can invoke them directly); the rest are invoked by Bob or auto-triggered.

| Agent | Role | When it kicks in |
|-------|------|------------------|
| **Bob** (orchestrator) | Routes work, collects results, verifies. Never writes code. | Always — your entry point |
| **Plan** (Strategist) | Deep planning, architecture analysis, read-only | `ultrabrain` category, or user-invoked |
| **Build** (Senior Engineer) | Multi-file implementation from plans | `deep` category — the workhorse |
| **General** | Fast bounded executor, fallback for failed agents | `quick` category |
| **Explore** (Researcher) | Codebase grep, web search (Firecrawl/grep_app), library docs | `research` / discovery |
| **Critic** | Binary review gate — `APPROVED` or `REJECTED` with feedback | Auto-invoked before any task completes |
| **Designer** | UI/visual direction, design systems, component specs | `visual-engineering` |
| **Writer** | Copy, positioning, SEO, docs | `writing` |
| **Vision** | Browser operator, multimodal analysis, screenshots | `browser` / visual verification |
| **Manager** | Delegation orchestrator, TODO tracker, memory steward | Complex multi-wave tasks |

### Tools — 24 registered

- **LSP (6)** — `lsp_diagnostics`, `lsp_goto_definition`, `lsp_find_references`, `lsp_symbols`, `lsp_prepare_rename`, `lsp_rename`. TypeScript, Svelte, ESLint, Python, Bash.
- **Agent Browser (14)** — Navigate, snapshot, click, fill, screenshot, eval, console, and more. Native Chrome via CDP — no Playwright. Restricted to Vision/General agents.
- **Memory (1)** — `hiai_memory_search`: BM25-ranked SQLite FTS5 search over MEMORY.md, checkpoints, notes, and task progress.
- **Session Manager (4)** — List, read, search, and inspect sessions.
- **Worktree (4)** — `hiai_worktree_create`/`_list`/`_remove`/`_status` for isolated parallel work.
- **Skills (1)** — `skill("build/shadcn-ui")`, `skill("explore/context7")`, etc.
- **Firecrawl (3)** — Web scrape, search, sitemap (CLI skill, requires `FIRECRAWL_API_KEY`).

### MCP servers — 2, zero-config

| Server | Type | Use |
|--------|------|-----|
| `sequential-thinking` | local (npx) | Deep reasoning for Plan & Critic |
| `grep_app` | remote | GitHub OSS code search — no key required |

The plugin auto-exports `.opencode/.mcp.json` at startup so `opencode mcp list` sees these servers. Control it via `HIAI_OPENCODE_AUTO_EXPORT_MCP` (`if-missing` / `always` / `off`).

### Execution gates — enforced, not suggested

| Gate | What it enforces |
|------|-----------------|
| **Critic review** | No task with changed files completes until Critic returns `APPROVED` |
| **Quality gate** | Failed `test`/`lint`/`typecheck` blocks completion until it passes |
| **LSP gate** | Edits block completion until `lsp_diagnostics` runs clean |
| **Legal gate** | Hard-blocks browser-automation abuse, malicious tool use (throws) |
| **Circuit breaker** | Aborts sessions stuck in loops (20+ identical calls, or 4000+ total) |
| **Closure protocol** | Every agent response must carry a valid `<CLOSURE>` block |

### Hooks — 30, categorized

Safety · Quality · Recovery · System · Lifecycle. All chainable, all disable-able via `hooks.disabled` in config. See [AGENTS.md](AGENTS.md) for the full list.

### Memory systems — two complementary backends

- **Native `memory`** (OpenCode built-in) — full-text indexed curated MD files for durable knowledge.
- **`hiai_memory_search`** (plugin) — SQLite FTS5 BM25 over session transcripts and tool outputs for forensic cross-session recall.

Plus **Dream** (7-day) and **Distill** (30-day) auto-consolidation that promotes durable knowledge into MEMORY.md and packages repeated workflows into new skills.

---

## Configuration

The plugin ships sane defaults in [bob.json](bob.json). To customize, drop a `bob.json` in your project root (or `.opencode/`) — it merges over the bundled defaults.

### `bob.json` — models & behaviour

The 10 model slots: `bob`, `build`, `plan`, `manager`, `critic`, `designer`, `explore`, `writer`, `vision`, `general`. Defaults ship in the plugin; override only what you want to change:

```jsonc
{
  "models": {
    "bob": { "model": "openai/gpt-5.5" },
    "build": { "model": "opencode-go/deepseek-v4-pro" },
    "plan": { "model": "opencode-go/deepseek-v4-pro" },
    "manager": { "model": "opencode-go/deepseek-v4-flash" },
    "critic": { "model": "opencode-go/mimo-v2.5-pro" },
    "designer": { "model": "opencode-go/kimi-k2.7-code" },
    "explore": { "model": "opencode-go/deepseek-v4-flash" },
    "writer": { "model": "opencode-go/deepseek-v4-flash" },
    "vision": { "model": "opencode-go/mimo-v2.5" },
    "general": { "model": "opencode-go/deepseek-v4-flash" }
  },
  "mcp": {
    "sequential-thinking": { "enabled": true },
    "grep_app": { "enabled": true }
  }
}
```

Connect providers in OpenCode, run `opencode models`, and copy exact `provider/model-id` strings — don't invent prefixes. Model provider credentials live in OpenCode Connect, not in `bob.json`.

Config resolution order (first found wins): bundled `bob.json` → `<project>/bob.json` → `<project>/.opencode/bob.json` → `<project>/bob.jsonc` → `<project>/.opencode/bob.jsonc` → global config dir.

### `bob.env` — service keys (git-ignored)

```bash
cp bob.env.example bob.env
# FIRECRAWL_API_KEY=fc-...   (optional — web scraping skill)
# CONTEXT7_API_KEY=ctx7-...  (optional — on-demand library docs)
```

Never put raw keys in JSON — use `{env:VAR_NAME}` placeholders. Never commit `bob.env`.

---

## Quick start for contributors

```bash
git clone https://github.com/HiAi-gg/hiai-opencode.git
cd hiai-opencode
bun install
bun run build          # typecheck + tests run in prepublishOnly
bun test               # 986 tests
```

---

## Documentation

- **[AGENTS.md](AGENTS.md)** — operator reference: bootstrap checklist, change map, troubleshooting, full hook list
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — internal wiring, prompting layers, where to change each subsystem
- **[CHANGELOG.md](CHANGELOG.md)** — version history
- **[LICENSE.md](LICENSE.md)** — MIT

---

## Roadmap

- Configurable agent roster from `bob.json`
- Background-task persistence (SQLite journal — currently in-memory)
- Optional telemetry export to [HiAi Observe](https://github.com/HiAi-gg/hiai-observe)
- Skill marketplace + agent analytics

---

## License

MIT © [HiAi](https://github.com/HiAi-gg). See [LICENSE.md](LICENSE.md).
