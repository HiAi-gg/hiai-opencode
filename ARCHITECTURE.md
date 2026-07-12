# hiai-opencode Architecture

This file explains how the plugin is assembled and where to change each layer.
It reflects the **actual** on-disk code layout — every path below is real.

## High-Level Structure

The plugin has five main layers:

1. config and defaults
2. agent registration and prompt assembly
3. skill tooling
4. MCP and LSP wiring
5. execution gates and hooks

## Request Flow

```
User input
    │
    ▼
┌─────────┐
│   Bob    │ ← orchestrator / router (visible, primary)
└────┬────┘
     │ routes by complexity
     ▼
┌──────────────────────────────────────────────────────┐
│                                                      │
│  Simple / small (<5 todos, no parallelism)            │
│    └─► build   (hidden, deep/bounded implementation)  │
│    └─► general (visible, quick/fallback executor)     │
│                                                      │
│  Planning / architecture                              │
│    └─► plan (visible, deep planning, read-only)       │
│                                                      │
│  Specialist tiers (always delegated, not routed):     │
│    explore  ◄── discovery (grep, firecrawl, context7) │
│    writer   ◄── copy / SEO / messaging               │
│    designer ◄── visual direction                      │
│    critic   ◄── review gate (APPROVED/REJECTED)      │
│    manager  ◄── delegation orchestrator, memory       │
│    vision   ◄── browser operator, multimodal          │
│                                                      │
└──────────────────────────────────────────────────────┘
     │
     ▼
┌─────────┐
│   Bob    │ ← collects results, verifies, reports
└────┬────┘
     │
     ▼
  User response
```

**Key wiring rules:**
- OpenCode plugins are NOT MCP servers. `hiai-opencode` only provides the OpenCode-side launch wiring for MCP servers through its `mcp` config and helper launchers.
- Model credentials go through OpenCode Connect, not `hiai-opencode.json`.
- Service keys (e.g. `FIRECRAWL_API_KEY`) are configured in `bob.env` (env file) or as shell variables. Use `{env:VAR_NAME}` placeholders in `hiai-opencode.json` — never put raw API keys there.

## Repository Layout

- [src/config.ts](src/config.ts): config loading, defaults, env-file loading, validation
- [src/index.ts](src/index.ts): plugin entry — agent registration via `hooks.config`, tool registration, hook wiring
- [src/agents/](src/agents): agent factories, prompts (`bob.ts`, `build.ts`, `plan.ts`, `manager.ts`, `critic.ts`, `designer.ts`, `writer.ts`, `vision.ts`, `explore.ts`, `general.ts`, `index.ts`)
- [src/prompt-library/](src/prompt-library): shared prompt fragments (browser, caveman, native-memory, postgres-rules, workspace, worktree)
- [src/shared/](src/shared): closure protocol, env-var resolution, event helpers
- [src/permissions.ts](src/permissions.ts): per-agent permission/tool-disable resolution
- [src/hooks/](src/hooks): all runtime hooks (circuit breaker, quality gate, closure injector, legal gate, worktree lifecycle, etc.)
- [src/features/](src/features): background-manager, completion-controller, dream-distill, mcp, shell-env, telemetry, workspace-adapter, worktree
- [src/tools/](src/tools): tool registrations (skill, lsp, session-manager, background-task, worktree, agent-browser, firecrawl, memory-tool)
- [assets/cli/hiai-opencode.mjs](assets/cli/hiai-opencode.mjs): the `hiai-opencode` CLI (doctor, mcp-status, export-mcp, diagnose)
- [assets/runtime/](assets/runtime): npm bootstrap helper for MCP/LSP tools
- [skills/](skills): packaged project skills
- [config/](config): packaged sample OpenCode config and schema

## Agent Model

### Visible agents (picker)

- `bob` (primary) — Orchestrator, router, entry point
- `plan` (mode: all) — Principal Architect, deep planning
- `general` (mode: all) — Cheap bounded executor, fallback

### Hidden subagents

- `build` — Senior Staff Engineer, implementation (deep/bounded)
- `explore` — discovery (firecrawl + grep_app + context7)
- `critic` — review gate (binary APPROVED/REJECTED)
- `designer` — UI/visual direction
- `writer` — copy/positioning/SEO
- `vision` — browser operator, multimodal
- `manager` — delegation orchestrator, memory steward
- `dream-consolidator` — memory consolidation (auto-triggered)
- `distill-packager` — workflow packaging (auto-triggered)

