# AGENTS.md

This file is for autonomous agents or tooling that need to install, configure, verify, or modify `hiai-opencode`.

## Purpose

`hiai-opencode` is an OpenCode plugin repository published as `@hiai-gg/hiai-opencode`. It is not a standalone app. It wires OpenCode agents, prompts, skills, MCP server launch commands, LSP defaults, and compatibility behavior around external upstream tools. Do not describe MCP servers, skills, model providers, or auxiliary OpenCode plugins as owned by this repository.

The normal workflow is:

1. install it through OpenCode or build it locally
2. register `@hiai-gg/hiai-opencode` in OpenCode
3. provide required environment variables
4. verify agent and MCP runtime state

## Install Workflow

### Native OpenCode Install

Use the OpenCode plugin CLI:

```bash
opencode plugin @hiai-gg/hiai-opencode@latest --global
```

Optional Dynamic Context Pruning plugin:

```bash
opencode plugin @tarquinen/opencode-dcp@latest --global
```

Manual alternative:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@hiai-gg/hiai-opencode"]
}
```

### Local Development Build

```bash
bun install
bun run build
```

### Register In OpenCode

Use the plugin CLI:

```bash
opencode plugin @hiai-gg/hiai-opencode@latest --global
```

Manual alternative:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@hiai-gg/hiai-opencode"]
}
```

### Verify

```bash
opencode debug config
opencode mcp list --print-logs --log-level INFO
```

## Post-Install Bootstrap Instructions

When a user asks OpenCode or another agent to finish installing this plugin, follow this procedure.

### Operating Rules

- Keep OpenCode plugins separate from MCP servers.
- Register `@hiai-gg/hiai-opencode` as an OpenCode plugin.
- Register `@tarquinen/opencode-dcp` only when the user wants Dynamic Context Pruning; it is a separate OpenCode plugin.
- Do not add MCP server npm packages to the OpenCode `plugin` array.
- Use `hiai-opencode.json` as the project-level service switchboard.
- Use `src/mcp/registry.ts` as the source of truth for default MCP launch wiring.
- Keep skill discovery deterministic by default: packaged plugin skills, generated builtin skills, explicit config sources, and project `.opencode/skills`.
- Do not enable global OpenCode, Claude, or Agents skill folders unless the user explicitly asks.
- Use `.env.example` as the key template, but never print, invent, commit, or hardcode secret values.
- Prefer user-level or project-local installs. Do not use sudo/admin rights unless the user explicitly asks.

### Bootstrap Checklist

1. Check tool availability:
   - `opencode --version`
   - `node --version`
   - `npx --version`
   - `bun --version`
   - `python --version` or `python3 --version`
   - `uv --version` when available
2. Check plugin registration with `opencode debug config`.
3. Find or create `hiai-opencode.json` in the project root or `.opencode/`.
4. Configure the `mcp` object there. Disable services that cannot run on the host.
5. Keep `skill_discovery` clean unless the user opts into external folders:
   - `config_sources: true`
   - `project_opencode: true`
   - `global_opencode: false`
   - `project_claude: false`
   - `global_claude: false`
   - `project_agents: false`
   - `global_agents: false`
6. Check environment variables without printing values:
   - `FIRECRAWL_API_KEY`
   - `STITCH_AI_API_KEY`
   - `CONTEXT7_API_KEY`
   - `GOOGLE_SEARCH_API_KEY`
   - `MEMPALACE_PYTHON`
   - `OPENCODE_RAG_URL`
   - `HIAI_PLAYWRIGHT_INSTALL_BROWSERS`
   - `HIAI_MCP_AUTO_INSTALL`
7. Verify with:
   - `opencode debug config`
   - `opencode mcp list --print-logs --log-level INFO`

### MCP Setup Matrix

| Service | Enable when | Dependency behavior |
|---|---|---|
| `playwright` | Node and npx are available | Helper launcher runs `@playwright/mcp@latest`; set `HIAI_PLAYWRIGHT_INSTALL_BROWSERS=1` to install Chromium on first start |
| `sequential-thinking` | Node and npx are available | Helper launcher runs `@modelcontextprotocol/server-sequential-thinking` |
| `firecrawl` | `FIRECRAWL_API_KEY` is set | Helper launcher runs `firecrawl-mcp` |
| `mempalace` | `uv` is available, or Python 3.9+ with pip is available | Launcher prefers `uv`; otherwise uses Python and can run `python -m pip install --user mempalace` when `HIAI_MCP_AUTO_INSTALL` is not disabled |
| `rag` | User has a local or remote RAG endpoint | Uses `OPENCODE_RAG_URL`, defaulting to `http://localhost:9002/tools/search` |
| `stitch` | `STITCH_AI_API_KEY` is set | Remote MCP endpoint |
| `context7` | User wants Context7 docs/search | Remote MCP endpoint; use `CONTEXT7_API_KEY` if available |

Playwright troubleshooting rules:

