# hiai-opencode Architecture

This file explains how the plugin is assembled and where to change each layer.

## High-Level Structure

The plugin has five main layers:

1. config and defaults
2. agent registration and prompt assembly
3. skill discovery and materialization
4. MCP and LSP wiring
5. migration and compatibility handling

## Repository Layout

- [src/config](src/config): schemas, types, model presets, default wiring
- [src/agents](src/agents): agent factories, prompts, and prompt helpers
- [src/plugin-handlers](src/plugin-handlers): runtime config assembly into OpenCode shape
- [src/features](src/features): loaders, materializers, bridges, and supporting runtime features
- [src/mcp](src/mcp): fallback MCP config assembly
- [assets/mcp](assets/mcp): helper launchers for bundled MCP integrations
- [assets/runtime](assets/runtime): npm bootstrap helpers and runtime tooling
- [skills](skills): packaged project skills
- [config](config): packaged sample OpenCode config

## Agent Model

### Visible Primary Agents

These are the agents meant to be visible in the normal UI:

- `Bob`
- `Coder`
- `Strategist`
- `Guard`
- `Critic`
- `Designer`
- `Researcher`
- `Manager`
- `Brainstormer`
- `Vision`

### Hidden/System Agents

These exist for compatibility or system behavior and are not intended as user-facing primary agents:

- `Agent Skills`
- `Sub`
- `build`
- `plan`

### Canonical Source Files

Runtime naming, visibility, and compatibility are normalized through:

- [src/plugin-handlers/agent-config-handler.ts](src/plugin-handlers/agent-config-handler.ts)
- [src/shared/agent-display-names.ts](src/shared/agent-display-names.ts)
- [src/shared/migration/agent-names.ts](src/shared/migration/agent-names.ts)

## Models

### Presets

Shared presets and provider guidance live in:

- [src/config/models.ts](src/config/models.ts)

This file defines:

- `MODEL_PRESETS`
- `MODEL_ROLE_GUIDE`
- `PROVIDER_MODEL_RULES`

### Runtime Defaults

Actual default agent/category assignments live in:

- [src/config/defaults.ts](src/config/defaults.ts)

This is the runtime source of truth for:

- agent models
- category models
- MCP defaults
- LSP defaults
- permissions

## Prompting

Prompting is not a single file and not a single directory. `src/agents` is the main prompt source, but it is not the only source of truth.

### Layer 1: Agent Entry Factories

These files create the top-level agent config objects:

- Bob: [src/agents/bob.ts](src/agents/bob.ts)
- Coder: `src/agents/coder/agent.ts`
- Strategist: `src/agents/strategist/*`
- Guard: `src/agents/guard/agent.ts`
- Critic: `src/agents/critic/agent.ts`
- Vision: [src/agents/ui.ts](src/agents/ui.ts)
- Manager: [src/agents/platform-manager.ts](src/agents/platform-manager.ts)
- Researcher: [src/agents/researcher.ts](src/agents/researcher.ts)

### Layer 2: Model-Specific Prompt Variants

Examples:

- Bob: `src/agents/bob/gpt-pro.ts`, `src/agents/bob/gemini.ts`
- Coder: `src/agents/coder/gpt.ts`, `src/agents/coder/gpt-codex.ts`, `src/agents/coder/gpt-pro.ts`
- Strategist: `src/agents/strategist/gpt.ts`, `src/agents/strategist/gemini.ts`
- Guard: `src/agents/guard/gpt.ts`, `src/agents/guard/gemini.ts`

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

- change `src/config/models.ts` when the preset map itself should change
- change `src/config/defaults.ts` when default model assignment should change
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

Two skill sources are combined:

- project skills shipped in [skills](skills)
- built-in skills materialized into the OpenCode-visible skill tree

Relevant files:

- [src/features/builtin-skills/materialize.ts](src/features/builtin-skills/materialize.ts)
- [src/features/opencode-skill-loader](src/features/opencode-skill-loader)

## MCP

### Definitions

Default MCP definitions are in:

- [src/config/defaults.ts](src/config/defaults.ts)

Fallback assembly for packaged MCP support is in:

- [src/mcp/index.ts](src/mcp/index.ts)

### Runtime Helpers

Helper launchers live in:

- [assets/mcp](assets/mcp)
- [assets/runtime](assets/runtime)

Current MCP set:

- `playwright`
- `stitch`
- `sequential-thinking`
- `firecrawl`
- `rag`
- `mempalace`
- `context7`
- `websearch`
- `grep_app`

## LSP

LSP defaults are assembled from:

- [src/config/defaults.ts](src/config/defaults.ts)

Current defaults cover:

- TypeScript
- Svelte
- ESLint
- Bash
- Pyright

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
- `todo.md`

Avoid adding more root docs unless they serve a genuinely new role.

## Open Source Maintenance Rules

When changing the plugin, keep these invariants:

- `src/config/defaults.ts` is the runtime source of truth for defaults
- `src/config/models.ts` is the source of truth for shared model presets and provider guidance
- root docs should use canonical runtime names, not stale internal aliases
- user-facing docs should describe visible agents first and hidden/system agents second
- third-party MCPs should follow upstream install/launch conventions whenever possible