> **Counts**: `createAllAgents()` returns 8 agent definitions; 4 more (`explore`, `plan`, `build`, `general`) are native-upgraded inline in `src/index.ts`. Total registered: 12. The 10 user-facing model slots are `bob, build, plan, manager, critic, designer, explore, writer, vision, general` (validated by `REQUIRED_AGENT_KEYS` in `src/config.ts`).

### Legacy name mapping

There is **no** separate migration module. Legacy agent keys are mapped only in two places:
- `DEPRECATED_MODEL_KEYS` in [assets/cli/hiai-opencode.mjs](assets/cli/hiai-opencode.mjs) (doctor diagnostics): `coder`→`build`, `strategist`→`plan`, `researcher`→`explore`, `sub`→`general`, `guard`→`manager`, `brainstormer`→`writer`.
- The prompts reference agents by canonical runtime key (`explore`, `build`, `plan`, `general`).

### Canonical Source Files

- [src/agents/index.ts](src/agents/index.ts) — `createAllAgents()` registers 8 agents with visibility, mode, description, and prompts; `resolveAgentModel` / `applyPromptOverride` helpers
- [src/index.ts](src/index.ts) — `hooks.config` callback native-upgrades `explore`/`plan`/`build`/`general` and merges all agents into OpenCode's `cfg.agent` dict; assembles MCP config
- [src/types.ts](src/types.ts) — `AgentConfig`, `BobConfig`, `CompletionConfig`, `WorktreeConfig`, `ClosureBlock` types

## Models

### Source of truth

User-facing model IDs live in one place:

- [hiai-opencode.json](hiai-opencode.json) (project) / `bob.json` (plugin defaults)

The runtime loader is:

- [src/config.ts](src/config.ts) — `loadConfig()` reads `bob.json` from plugin root, project dir, `.opencode/`, and global config dir (first found wins); `mergeConfig()` applies defaults; `REQUIRED_AGENT_KEYS` validates the 10 slots.

Users configure the 10 primary agent model slots under `models`: `bob`, `build`, `plan`, `manager`, `critic`, `designer`, `explore`, `writer`, `vision`, `general`. Use fully qualified `provider/model-id` strings. Do not invent prefixes — run `opencode models` and copy exact IDs.

## Prompting

Prompting is layered. `src/agents/` is the main authoring layer, but runtime prompts are assembled from several sources.

### Layer 1: Agent prompt source files

Each agent's prompt is a template literal assembled from imported fragments:

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

### Layer 2: Shared prompt fragments

Reusable policy/behavior blocks imported by the agent prompts:

- [src/prompt-library/browser.ts](src/prompt-library/browser.ts) — `BROWSER_VIA_VISION` (delegate browser to Vision)
- [src/prompt-library/caveman.ts](src/prompt-library/caveman.ts) — caveman protocol fragments (injected at runtime by `caveman-system-injector`)
- [src/prompt-library/native-memory.ts](src/prompt-library/native-memory.ts) — native memory/tasks tool reminders
- [src/prompt-library/postgres-rules.ts](src/prompt-library/postgres-rules.ts) — DB query rules
- [src/prompt-library/workspace.ts](src/prompt-library/workspace.ts) — `getWorkspaceContext()` (workspace/project type detection)
- [src/prompt-library/worktree.ts](src/prompt-library/worktree.ts) — `WORKTREE_AWARENESS`

### Layer 3: Runtime prompt injection

Prompt content appended/transformed after the source prompt is built:

- [src/shared/closure.ts](src/shared/closure.ts) — `CLOSURE_SCHEMA_PROMPT` + `validateClosure()`
- [src/hooks/closure-injector.ts](src/hooks/closure-injector.ts) — appends closure schema when missing
- [src/hooks/caveman-system-injector.ts](src/hooks/caveman-system-injector.ts) — resolves agent identity and injects caveman protocol fragments
- [src/agents/index.ts](src/agents/index.ts) — `applyPromptOverride()` applies `prompt_append` from `agent_overrides`

### Layer 4: Agent registration assembly

Final agent registration into OpenCode's `cfg.agent` dict happens in the `hooks.config` callback in [src/index.ts](src/index.ts). This is where model resolution, visibility, mode, temperature, thinking budgets, and per-agent permissions are applied.

### Prompting Change Rules

