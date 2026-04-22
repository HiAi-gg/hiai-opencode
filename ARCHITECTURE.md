# hiai-opencode - Architecture

## Current Shape

`hiai-opencode` is a Bun-first OpenCode plugin bundle that presents the current canonical 12-agent model first, then layers skills, MCP integrations, LSP servers, and compatibility aliases around it.

It currently packages 12 canonical agents, 8 categories, 60+ hooks, 19 features, 17 tools, 11 MCP servers, 42 skills, 5 LSP servers, and 11 CLI commands.

## Canonical 12 Agents

| Agent | Role | Current implementation files |
|---|---|---|
| `bob` | Orchestrator and delegation hub | `src/agents/bob.ts`, `src/agents/bob/default.ts`, `src/agents/bob/gemini.ts`, `src/agents/bob/gpt-pro.ts` |
| `guard` | Workflow enforcer and closure validator | `src/agents/guard/agent.ts`, `src/agents/guard/default.ts`, `src/agents/guard/gemini.ts`, `src/agents/guard/gpt.ts` |
| `strategist` | Planning, architecture, and scope control | `src/agents/strategist/system-prompt.ts`, `src/agents/strategist/gemini.ts`, `src/agents/strategist/gpt.ts`, `src/agents/strategist/high-accuracy-mode.ts` |
| `critic` | High-risk review gate | Config and routing in `src/config/defaults.ts`, `src/shared/agent-tool-restrictions.ts`, `src/agents/strategist/high-accuracy-mode.ts`, and `src/agents/coder/gpt-pro.ts` |
| `coder` | Implementation and deep work | `src/agents/coder/agent.ts`, `src/agents/coder/gpt.ts`, `src/agents/coder/gpt-codex.ts`, `src/agents/coder/gpt-pro.ts` |
| `sub` | Bounded delegated executor | `src/agents/sub/agent.ts`, `src/agents/sub/default.ts`, `src/agents/sub/gemini.ts`, `src/agents/sub/gpt.ts`, `src/agents/sub/gpt-codex.ts`, `src/agents/sub/gpt-pro.ts` |
| `researcher` | Repo and external research | `src/agents/researcher.ts` |
| `multimodal` | Image, PDF, and layout analysis | `src/agents/ui.ts` |
| `quality-guardian` | Review and structured debugging | `src/agents/quality-guardian.ts` |
| `platform-manager` | Continuity, bootstrap, and mindmodel orchestration | `src/agents/platform-manager.ts` |
| `brainstormer` | Early ideation and concept shaping | Registered through `src/config/defaults.ts` and `src/agents/builtin-agents.ts` |
| `agent-skills` | Skill discovery and routing | Registered through `src/config/defaults.ts` and `src/agents/builtin-agents.ts` |

## Runtime Layers

### OpenCode Plugin Stack

- `oh-my-openagent` supplies the core orchestration, hook system, and bundled skills.
- `micode` contributes the legacy `mindmodel`, `ledger-creator`, `bootstrapper`, and `project-initializer` behavior through the current `platform-manager` wiring.
- `superpowers` enters through the Claude Code plugin bridge and contributes review and debugging workflows.
- `agent-skills` supplies tactical workflow patterns.
- `@tarquinen/opencode-dcp`, `opencode-pty`, and `opencode-websearch-cited` remain separate runtime dependencies.

### MCP Servers

The active OpenCode-facing MCP set is:

- `playwright`
- `stitch`
- `rag`
- `mempalace`
- `context7`
- `docker`
- `sequential-thinking`
- `firecrawl`

The built-in `grep-app` and `websearch` integrations come from the OpenCode plugin stack.

### Skills

- 21 project-local skills are bundled from `.opencode/skills/*/SKILL.md`.
- 7 built-in skills come from the plugin stack.
- 14 superpowers skills come through the Claude Code bridge.

## Configuration Shape

`hiai-opencode.json` is the single config source for:

- agent model assignments
- category routing
- MCP server definitions
- LSP server definitions
- permission rules
- skill enablement

## Legacy Alias Notes

These names are compatibility aliases only:

- `general`, `zoe`, `build` -> `bob`
- `pre-plan`, `logician`, `plan-consultant` -> `strategist`
- `librarian`, `explore` -> `researcher`
- `ui` -> `multimodal`
- `code-reviewer`, `systematic-debugger` -> `quality-guardian`
- `mindmodel`, `ledger-creator`, `bootstrapper`, `project-initializer` -> `platform-manager`

## Current File Signals

- Gemini overlays live in `src/agents/bob/gemini.ts`, `src/agents/strategist/gemini.ts`, and `src/agents/sub/gemini.ts`.
- GPT and Codex prompting uses `src/agents/bob/gpt-pro.ts`, `src/agents/strategist/gpt.ts`, `src/agents/coder/gpt-pro.ts`, `src/agents/coder/gpt-codex.ts`, `src/agents/sub/gpt.ts`, `src/agents/sub/gpt-codex.ts`, and `src/agents/sub/gpt-pro.ts`.
- `src/agents/gpt-apply-patch-guard.ts` remains the patch guard for GPT-family prompting.
- Legacy model-specific files are no longer part of the live docs or current runtime inventory.

