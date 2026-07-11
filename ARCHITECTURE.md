# hiai-opencode Architecture

This file explains how the plugin is assembled and where to change each layer.

## High-Level Structure

The plugin has five main layers:

1. config and defaults
2. agent registration and prompt assembly
3. skill discovery and materialization
4. MCP and LSP wiring
5. migration and compatibility handling

## Request Flow

```
User input
    │
    ▼
┌─────────┐
│   Bob    │ ← orchestrator / router
└────┬────┘
     │ routes by complexity
     ▼
┌──────────────────────────────────────────────────────┐
│                                                      │
│  Simple / small (<5 todos, no parallelism)            │
│    └─► build (Coder)   (deep/bounded)                 │
│    └─► general         (quick/fallback)               │
│                                                      │
│  Complex / wave-based (5+ todos, 3+ parallel)         │
│    └─► manager ── wave dispatch ──► build / general   │
│                                                      │
│  Planning / architecture                              │
│    └─► plan (Strategist) ── plan, then route          │
│                                                      │
│  Specialist tiers (always delegated, not routed):     │
│    explore     ◄── background (facts, docs, grep)     │
│    writer      ◄── copy / SEO / messaging            │
│    designer    ◄── visual direction                   │
│    critic      ◄── review gate                        │
│    quality-guardian ◄── post-impl review              │
│                                                      │
└──────────────────────────────────────────────────────┘
     │
     ▼
┌─────────┐
│   Bob    │ ← collects results, verifies
└────┬────┘
     │
     ▼
  User response
```

**Key wiring rules:**
- OpenCode plugins are NOT MCP servers. `hiai-opencode` only provides the OpenCode-side launch wiring for MCP servers through its `mcp` config and helper launchers in `assets/mcp/`.
- Model credentials go through OpenCode Connect, not `hiai-opencode.json`.
- Service keys (e.g. `FIRECRAWL_API_KEY`) are configured in `bob.env` (env file) or as shell variables. Use `{env:VAR_NAME}` placeholders in `hiai-opencode.json` — never put raw API keys there.

## Repository Layout

