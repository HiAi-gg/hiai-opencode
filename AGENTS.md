# AGENTS.md

This file is for autonomous agents or tooling that need to install, configure, verify, or modify `hiai-opencode`.

## Purpose

`hiai-opencode` is an OpenCode plugin repository. It is not a standalone app. The normal workflow is:

1. build the plugin
2. register it in OpenCode
3. provide required environment variables
4. verify agent and MCP runtime state

## Install Workflow

### Local Development Build

```bash
bun install
bun run build
```

### Register In OpenCode

Add this to OpenCode config:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["hiai-opencode"]
}
```

### Verify

```bash
opencode debug config
opencode mcp list --print-logs --log-level INFO
```

## Expected Agent State

Visible primary agents:

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

Hidden/system or compatibility agents:

- `Agent Skills`
- `Sub`
- `build`
- `plan`

Automatic task distribution:

- Category-based task execution routes through `Coder`
- `quick`, `writing`, and `unspecified-low` use Coder's fast bounded contour
- `deep`, `ultrabrain`, `visual-engineering`, `artistry`, and `unspecified-high` use Coder's deep contour
- `Critic` is selected explicitly for review and verification passes
- `Researcher` is selected explicitly for codebase and documentation discovery
- `Designer`, `Brainstormer`, `Manager`, and `Vision` are direct callable specialists, not category executors
- `Bob` and `Guard` are orchestration agents, not normal subagent routing targets

If runtime output differs from that set, inspect:

- [src/plugin-handlers/agent-config-handler.ts](src/plugin-handlers/agent-config-handler.ts)
- [src/shared/agent-display-names.ts](src/shared/agent-display-names.ts)
- `src/shared/migration/*`

## Model Configuration

There are two sources of truth:

1. shared presets and guidance:
   - [src/config/models.ts](src/config/models.ts)
2. actual runtime defaults:
   - [src/config/defaults.ts](src/config/defaults.ts)

The example override file is:

- [hiai-opencode.json](hiai-opencode.json)

Use fully qualified model IDs. Do not introduce local aliases like `hiai-fast` or `sonnet`.

## Change Map

Use this table when you need to change something and want the right file immediately.

| Goal | Edit this first | Why |
|---|---|---|
| Change shared preset values like `fast`, `mid`, `high`, `vision`, `reasoning` | [src/config/models.ts](src/config/models.ts) | This is the shared preset map |
| Change which default model an agent uses | [src/config/defaults.ts](src/config/defaults.ts) | This is the runtime default assignment layer |
| Change which default model a category uses | [src/config/defaults.ts](src/config/defaults.ts) | Categories are assigned there |
| Change provider/model guidance shown to maintainers | [src/config/models.ts](src/config/models.ts) | That file holds provider rules and role guidance |
| Change Bob behavior or prompt text | [src/agents/bob.ts](src/agents/bob.ts), `src/agents/bob/*` | Bob prompt authoring lives there |
| Change Coder behavior or prompt text | `src/agents/coder/*` | Coder prompt authoring lives there |
| Change Strategist behavior or prompt text | `src/agents/strategist/*` | Strategist prompt authoring lives there |
| Change Guard behavior or prompt text | `src/agents/guard/*` | Guard prompt authoring lives there |
| Change Critic prompt text | `src/agents/critic/*` | Critic prompt authoring lives there |
| Change Vision prompt text | [src/agents/ui.ts](src/agents/ui.ts) | Vision lives there |
| Change Manager prompt text | [src/agents/platform-manager.ts](src/agents/platform-manager.ts) | Manager lives there |
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
| Change MCP defaults | [src/config/defaults.ts](src/config/defaults.ts) | Default MCP definitions live there |
| Change fallback packaged MCP behavior | [src/mcp/index.ts](src/mcp/index.ts) | Packaged MCP assembly lives there |
| Change local MCP helper launcher logic | `assets/mcp/*` | Runtime launcher scripts live there |
| Change npm bootstrap behavior for MCP/LSP tools | [assets/runtime/npm-package-runner.mjs](assets/runtime/npm-package-runner.mjs) | Shared npm bootstrap logic lives there |
| Change LSP defaults | [src/config/defaults.ts](src/config/defaults.ts) | LSP defaults live there |

## Prompting Layout

Prompting is layered.

### Layer 1: Agent Factory Entry

These decide the high-level config object for each agent:

- Bob: [src/agents/bob.ts](src/agents/bob.ts)
- Coder: `src/agents/coder/*`
- Strategist: `src/agents/strategist/*`
- Guard: `src/agents/guard/*`
- Critic: `src/agents/critic/*`
- Vision: [src/agents/ui.ts](src/agents/ui.ts)
- Manager: [src/agents/platform-manager.ts](src/agents/platform-manager.ts)
- Researcher: [src/agents/researcher.ts](src/agents/researcher.ts)

### Layer 2: Model-Specific Prompt Variants

Examples:

- Bob: `src/agents/bob/gpt-pro.ts`, `src/agents/bob/gemini.ts`
- Coder: `src/agents/coder/gpt.ts`, `src/agents/coder/gpt-codex.ts`, `src/agents/coder/gpt-pro.ts`
- Strategist: `src/agents/strategist/gpt.ts`, `src/agents/strategist/gemini.ts`
- Guard: `src/agents/guard/gpt.ts`, `src/agents/guard/gemini.ts`

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

Default MCP definitions live in:

- [src/config/defaults.ts](src/config/defaults.ts)

Fallback/packaged MCP assembly lives in:

- [src/mcp/index.ts](src/mcp/index.ts)

Runtime helper assets live in:

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

## Environment Variables

Use [.env.example](.env.example) as the canonical key template for local setup and release checks.

Common keys:

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

## Known Runtime Caveats

Windows/OpenCode may fail to spawn local MCP processes with `EPERM` for `cmd` or `node`. When that happens:

- the plugin definition may still be correct
- the host runtime is the remaining blocker

This most often affects:

- `sequential-thinking`
- `mempalace`
- local `npx`-backed MCP processes

## Prompt Ownership

For contributor-level detail on how prompts are assembled from source through runtime injection, see [src/agents/AGENTS.md](src/agents/AGENTS.md).

## Root Documentation Policy

Root docs should stay minimal and non-duplicative.

Keep:

- `README.md`: install, configure, use
- `AGENTS.md`: agent/tooling operator instructions
- `ARCHITECTURE.md`: internals and modification map
- `LICENSE.md`: licensing and attribution
- `todo.md`: internal working tracker

Avoid reintroducing extra root docs that duplicate one of those roles.