- change [hiai-opencode.json](hiai-opencode.json) / `bob.json` when a model slot should change
- change [src/config.ts](src/config.ts) (`DEFAULT_CONFIG`) when defaults (permissions, mcp, lsp, completion, etc.) should change
- change `src/agents/*.ts` when prompt content or behavior should change
- change `src/prompt-library/*.ts` when a shared prompt fragment should change
- change [src/index.ts](src/index.ts) `hooks.config` when agent registration, visibility, or model resolution should change

## Skills

Skills are loaded by a single file:

- [src/tools/skill.ts](src/tools/skill.ts) — `createSkillTool()` walks the packaged `skills/` directory, indexes every `SKILL.md` by both namespaced path and leaf name, and serves content via the `skill` tool.

Packaged skills live in [skills/](skills), organized by agent group (`build/`, `designer/`, `plan/`, `explore/`, `bob/`, `critic/`, `general/`, `vision/`, `writer/`).

> **Note**: The `skill_discovery` / `skills.sources` / `skills.disable` config documented in older versions is **not implemented** in the current codebase. Skills are discovered from the packaged `skills/` directory only. The skills dir is hardcoded relative to `dist/`.

CLI skills (not MCP, invoked via `skill("...")` or shell):

- `firecrawl` — web scraping (requires `FIRECRAWL_API_KEY`)
- `context7` — on-demand library docs via `skill("explore/context7")`
- `agent-browser` — browser automation via Chrome CDP (uses `/agent-browser` skill)

## MCP

### Registry (source of truth)

- [src/features/mcp/registry.ts](src/features/mcp/registry.ts) — `MCP_REGISTRY` constant (2 servers) + `getMcpConfig()`
- [src/features/mcp/auto-export.ts](src/features/mcp/auto-export.ts) — `autoExportStaticMcp()` writes `.opencode/.mcp.json` at startup

### Current MCP set (v0.3.0+)

- `sequential-thinking` — local, npx-backed reasoning server
- `grep_app` — remote code-search endpoint (no key required)

**Removed in v0.3.0**: `context7` (now on-demand CLI skill), `stitch`, `mempalace`.

### Runtime helpers

- [assets/runtime/npm-package-runner.mjs](assets/runtime/npm-package-runner.mjs) — shared `npx -y <pkg>` bootstrap with isolated npm cache

### Static export (auto + manual)

The plugin auto-exports `.opencode/.mcp.json` at startup so hosts whose `opencode mcp list` only reads static config can see hiai-managed servers. Controlled by:

- `HIAI_OPENCODE_AUTO_EXPORT_MCP`: `if-missing` (default) | `always` | `off`
- `HIAI_OPENCODE_MCP_EXPORT_PATH`: override output path
- `HIAI_OPENCODE_EXPORT_MCP_MODE`: `safe` (default) | `force` (overwrite policy in `always` mode)

Manual refresh: `hiai-opencode export-mcp .opencode/.mcp.json`

## LSP

LSP defaults live in:

- [src/config.ts](src/config.ts) — `DEFAULT_CONFIG.lsp`

Current defaults: `typescript`, `svelte`, `eslint`, `pyright`.

LSP tool registrations: [src/tools/lsp/](src/tools/lsp) (`lsp_diagnostics`, `lsp_goto_definition`, `lsp_find_references`, `lsp_symbols`, `lsp_prepare_rename`, `lsp_rename`).

Server definitions: [src/tools/lsp/server-definitions.ts](src/tools/lsp/server-definitions.ts).

## Execution Gates

The plugin enforces a layered safety model. From strongest to weakest:

### Hard gates (throw / mutate state)

- **Legal gate** — [src/hooks/legal-gate.ts](src/hooks/legal-gate.ts): three-tier deny list (browser automation always blocked, military/malicious always blocked, contextual dual-use with offensive-intent regex). Throws `BlockingHookError`.
- **Per-agent permission maps** — [src/permissions.ts](src/permissions.ts): `applyAgentPermissions()` converts `agent_restrictions` into `permission.deny` / `tools.<key>=false`. Applied in `src/index.ts` `hooks.config`.
- **Completion controller** — [src/features/completion-controller/](src/features/completion-controller): state machine that gates task completion. `decide()` (decide.ts) requires: no blocker, no incomplete todos, quality gate passed, LSP diagnostics run (if edits made), and Critic approval (if `require_critic` and changed files exist).
- **Circuit breaker** — [src/hooks/circuit-breaker.ts](src/hooks/circuit-breaker.ts) + [src/features/background-manager/index.ts](src/features/background-manager/index.ts): feeds every `tool.execute.after` call into `BackgroundManager.recordSessionToolCall()`; trips on N consecutive identical calls (default 20) or total tool calls (default 4000), aborting the session via `client.session.abort`.
- **Agent-browser guard** — [src/tools/agent-browser/index.ts](src/tools/agent-browser/index.ts): `browserGateGuard()` throws for non-`vision`/`general` agents.
- **LSP sandbox** — [src/tools/lsp/index.ts](src/tools/lsp/index.ts): throws on paths resolving outside `ctx.directory`.