- [src/config](src/config): schemas, types, and bundled config loading
- [src/agents](src/agents): agent factories, prompts, and prompt helpers
- [src/plugin-handlers](src/plugin-handlers): runtime config assembly into OpenCode shape
- [src/features](src/features): loaders, materializers, bridges, and supporting runtime features
- [src/mcp](src/mcp): fallback MCP config assembly
- [assets/mcp](assets/mcp): helper launchers for bundled MCP integrations
- [assets/runtime](assets/runtime): npm bootstrap helpers and runtime tooling
- [skills](skills): packaged project skills
- ~~design-systems~~ — removed in v0.3.0 (available from [nexu-io/open-design](https://github.com/nexu-io/open-design) separately)
- [config](config): packaged sample OpenCode config

## Agent Model

### Visible Primary Agents (display name / runtime slot)

These are the agents meant to be visible in the normal UI:

- `Bob` / `bob`
- `Coder` / `build`
- `Strategist` / `plan`
- `Manager` / `manager`
- `Critic` / `critic`
- `Designer` / `designer`
- `Explorer` / `explore`
- `Writer` / `writer`
- `Vision` / `vision`

### Hidden/System Agents

These exist for compatibility or system behavior and are not intended as user-facing primary agents:

- `General` / `general`
- `Agent Skills`
- `Sub` (legacy compatibility)
- `Quality Guardian`

> **Note**: Runtime config keys (`build`, `plan`, `explore`, `general`) are the canonical internal names. Legacy agent names (`coder`, `strategist`, `researcher`, `sub`) are preserved as compatibility aliases via `src/shared/migration/agent-names.ts`.

### Canonical Source Files

Runtime naming, visibility, and compatibility are normalized through:

- [src/agents/index.ts](src/agents/index.ts) — `createAllAgents()` registers all 8 agents with visibility and mode
- [src/types.ts](src/types.ts) — `AgentConfig` type definition

## Models

### Presets

User-facing model IDs live in one place:

- [hiai-opencode.json](hiai-opencode.json)

### Runtime Defaults

The TypeScript defaults loader derives hidden agents and categories from the 10 user-facing model slots:

- [src/config/defaults.ts](src/config/defaults.ts)

This is the internal routing source for:

- hidden agent model inheritance
- category model inheritance
- MCP defaults
- LSP defaults
- permissions

## Prompting

Prompting is not a single file and not a single directory. `src/agents` is the main prompt source, but it is not the only source of truth.

### Layer 1: Agent Entry Factories

These files create the top-level agent config objects:

- Bob: [src/agents/bob.ts](src/agents/bob.ts)
- Coder: [src/agents/coder/agent.ts](src/agents/coder/agent.ts)
- Strategist: `src/agents/strategist/*`
- Manager: [src/agents/manager/agent.ts](src/agents/manager/agent.ts)
- Critic: [src/agents/critic/agent.ts](src/agents/critic/agent.ts)
- Designer: [src/agents/designer.ts](src/agents/designer.ts)
- Writer: [src/agents/writer.ts](src/agents/writer.ts)
- Agent Skills: [src/agents/agent-skills.ts](src/agents/agent-skills.ts)
- Vision: [src/agents/ui.ts](src/agents/ui.ts)
- Researcher: [src/agents/researcher.ts](src/agents/researcher.ts)

### Layer 2: Model-Specific Prompt Variants

Examples:

- Bob: `src/agents/bob/agent.ts` (unified model-agnostic factory, no model-specific variants)
- Coder: `src/agents/coder/agent.ts`, `src/agents/coder/core.ts` (unified factory, no model-specific variants)
- Manager: `src/agents/manager/agent.ts` (unified factory, no model-specific variants)

This is where provider- or model-family-specific behavior usually lives.

### Layer 3: Shared Prompt Building Blocks

Shared sections and reusable policy fragments live under:

- `src/agents/prompt-library/*`
- `src/agents/dynamic-agent-prompt-builder.ts`
- `src/agents/dynamic-agent-policy-sections.ts`

This is the right layer for:

- common policies
- repeated behavior blocks
- reusable sections shared by multiple agents

### Layer 3.5: Shared Runtime Prompt Injections

Some prompt content is appended outside the direct agent source files:

- [src/shared/closure-protocol.ts](src/shared/closure-protocol.ts)
- `src/agents/builtin-agents/agent-overrides.ts`
- `src/agents/builtin-agents/environment-context.ts`
- [src/plugin-handlers/strategist-agent-config-builder.ts](src/plugin-handlers/strategist-agent-config-builder.ts)

This layer can:

- append closure requirements
- append environment context
- apply `prompt_append` overrides
- alter the final strategist prompt during assembly

### Layer 4: Runtime Normalization

Final runtime shaping happens in:

- [src/plugin-handlers/agent-config-handler.ts](src/plugin-handlers/agent-config-handler.ts)

This layer controls:

- visible vs hidden agents
- runtime display names
- compatibility wrappers
- fallback descriptions
- final primary vs subagent mode

If a prompt change looks correct in source but does not show up correctly in OpenCode, inspect layer 4.

### Prompting Change Rules

Use these rules when editing the prompt layer:

- change `hiai-opencode.json` when any primary agent model slot should change
- change `src/config/defaults.ts` when internal category-to-agent-slot routing should change
- change `src/agents/*` when the prompt content or behavior should change
- change shared prompt/injection files when the prompt is being appended or normalized after agent construction
- change `src/plugin-handlers/agent-config-handler.ts` when runtime name, visibility, mode, or final description should change

### Bottom Line

`src/agents` is the main prompt authoring layer.

It is not the only source of truth for the final runtime prompt.

The final runtime prompt can also be affected by:

- shared prompt-library files
- model-specific variants
- environment-context injection
- `prompt_append` overrides
- closure protocol injection
- strategist runtime assembly

## Skills

Two skill sources are wired into OpenCode:

- project skill definitions in [skills](skills)
- skill materialization into the OpenCode-visible skill tree

Relevant files:

- [src/features/builtin-skills/materialize.ts](src/features/builtin-skills/materialize.ts)
- [src/features/opencode-skill-loader](src/features/opencode-skill-loader)
- [src/config/schema/skill-discovery.ts](src/config/schema/skill-discovery.ts)
- [src/plugin/skill-discovery-config.ts](src/plugin/skill-discovery-config.ts)

Default discovery is deterministic: packaged plugin skills, generated builtin skills, explicit config sources, and project `.opencode/skills`. Global OpenCode, Claude, and Agents skill folders are opt-in.

## MCP

### Definitions

Default MCP wiring is in:

- [src/mcp/registry.ts](src/mcp/registry.ts)

OpenCode MCP config assembly is in:

- [src/mcp/index.ts](src/mcp/index.ts)

### Runtime Helpers

Helper launchers live in:

- [assets/mcp](assets/mcp)
- [assets/runtime](assets/runtime)

Current MCP set (v0.3.0):

- `sequential-thinking`
- `grep_app`

CLI skills (not MCP):
- `firecrawl` — web scraping, crawl, extract, search
- `agent-browser` — browser automation via Chrome CDP
- `context7` — on-demand via `skill("explore/context7")`

**Removed in v0.3.0**: `stitch`, `mempalace`, `context7` (from default MCP registry).

## LSP

LSP defaults are assembled from:

- [src/config/defaults.ts](src/config/defaults.ts)

Current defaults cover:

- TypeScript
- Svelte
- ESLint
- Biome
- Bash
- Pyright

## Worktree Isolation

The plugin now supports Git worktree isolation for safe parallel development and testing workflows.

### Components

- **WorktreeManager**: Central manager class (`src/features/worktree/index.ts`) handling worktree creation, listing, removal, and cleanup operations
- **Worktree Tools**: Four dedicated tools exposed via the plugin:
  - `hiai_worktree_create` — Create new Git worktree with a dedicated branch
  - `hiai_worktree_list` — List all active worktrees with status
  - `hiai_worktree_remove` — Remove a worktree by directory path
  - `hiai_worktree_status` — Report worktree status (branch, dirty, ahead/behind)
- **Lifecycle Hooks**: Worktree lifecycle hooks registered via standard plugin events:
  - `chat.message` — Detect plan-start signals and auto-create a linked worktree
  - `tool.execute.after` — Detect CLOSURE completion and auto-remove session worktree
- **Skill Integration**: Packaged `using-git-worktrees` skill (`skills/general/using-git-worktrees/`) provides worktree operations via skill interface for agent discovery and invocation
- **Prompt Integration**: Worktree context and commands integrated into Bob, Manager, and Coder prompts to enable worktree-aware task execution and prevent accidental operations on main worktree

### Usage Patterns

Worktree isolation enables:
- Parallel feature development without branch switching
- Safe testing of experimental changes
- Multi-context development sessions
- Automated worktree lifecycle management through hooks

### Files

- Core: `src/features/worktree/index.ts`
- Tools: `src/tools/worktree.ts`
- Hooks: `src/hooks/worktree-lifecycle.ts`
- Skill: `skills/general/using-git-worktrees/`
- Prompt integration: `src/prompt-library/worktree.ts`

## Compatibility Layer

This plugin accepts older names and maps them to current runtime behavior.

Examples:

- old UI naming maps to `Vision`
- old platform naming maps to `Manager`
- old review/debug aliases fold into `Critic`
- old `Sub` behavior is compatibility-only and folded into `Coder` as the main execution contour

The compatibility boundary is handled in:

- [src/shared/migration](src/shared/migration)
- [src/plugin-handlers/agent-config-handler.ts](src/plugin-handlers/agent-config-handler.ts)

## Root Documentation Policy

The root documentation set should stay small:

- `README.md`
- `AGENTS.md`
- `ARCHITECTURE.md`
- `LICENSE.md`

Avoid adding more root docs unless they serve a genuinely new role.

## Open Source Maintenance Rules

When changing the plugin, keep these invariants:

- `hiai-opencode.json` is the source of truth for user-facing runtime defaults and model IDs
- `src/config/defaults.ts` must remain a loader, not a second model map
- root docs should use canonical runtime names, not stale internal aliases
- user-facing docs should describe visible agents first and hidden/system agents second
- third-party MCPs should follow upstream install/launch conventions whenever possible