- If `skill_mcp` says `MCP server "playwright" not found`, first load the `playwright` skill and check `hiai-opencode mcp-status`; do not report this as a browser dependency failure.
- If Chromium reports missing Linux libraries (`libnspr4`, `libnss3`, `libatk-bridge`, `libgtk-3`, etc.), explain that MCP is present but the host lacks browser system dependencies.
- Without sudo, try a system browser override in `hiai-opencode.json`, such as `--browser chrome` or `--browser msedge`.
- If no browser path works, use `curl` only as degraded HTTP verification and explicitly say it is not a replacement for browser testing.

### Prompt For OpenCode Users

Users can paste this into OpenCode after installing the plugin:

```text
Finish hiai-opencode setup in this workspace.

Keep OpenCode plugins separate from MCP servers. Do not add MCP server packages to the OpenCode plugin list.

Verify @hiai-gg/hiai-opencode is registered. If I ask for Dynamic Context Pruning, install @tarquinen/opencode-dcp as a separate OpenCode plugin.

Find or create hiai-opencode.json in the project root or .opencode/. Use its mcp object as the only switchboard for MCP enable/disable.

Check which services can run here:
- playwright: node/npx; optionally HIAI_PLAYWRIGHT_INSTALL_BROWSERS=1.
- sequential-thinking: node/npx.
- firecrawl: FIRECRAWL_API_KEY.
- mempalace: uv or Python 3.9+ with pip; MEMPALACE_PYTHON if needed; HIAI_MCP_AUTO_INSTALL controls first-run pip install.
- rag: OPENCODE_RAG_URL or http://localhost:9002/tools/search.
- stitch: STITCH_AI_API_KEY.
- context7: optional CONTEXT7_API_KEY.

Report missing keys without printing secret values. Never invent or hardcode API keys.

Run opencode debug config and opencode mcp list --print-logs --log-level INFO if available. If something is missing, propose or run only user-level/project-local install commands.
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

There is one source of truth for model IDs:

- [hiai-opencode.json](hiai-opencode.json)

The runtime loader is:

- [src/config/defaults.ts](src/config/defaults.ts)

Users configure only the 10 primary agent model slots under `models`: `bob`, `coder`, `strategist`, `guard`, `critic`, `designer`, `researcher`, `manager`, `brainstormer`, and `vision`.
Hidden agents and task categories are derived internally in `src/config/defaults.ts`.
Use fully qualified model IDs. Do not introduce local aliases like `hiai-fast`, `sonnet`, `fast`, or `high`.

## Change Map

Use this table when you need to change something and want the right file immediately.

| Goal | Edit this first | Why |
|---|---|---|
| Change a user-facing default model slot | [hiai-opencode.json](hiai-opencode.json) | This is the canonical model source |
| Change how categories inherit the 10 model slots | [src/config/defaults.ts](src/config/defaults.ts) | Category routing is internal |
| Change MCP/LSP user-facing switches | [hiai-opencode.json](hiai-opencode.json) | Users only toggle enabled state there |
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
| Change skill discovery source defaults | [src/config/schema/skill-discovery.ts](src/config/schema/skill-discovery.ts), [src/plugin/skill-discovery-config.ts](src/plugin/skill-discovery-config.ts) | Controls opt-in external skill folders |
| Change skill source loading behavior | [src/plugin/skill-context.ts](src/plugin/skill-context.ts), [src/plugin-handlers/command-config-handler.ts](src/plugin-handlers/command-config-handler.ts) | Skills and skill-backed commands must stay aligned |
| Change MCP defaults | [src/mcp/registry.ts](src/mcp/registry.ts) | Default MCP wiring lives there |
| Change OpenCode MCP assembly | [src/mcp/index.ts](src/mcp/index.ts) | Final MCP config assembly lives there |
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

Default MCP wiring lives in:

- [src/mcp/registry.ts](src/mcp/registry.ts)

OpenCode MCP config assembly lives in:

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

## Skill Discovery Rules

Default behavior is intentionally deterministic.

Enabled by default:

- packaged `hiai-opencode` skill definitions mirrored into OpenCode's skill view
- generated builtin helper skills
- explicit `skills.sources` entries
- project-local `.opencode/skills` and `.opencode/skill`

Disabled by default:

- global OpenCode skills
- project and global Claude skills
- project and global Agents skills

Opt-in example:

```json
{
  "skill_discovery": {
    "global_opencode": true,
    "project_claude": true,
    "global_claude": false,
    "project_agents": false,
    "global_agents": false
  }
}
```

Use `skills.disable` for noisy individual skills:

```json
{
  "skills": {
    "disable": ["claude-md-management"]
  }
}
```

## Environment Variables

Use [.env.example](.env.example) as the canonical key template for local setup and release checks.

Model provider credentials are configured through OpenCode Connect. Do not ask users to put `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY` into `hiai-opencode.json` for normal model usage. The plugin stores model IDs only.

Common service keys:

- `STITCH_AI_API_KEY`
- `FIRECRAWL_API_KEY`
- `CONTEXT7_API_KEY`
- `GOOGLE_SEARCH_API_KEY`
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`
- `MEMPALACE_PYTHON`
- `MEMPALACE_PALACE_PATH`
- `OPENCODE_RAG_URL`
- `HIAI_PLAYWRIGHT_INSTALL_BROWSERS`
- `HIAI_MCP_AUTO_INSTALL`

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

Avoid reintroducing extra root docs that duplicate one of those roles.
