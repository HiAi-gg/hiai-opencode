# Source-level Prompt Ownership

This file is for contributors and autonomous agents who need to edit prompt content or understand how the final runtime prompt is assembled.

## Layer Model

The final prompt delivered to an LLM is assembled from multiple sources, applied in this order:

1. **Source prompt** — authored in `src/agents/<agent>/*.ts`
2. **Model overlay** — variant in `src/agents/<agent>/<model>.ts` if model differs
3. **Shared policy sections** — blocks from `src/agents/prompt-library/*` and `src/agents/dynamic-agent-*`
4. **Runtime injection** — `src/agents/builtin-agents/agent-overrides.ts` and `src/agents/builtin-agents/environment-context.ts`
5. **Closure protocol** — appended from `src/shared/closure-protocol.ts`
6. **Strategist path** — assembled via `src/plugin-handlers/strategist-agent-config-builder.ts` (separate from other agents)

Layer 4 (runtime) can still change behavior even after layers 1-3 are authored. Inspect the plugin handlers first if a prompt looks correct in source but wrong at runtime.

## Prompt Source Per Agent

| Agent | Primary authoring file | Model variants |
|---|---|---|
| Bob | `src/agents/bob.ts`, `src/agents/bob/default.ts` | `gpt-pro.ts`, `gemini.ts` |
| Coder | `src/agents/coder/gpt-codex.ts`, `src/agents/coder/gpt-pro.ts`, `src/agents/coder/gpt.ts` | (same) |
| Strategist | `src/agents/strategist/gpt.ts` + mode files | `gemini.ts` |
| Guard | `src/agents/guard/default.ts`, `src/agents/guard/gpt.ts` | `gemini.ts` |
| Critic | `src/agents/critic/default.ts` | (none) |
| Vision | `src/agents/ui.ts` | (none) |
| Manager | `src/agents/platform-manager.ts` | (none) |
| Designer | `src/agents/designer.ts` | (none) |
| Researcher | `src/agents/researcher.ts` | (none) |
| Brainstormer | `src/agents/brainstormer.ts` | (none) |

## Shared Prompt Sections

`src/agents/prompt-library/` contains reusable policy blocks used by multiple agents:
- `todo-discipline.ts` — unified task/todo rules (shared by bob, coder, sub, guard)
- `intent-gate.ts` — router vs executor intent classification
- `anti-duplication.ts` — blocks duplicate work
- `closure-protocol.ts` — STATUS/TODO_UPDATE/NEXT_AGENT/VERIFICATION contract

`src/agents/dynamic-agent-core-sections.ts` — assembles agent-level sections from context  
`src/agents/dynamic-agent-policy-sections.ts` — applies per-agent policy on top

## When to Edit Plugin Handlers

`src/plugin-handlers/agent-config-handler.ts` — final authority for:
- Agent visibility (which agents appear as primary options)
- Display names (e.g., "Vision" vs "multimodal")
- Runtime descriptions injected into config

`src/plugin-handlers/strategist-agent-config-builder.ts` — strategist-specific assembly path

These files run after the prompt library and can override what was authored. Always check the handler if behavior changes unexpectedly.

## Changing Model Defaults

| What to change | Edit |
|---|---|
| Preset definitions (`fast`, `mid`, `high`, `vision`) | `src/config/models.ts` |
| Per-agent default model | `src/config/defaults.ts` |
| Per-category default model | `src/config/defaults.ts` |
| Config schema defaults | `src/config/types.ts` |

## Prompt Measurement

Run `bun run prompts:measure` to generate snapshot files in `dist/prompt-snapshots/`. These record the fully-assembled prompt size per agent per model. Use these to detect regressions before publishing.

## Changing MCP Defaults

1. Runtime registration defaults: `src/config/defaults.ts`
2. Packaged/packaged MCP assembly: `src/mcp/index.ts`
3. Local helper launchers: `assets/mcp/*`
4. NPM bootstrapper for local tools: `assets/runtime/npm-package-runner.mjs`

For more detail see `AGENTS.md` (root) and `ARCHITECTURE.md` (root).