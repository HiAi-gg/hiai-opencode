# HiaiOpenCode Registry

This is the current reference for the canonical 12-agent model, active integrations, and compatibility aliases in `hiai-opencode`.

## Platform Sources

| Component | Source repository | Role |
|---|---|---|
| `oh-my-openagent` | `code-yeongyu/oh-my-openagent` | Core orchestration and prompt/runtime wiring |
| `micode` | `vtemian/micode` | Platform and continuity specialists |
| `superpowers` | `obra/superpowers` | Planning, review, and debugging workflows |
| `agent-skills` | `addyosmani/agent-skills` | Tactical workflow patterns |
| `@tarquinen/opencode-dcp` | `Opencode-DCP/opencode-dynamic-context-pruning` | Context pruning |
| `mempalace` | `MemPalace/mempalace` | Semantic memory |
| `websearch-cited` | `ghoulr/opencode-websearch-cited` | Grounded web search |
| `playwright-mcp` | `microsoft/playwright-mcp` | Browser automation |
| `stitch-mcp` | `Kargatharaakash/stitch-mcp` | Design systems and tokens |
| `firecrawl-mcp` | `firecrawl-ai/firecrawl-mcp-server` | Web crawling |
| `sequential` | `modelcontextprotocol/servers` | Multi-step reasoning |
| `pty` | `shekohex/opencode-pty` | Terminal multiplexing |

## Canonical 12 Agents

| Agent | Role | Current file paths |
|---|---|---|
| `bob` | Orchestrator and delegation hub | `src/agents/bob.ts`, `src/agents/bob/default.ts`, `src/agents/bob/gemini.ts`, `src/agents/bob/gpt-pro.ts` |
| `guard` | Workflow enforcer and closure validator | `src/agents/guard/agent.ts`, `src/agents/guard/default.ts`, `src/agents/guard/gemini.ts`, `src/agents/guard/gpt.ts` |
| `strategist` | Planning, architecture, scope control | `src/agents/strategist/system-prompt.ts`, `src/agents/strategist/gemini.ts`, `src/agents/strategist/gpt.ts`, `src/agents/strategist/high-accuracy-mode.ts` |
| `critic` | High-risk review gate | Config/runtime wiring in `src/config/defaults.ts`, `src/shared/agent-tool-restrictions.ts`, and `src/agents/strategist/high-accuracy-mode.ts` |
| `coder` | Implementation and deep work | `src/agents/coder/agent.ts`, `src/agents/coder/gpt.ts`, `src/agents/coder/gpt-codex.ts`, `src/agents/coder/gpt-pro.ts` |
| `sub` | Bounded delegated executor | `src/agents/sub/agent.ts`, `src/agents/sub/default.ts`, `src/agents/sub/gemini.ts`, `src/agents/sub/gpt.ts`, `src/agents/sub/gpt-codex.ts`, `src/agents/sub/gpt-pro.ts` |
| `researcher` | Repo and external research | `src/agents/researcher.ts` |
| `multimodal` | Image, PDF, and layout analysis | `src/agents/ui.ts` |
| `quality-guardian` | Review and structured debugging | `src/agents/quality-guardian.ts` |
| `platform-manager` | Continuity, bootstrap, and mindmodel orchestration | `src/agents/platform-manager.ts` |
| `brainstormer` | Early ideation and concept shaping | Registered through `src/config/defaults.ts` and `src/agents/builtin-agents.ts` |
| `agent-skills` | Skill discovery and routing | Registered through `src/config/defaults.ts` and `src/agents/builtin-agents.ts` |

## Skills and Integrations

- Current project-local skills live in `.opencode/skills/*/SKILL.md`.
- Bundled built-in skills come from the current OpenCode plugin wiring.
- Active MCP integrations include `playwright`, `stitch`, `rag`, `mempalace`, `context7`, `docker`, `sequential-thinking`, and `firecrawl`, plus the built-in `grep-app` and `websearch` integrations provided by the OpenCode plugin stack.
- Legacy model-specific files are archived; the registry only tracks current agent paths and compatibility aliases.

## Legacy Alias Notes

Legacy names are kept only for compatibility at the config boundary:

- `general`, `zoe`, `build` -> `bob`
- `pre-plan`, `logician`, `plan-consultant` -> `strategist`
- `librarian`, `explore` -> `researcher`
- `ui` -> `multimodal`
- `code-reviewer`, `systematic-debugger` -> `quality-guardian`
- `mindmodel`, `ledger-creator`, `bootstrapper`, `project-initializer` -> `platform-manager`
