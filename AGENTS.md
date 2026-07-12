# AGENTS.md

Operator reference for autonomous agents and tooling that need to install, configure, verify, or modify `hiai-opencode`. For the product overview, see [README.md](README.md). For internals, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Production Environment

**This is a production project.** All tools, MCP servers, skills, and integrations must be functional at all times. If any service breaks during a session (build failures, test regressions, MCP errors), diagnose and fix immediately — never leave broken state behind.

## Purpose

`hiai-opencode` is an OpenCode plugin published as `@hiai-gg/hiai-opencode`. It is not a standalone app — it wires agents, prompts, skills, MCP launch commands, LSP defaults, and execution gates around the OpenCode runtime. Do not describe MCP servers, skills, model providers, or auxiliary plugins as owned by this repository.

## Install & Verify

```bash
opencode plugin @hiai-gg/hiai-opencode@latest --global
opencode debug config
hiai-opencode doctor        # exits non-zero on hard failures — CI-gateable
hiai-opencode mcp-status
```

`opencode mcp list` reads static `.opencode/.mcp.json` files in many OpenCode versions. The plugin auto-exports this file on startup (controlled by `HIAI_OPENCODE_AUTO_EXPORT_MCP`). To refresh manually: `hiai-opencode export-mcp .opencode/.mcp.json`.

For Dynamic Context Pruning (optional, separate plugin): `opencode plugin @tarquinen/opencode-dcp@latest --global`.

## Bootstrap Checklist

When asked to finish setup in a workspace:

1. **Tool availability**: `opencode --version`, `node --version` (≥20), `bun --version` (≥1.3), `npx --version`.
2. **Plugin registration**: `opencode debug config`.
3. **Config**: find/create `bob.json` in project root or `.opencode/`. Configure `models` (10 slots) and `mcp` (2 servers: `sequential-thinking`, `grep_app`).
4. **Env keys** (without printing values — see [bob.env.example](bob.env.example)):
   - `FIRECRAWL_API_KEY` — required for the Firecrawl CLI skill
   - `CONTEXT7_API_KEY` — optional, on-demand via `skill("explore/context7")`
   - `AGENT_BROWSER_SESSION`, `GREP_APP_API_KEY`, `OLLAMA_*` — optional
5. **Verify**: `opencode debug config`, `hiai-opencode doctor`, `hiai-opencode mcp-status`.

Operating rules: keep OpenCode plugins separate from MCP servers; never add MCP server packages to the `plugin` array; never print/invent/commit API keys; prefer user-level or project-local installs (no sudo).

### MCP setup matrix

| Service | Enable when | Notes |
|---|---|---|
| `sequential-thinking` | Node + npx available | Local, npx-backed |
| `grep_app` | User wants GitHub/code search | Remote, no key required |

Removed from default registry (v0.3.0): `mempalace`, `stitch`, `context7`. Context7 is an on-demand CLI skill. The CLI `MCP_REGISTRY` in [assets/cli/hiai-opencode.mjs](assets/cli/hiai-opencode.mjs) must mirror [src/features/mcp/registry.ts](src/features/mcp/registry.ts) — keep them in sync.

## Agent State

`createAllAgents()` ([src/agents/index.ts](src/agents/index.ts)) registers 8 agents. Four more (`explore`, `plan`, `build`, `general`) are native-upgraded inline in [src/index.ts](src/index.ts). The 10 model slots validated by `REQUIRED_AGENT_KEYS` in [src/config.ts](src/config.ts): `bob, build, plan, manager, critic, designer, explore, writer, vision, general`.

**Legacy name mapping** (no separate migration module — these exist only in CLI doctor diagnostics): `coder`→`build`, `strategist`→`plan`, `researcher`→`explore`, `sub`→`general`, `guard`→`manager`, `brainstormer`→`writer`.