### Soft gates (mutate output / state)

- **Quality gate** — [src/hooks/quality-gate.ts](src/hooks/quality-gate.ts): scans bash output from quality commands (test/lint/typecheck); on failure sets `qualityGateFailed` flag (blocks completion) and appends a directive.
- **Closure injector** — [src/hooks/closure-injector.ts](src/hooks/closure-injector.ts): appends `CLOSURE_SCHEMA_PROMPT` when missing; logs on invalid CLOSURE.
- **Non-interactive env** — [src/hooks/non-interactive-env.ts](src/hooks/non-interactive-env.ts): rewrites interactive commands (`vim`/`less`/`ssh`) to echo stubs.
- **Runtime fallback** — [src/hooks/runtime-fallback.ts](src/hooks/runtime-fallback.ts): clamps `maxOutputTokens`.

### Closure protocol

- [src/shared/closure.ts](src/shared/closure.ts) — schema prompt + `validateClosure()` (enforces `readiness` enum: `done` | `accept` | `reject`)
- [src/types.ts](src/types.ts) — `ClosureBlock` type

All agents must emit a `<CLOSURE>` block. The completion controller parses Critic verdicts from it.

## Worktree Isolation

Git worktree-based task isolation for parallel work.

### Components

- **WorktreeManager** — [src/features/worktree/index.ts](src/features/worktree/index.ts): create/list/remove/cleanup operations
- **Tools** — [src/tools/worktree.ts](src/tools/worktree.ts): `hiai_worktree_create`, `hiai_worktree_remove`, `hiai_worktree_list`, `hiai_worktree_status`
- **Lifecycle hooks** — [src/hooks/worktree-lifecycle.ts](src/hooks/worktree-lifecycle.ts): auto-create on plan-start signals, auto-remove on `<CLOSURE>`
- **Skill** — [skills/general/using-git-worktrees/](skills/general/using-git-worktrees/)
- **Prompt integration** — [src/prompt-library/worktree.ts](src/prompt-library/worktree.ts): `WORKTREE_AWARENESS`

Gated on `config.worktreeConfig?.enabled === true` (default: enabled).

## Background Tasks

- **BackgroundManager** — [src/features/background-manager/index.ts](src/features/background-manager/index.ts): in-memory task tracking, circuit breaker (consecutive-identical + total-call limits), stale timeout, concurrency limit
- **Tools** — [src/tools/background-task/index.ts](src/tools/background-task/index.ts): `background_output`, `background_cancel`
- **Hook wiring** — [src/hooks/circuit-breaker.ts](src/hooks/circuit-breaker.ts): feeds `tool.execute.after` into the manager

> State is in-memory only. If the OpenCode process restarts, all task state is lost.

## CLI

The `hiai-opencode` CLI is installed via the `bin` field in [package.json](package.json):

- [assets/cli/hiai-opencode.mjs](assets/cli/hiai-opencode.mjs)

Commands: `doctor`, `mcp-status`, `export-mcp`, `diagnose`, `task-status`. `doctor`/`mcp-status` exit non-zero on hard failures (usable as CI gate).

## Root Documentation Policy

The root documentation set should stay small:

- `README.md`
- `AGENTS.md`
- `ARCHITECTURE.md`
- `LICENSE.md`

Avoid adding more root docs unless they serve a genuinely new role.

## Open Source Maintenance Rules

When changing the plugin, keep these invariants:

- [hiai-opencode.json](hiai-opencode.json) / `bob.json` is the source of truth for user-facing runtime defaults and model IDs
- [src/config.ts](src/config.ts) `DEFAULT_CONFIG` is the loader for internal defaults — not a second model map
- root docs should use canonical runtime names (`bob`, `build`, `plan`, `explore`, `general`), not stale aliases
- the CLI's `MCP_REGISTRY` must mirror [src/features/mcp/registry.ts](src/features/mcp/registry.ts) — keep them in sync
- user-facing docs should describe visible agents first and hidden/system agents second
- third-party MCPs should follow upstream install/launch conventions whenever possible