**Task routing** (from Bob's prompt — sole source of truth):

| Category | Routes to |
|----------|-----------|
| `quick` | general |
| `deep` | build |
| `visual-engineering` | designer |
| `writing` | writer |
| `ultrabrain` | plan |
| review/verification | critic |
| research/discovery | explore |
| browser/visual | vision |

## Change Map

When you need to change something, edit the right file first.

| Goal | Edit |
|---|---|
| User-facing model slot | [bob.json](bob.json) |
| Internal defaults (permissions, mcp, lsp, completion) | [src/config.ts](src/config.ts) — `DEFAULT_CONFIG` |
| Agent prompt (any) | `src/agents/<agent>.ts` (flat: bob, build, plan, manager, critic, designer, writer, vision, explore, general) |
| Shared prompt fragments | [src/prompt-library/](src/prompt-library) (browser, caveman, native-memory, postgres-rules, workspace, worktree) |
| Runtime prompt injection | [src/hooks/closure-injector.ts](src/hooks/closure-injector.ts), [src/hooks/caveman-system-injector.ts](src/hooks/caveman-system-injector.ts) |
| Agent registration (visibility, mode, model) | [src/agents/index.ts](src/agents/index.ts) + [src/index.ts](src/index.ts) `hooks.config` |
| Per-agent permissions | [src/permissions.ts](src/permissions.ts) — `applyAgentPermissions()` |
| Closure protocol | [src/shared/closure.ts](src/shared/closure.ts) — `CLOSURE_SCHEMA_PROMPT` + `validateClosure()` |
| Prompt override / `prompt_append` | [src/agents/index.ts](src/agents/index.ts) — `applyPromptOverride()` |
| Skill tool | [src/tools/skill.ts](src/tools/skill.ts) |
| MCP server set | [src/features/mcp/registry.ts](src/features/mcp/registry.ts) |
| MCP auto-export | [src/features/mcp/auto-export.ts](src/features/mcp/auto-export.ts) |
| MCP assembly into OpenCode config | [src/index.ts](src/index.ts) `hooks.config` |
| Completion-controller gates | [src/features/completion-controller/](src/features/completion-controller) — `decide()`, state, signals |
| Circuit breaker thresholds | [src/features/background-manager/index.ts](src/features/background-manager/index.ts) |
| Worktree feature | [src/features/worktree/index.ts](src/features/worktree/index.ts), [src/tools/worktree.ts](src/tools/worktree.ts), [src/hooks/worktree-lifecycle.ts](src/hooks/worktree-lifecycle.ts) |
| LSP defaults | [src/config.ts](src/config.ts) — `DEFAULT_CONFIG.lsp` |
| CLI commands | [assets/cli/hiai-opencode.mjs](assets/cli/hiai-opencode.mjs) |
| npm bootstrap for MCP/LSP | [assets/runtime/npm-package-runner.mjs](assets/runtime/npm-package-runner.mjs) |

## Environment Variables

Use [bob.env.example](bob.env.example) as the canonical template. Model provider credentials go through OpenCode Connect — do **not** put `OPENROUTER_API_KEY`/`OPENAI_API_KEY`/`ANTHROPIC_API_KEY` into `bob.json`.

| Variable | Purpose |
|---|---|
| `FIRECRAWL_API_KEY` | Firecrawl CLI skill (web scraping) |
| `CONTEXT7_API_KEY` | On-demand library docs via `skill("explore/context7")` |
| `AGENT_BROWSER_SESSION` | Browser automation session name |
| `GREP_APP_API_KEY` | Optional grep.app search |
| `OLLAMA_BASE_URL`, `OLLAMA_MODEL` | Local Ollama models |
| `HIAI_OPENCODE_AUTO_EXPORT_MCP` | `if-missing` (default) \| `always` \| `off` |
| `HIAI_OPENCODE_MCP_EXPORT_PATH` | Override `.opencode/.mcp.json` output path |
| `HIAI_OPENCODE_EXPORT_MCP_MODE` | `safe` (default) \| `force` (overwrite policy) |

Use `{env:VAR_NAME}` placeholders in config JSON — never raw keys, never `${VAR}` (blocked for names containing `KEY`/`TOKEN`/`SECRET`). Check with `grep -E '(fc-\|ctx7sk-\|sk-\|key-)' bob.json` — should return 0 matches.

## Mental Map

```
AGENTS:    bob (orchestrator) · build (impl) · plan (architecture) · explore (discovery)
           critic (review gate) · designer · writer · vision (browser) · manager · general (fallback)
MCP:       grep_app -> explore, build · sequential-thinking -> plan, critic
CLI SKILLS: firecrawl -> explore · context7 -> explore, build · agent-browser -> vision
LSP:       typescript, svelte, eslint, bash, pyright → build MUST run lsp_diagnostics after every edit
GATES:     critic-review · quality-gate · lsp-pending · legal-gate · circuit-breaker · closure
```

## Closure Protocol

Every agent response MUST end with a `<CLOSURE>` block. Injected via `CLOSURE_SCHEMA_PROMPT` from [src/shared/closure.ts](src/shared/closure.ts); the `closure-injector` hook appends it when missing.

```xml
<CLOSURE>
{ "reasoning": "...", "evidence": ["..."], "readiness": "done" | "accept" | "reject" }
</CLOSURE>
```

`readiness` is validated against the enum by `validateClosure()`. `<CLOSURE>` (task completion) is separate from `<promise>DONE</promise>` (loop continuation signal) — both can coexist.

If an agent response is missing `<CLOSURE>` at runtime: (1) check the agent prompt imports `CLOSURE_SCHEMA_PROMPT`, (2) check `closure-injector` is not in `hooks.disabled`, (3) check `validateClosure()` parses the block.

## Troubleshooting

### `hiai-opencode` CLI not found
Since v0.3.6 the CLI installs via the `bin` field in [package.json](package.json). If it's missing, reinstall: `opencode plugin @hiai-gg/hiai-opencode@latest --global`. For dev: `npm link` from the plugin dir.

### `doctor` reports schema errors
Check your `bob.json` against [config/hiai-opencode.schema.json](config/hiai-opencode.schema.json). Verify `models` and `mcp` keys match documented shapes. Run `opencode debug config`.

### `mcp-status` shows all services ⚠️ missing
The plugin can't find its bundled config. Run `bun run build` to populate `dist/`, or reinstall from npm.

### `opencode mcp list` doesn't show hiai-opencode servers
`opencode mcp list` reads static config, not runtime plugin MCP. Run `hiai-opencode export-mcp .opencode/.mcp.json` to write a static export. The plugin auto-exports on startup unless `HIAI_OPENCODE_AUTO_EXPORT_MCP=off`.

### Firecrawl "API_KEY missing" despite the key being set
Firecrawl is a CLI skill, not an MCP server. The env var must be in the shell that runs the CLI skill — `export FIRECRAWL_API_KEY=fc-...` before starting OpenCode, or set it in `bob.env`. It is NOT configured in the `mcp` block.

### Browser automation
Use the `/agent-browser` skill (not MCP). Install: `bun add -g agent-browser && agent-browser install`. Uses native Chrome via CDP — no Playwright. Key env: `AGENT_BROWSER_HEADED=1`, `AGENT_BROWSER_SESSION=name`. Pattern: `snapshot -i --json` → @eN refs → `click @e2`. Repo: https://github.com/vercel-labs/agent-browser

### Agent prompt correct in source but wrong at runtime
The runtime prompt is assembled in layers: (1) `src/agents/<agent>.ts`, (2) `src/prompt-library/*.ts` imports, (3) runtime hooks (closure-injector, caveman-system-injector), (4) `hooks.config` in [src/index.ts](src/index.ts) applies model/visibility/permissions. Inspect `hooks.config` first when runtime output diverges from source.

### Circuit breaker triggered
Sessions are aborted at 20+ consecutive identical tool calls (default) or 4000+ total tool calls (default). Search logs for `[background-agent] Circuit breaker:`. Adjust via `background_manager.circuit_breaker.consecutive_threshold` / `max_tool_calls` in config. State is in-memory only — lost on restart.

### Windows EPERM spawning local MCP
Windows/OpenCode may fail to spawn local MCP processes (`sequential-thinking`, npx-backed) with `EPERM`. The plugin definition is correct; the host runtime is the blocker.

## Common Pitfalls

- **MCP servers are not plugins.** Don't add `@modelcontextprotocol/server-sequential-thinking` to the `plugin` array — only `@hiai-gg/hiai-opencode` goes there. MCP wiring is in the `mcp` config block.
- **Don't invent model prefixes.** Run `opencode models`, copy exact `provider/model-id` strings. `openrouter/minimax/` won't work unless Connect authorized that exact prefix.
- **Don't write code in Bob or Manager.** Bob orchestrates; Manager stewards memory/tasks. Implementation goes to `build`.
- **`{env:VAR}` not `${VAR}`** in hiai-opencode config files — the latter blocks names containing `KEY`/`TOKEN`/`SECRET`.
- **Never hardcode API keys** in JSON. Use `{env:VARIABLE_NAME}` placeholders.
- **Bob's prompt is the routing source of truth** — there is no separate TypeScript routing map.

## Documentation

- [README.md](README.md) — what it is, why, install, what's inside
- [ARCHITECTURE.md](ARCHITECTURE.md) — internal wiring, prompting layers, modification map
- [CHANGELOG.md](CHANGELOG.md) — version history
- [LICENSE.md](LICENSE.md) — MIT
