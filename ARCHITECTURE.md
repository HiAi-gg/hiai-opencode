# hiai-opencode — Unified OpenCode Plugin

## Vision

One plugin. One install. Everything configured.

`hiai-opencode` consolidates 8 separate plugins + 1 Claude Code plugin bridge into a single publishable npm package that configures 18 agents + 8 categories + 60+ hooks + 19 features + 17 tools + 11 MCP servers + 41 skills (21 project + 6 oh-my-openagent + 14 superpowers) + 5 LSP servers + 11 CLI commands (8 oh-my-openagent + 3 superpowers). Users install one plugin and get the full stack.

---

## What We're Replacing

### Current Plugin Stack (8 plugins in opencode.json)

| Plugin | What It Does | Disposition |
|---|---|---|
| `oh-my-openagent` v3.17.2 | Agent orchestration (10 builtin agents + 60+ hooks + 19 features + 17 tools + 3 MCPs + 6 skills + 8 CLI commands), LSP/AST tools, background agents | **Core dependency** — wrap and re-export |
| `micode` v0.10.0 | 4 unique agents (mindmodel, ledger-creator, bootstrapper, project-initializer), brainstorm/octto tools | **Absorb unique agents** |
| `@tarquinen/opencode-dcp` v3.1.9 | Dynamic context pruning (token optimization) | **Keep as dependency** |
| `@openspoon/subtask2` v0.3.9 | Enhanced /command orchestration: `return` (prompt chaining), `parallel` (concurrent subtasks), `$ARGUMENTS` pipe syntax, `$TURN[n]` conversation turn injection. **NOT redundant** — oh-my-openagent's task system handles subagent spawning; subtask2 handles command-level workflow orchestration (different layer) | **Keep as dependency** |
| `opencode-fast-apply` | Fast file apply (Morph API) | **Keep as dependency** |
| `opencode-pty` | PTY/terminal management | **Keep as dependency** |
| `@zenobius/opencode-skillful` | Skill loading from SKILL.md files | **Absorbed by oh-my-openagent** (it has `opencode-skill-loader` feature) |
| `opencode-websearch-cited` | Gemini web search with citations | **Keep as dependency** |

### Current MCP Servers — Three Layers

**Layer 1: opencode.json (8 externally configured servers)**
Config source: `infra/opencode/data/opencode.json`

| MCP | Transport | Start Command / URL | How It Works | Env Vars |
|---|---|---|---|---|
| `playwright` | remote | `http://localhost:9014/mcp` | Docker service running Playwright MCP server. Already running as a container — OpenCode connects via HTTP SSE. | — |
| `stitch` | local (bash) | `bash scripts/opencode_stitch_mcp.sh` | Bash wrapper → finds cached `stitch-mcp-auto/index.js` or falls back to `npx -y stitch-mcp-auto`. OAuth token auto-refreshed every 30min by `ai-stitch-token-refresh.timer` systemd unit. Tokens at `~/.stitch-mcp-auto/tokens.json`. | `STITCH_AI_API_KEY`, `STITCH_AI_BASE_URL` |
| `rag` | local (node) | `node scripts/opencode_rag_mcp.mjs` | 211-line Node.js MCP server implementing JSON-RPC over stdin/stdout. Tool: `search_rag` (query, agent, limit, self_identity, style_mode, include_graph, scope). Proxies requests to FastAPI RAG backend at port 9002 (`infra/docker/mcp/rag.py`). | `OPENCODE_RAG_URL=http://localhost:9002/tools/search` |
| `mempalace` | local (bash→python) | `bash scripts/opencode_mempalace_mcp.sh` | Bash wrapper → `python3 -m mempalace.mcp_server` with `MEMPALACE_PALACE_PATH=/mnt/ai_data/cache/mempalace/opencode`. Python MCP server for semantic memory palace (ChromaDB-backed knowledge graph). | — |
| `context7` | local (npx) | `npx -y @upstash/context7-mcp` | npm package. Library/framework documentation search via Upstash API. **NOTE: Also bundled inside oh-my-openagent as built-in MCP (DUPLICATE).** | `CONTEXT7_API_KEY` |
| `docker` | local (npx) | `npx -y docker-mcp` | npm package. Container management, shell access. Used for psql/redis-cli access to databases. | `DOCKER_MCP_LOCAL=true` |
| `sequential-thinking` | local (npx) | `npx -y @modelcontextprotocol/server-sequential-thinking` | npm package. Chain-of-thought reasoning server for difficult multi-step traces. | — |
| `firecrawl` | local (npx) | `npx -y firecrawl-mcp` | npm package. Web crawling and page extraction via Firecrawl API. | `FIRECRAWL_API_KEY` |

**Layer 2: oh-my-openagent built-in MCPs (3 bundled in plugin)**
Source: `oh-my-openagent/dist/mcp/` — these are compiled into the oh-my-openagent npm package and registered automatically.

| MCP | What It Does | Notes |
|---|---|---|
| `context7` | Library docs (same as Layer 1) | **DUPLICATE** — configured both externally and inside oh-my-openagent. Only one instance should run. |
| `grep-app` | GitHub code search via grep.app API | Unique to oh-my-openagent. Provides `grep_app_searchGitHub` tool. |
| `websearch` | Exa web search with semantic results | Unique to oh-my-openagent. Provides `websearch_web_search_exa` tool. |

**Layer 3: Docker-side MCP servers (11 Python servers) — NOT used by OpenCode directly**
Source: `infra/docker/mcp/` — these serve the orchestration pipeline (LangGraph), not OpenCode. Included for reference.

| Server | Port | Purpose |
|---|---|---|
| `router.py` | 9000 | Smart scrape, browse routing |
| `browser.py` | 9001 | Minimal browser automation |
| `rag.py` | 9002 | RAG search backend (Layer 1 `rag` MCP proxies to this) |
| `content.py` | 9003 | PII validation |
| `http_client.py` | 9004 | HTTP request execution |
| `db.py` | 9005 | Read-only SQL queries |
| `fs.py` | 9006 | Filesystem read/write |
| `math_tool.py` | 9007 | Math evaluation |
| `notify.py` | 9008 | Notification dispatch |
| `scrapling.py` | 9009 | HTML scraping |
| `firecrawl.py` | 9012 | Firecrawl API wrapper |

**What transfers to hiai-opencode:** Layer 1 (8 servers) + Layer 2 (3 built-in MCPs) = 11 MCP servers total. Layer 3 stays in Docker infra, untouched.

### Current Skills (21 project-local)

All in `.opencode/skills/*/SKILL.md` — lifecycle-ordered development skills.

### Current Agents

> **Clarification: oh-my-openagent.json has 15 entries ≠ 15 agents**
>
> The `.opencode/oh-my-openagent.json` config file has **7 agent entries + 8 category entries = 15 lines**.
> But these are **model config overrides**, not the complete agent list:
> - The 7 agents listed (sisyphus, prometheus, hephaestus, atlas, sisyphus-junior, metis, momus) are only those needing explicit model assignments
> - 3 more builtin agents (oracle, librarian, explore, multimodal-looker) exist in code but use internal fallback model chains — they don't appear in config unless you override them
> - The 8 categories (visual-engineering, artistry, etc.) route delegated tasks to models — they are NOT agents
>
> Actual agent count: 10 builtin + 3 feature-agents + 4 micode + 1 superpowers = **18 unique agents**

**oh-my-openagent builtin agents (10)** — defined in `BuiltinAgentName` type:
- `sisyphus` (primary) — Orchestrator, model configurable
- `hephaestus` (primary) — Builder, model configurable
- `atlas` (primary) — Architecture, model configurable
- `sisyphus-junior` (subagent) — Lightweight tasks, model configurable
- `oracle` (subagent) — Read-only consultant, model configurable
- `librarian` (subagent) — Reference grep, model configurable
- `explore` (subagent) — Contextual grep, model configurable
- `metis` (subagent) — Pre-planning consultant, model configurable
- `momus` (subagent) — Plan critic, model configurable
- `multimodal-looker` (subagent) — Media analysis, model configurable

**oh-my-openagent also provides (via features, not agents):**
- `prometheus` — Deep research (has dedicated prompt dir)
- `build` — Default executor (overridable, not a BuiltinAgentName)
- `general` — General-purpose (from claude-code-agent-loader feature)

**micode unique agents (4):**
- `mindmodel` — Pattern catalog
- `ledger-creator` — Session state preservation
- `bootstrapper` — Exploration branches
- `project-initializer` — Project scaffolding

**Superpowers (Claude Code plugin, loaded via oh-my-openagent's `claude-code-plugin-loader` feature):**
Superpowers v5.0.7 is a **Claude Code plugin** (NOT an OpenCode plugin). It's installed at `~/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.7/` and loaded into OpenCode via oh-my-openagent's `claude-code-plugin-loader` feature which bridges Claude Code plugins.

It provides:
- 1 agent: `code-reviewer` (agents/code-reviewer.md)
- 14 skills: brainstorming, dispatching-parallel-agents, executing-plans, finishing-a-development-branch, receiving-code-review, requesting-code-review, subagent-driven-development, systematic-debugging, test-driven-development, using-git-worktrees, using-superpowers, verification-before-completion, writing-plans, writing-skills
- 3 commands: brainstorm, write-plan, execute-plan
- Hooks: `SessionStart` hook runs `session-start` script
- Bootstrap: Injects `using-superpowers` skill content into first user message via `experimental.chat.messages.transform`
- Config hook: Registers `skills/` directory path so OpenCode discovers superpowers skills
- OpenCode entry: `.opencode/plugins/superpowers.js` (112-line ESM plugin)

**How superpowers gets into OpenCode:**
1. oh-my-openagent feature `claude-code-plugin-loader` scans `~/.claude/plugins/` for installed Claude Code plugins
2. Finds superpowers v5.0.7 with its `package.json` pointing to `.opencode/plugins/superpowers.js`
3. Loads `superpowers.js` as an OpenCode plugin — it registers skill paths and injects bootstrap context
4. Result: All 14 superpowers skills + 3 commands + 1 agent become available in OpenCode

**Total: 10 builtin + 3 feature-agents + 4 micode + 1 superpowers agent + 14 superpowers skills = 18 unique agents + 14 skill-based workflows**

---

## Complete Feature Inventory (everything that transfers)

### oh-my-openagent — Full Capability Map

**60+ Hooks** (all transfer via wrapping):
| Category | Hooks |
|---|---|
| Agent behavior | agent-usage-reminder, atlas, category-skill-reminder, no-hephaestus-non-gpt, no-sisyphus-gpt, sisyphus-junior-notepad, unstable-agent-babysitter |
| Error recovery | anthropic-context-window-limit-recovery, edit-error-recovery, json-error-recovery, model-fallback, runtime-fallback |
| Compaction/context | anthropic-effort, compaction-context-injector, compaction-todo-preserver, context-window-monitor, preemptive-compaction (3 variants), tool-output-truncator |
| Session management | background-notification, session-notification (6 variants), session-recovery, session-todo-status |
| Code quality | bash-file-read-guard, comment-checker, empty-task-response-detector, write-existing-file-guard, tool-pair-validator, thinking-block-validator |
| UI/UX | auto-slash-command, auto-update-checker, hashline-edit-diff-enhancer, hashline-read-enhancer, question-label-truncator, read-image-resizer, legacy-plugin-toast |
| Task system | delegate-task-retry, ralph-loop, start-work, stop-continuation-guard, task-reminder, task-resume-info, tasks-todowrite-disabler, todo-continuation-enforcer, todo-description-override |
| Injection | directory-agents-injector, directory-readme-injector, keyword-detector, rules-injector, prometheus-md-only |
| Environment | claude-code-hooks, interactive-bash-session, non-interactive-env, think-mode, webfetch-redirect-guard |

**19 Features** (all transfer via wrapping):
| Feature | Purpose |
|---|---|
| background-agent | Background task execution for subagents |
| boulder-state | Persistent state for long-running work |
| builtin-commands | CLI command registration (init-deep, ralph-loop, etc.) |
| builtin-skills | 6 built-in skill definitions |
| claude-code-agent-loader | Loads claude-code compatible agents (build, general, plan, etc.) |
| claude-code-command-loader | Loads claude-code compatible commands |
| claude-code-mcp-loader | Loads claude-code MCP configs |
| claude-code-plugin-loader | Loads claude-code plugins |
| claude-code-session-state | Session state management |
| claude-tasks | Task/subtask management system |
| context-injector | Injects context into agent prompts |
| hook-message-injector | Injects hook messages into conversation |
| mcp-oauth | OAuth token management for MCP servers |
| opencode-skill-loader | Loads SKILL.md files from project |
| run-continuation-state | Continuation state for multi-turn runs |
| skill-mcp-manager | MCP servers embedded in skills |
| task-toast-manager | Toast notifications for task events |
| tmux-subagent | Tmux-based subagent sessions |
| tool-metadata-store | Metadata storage for tool usage |

**17 Tools** (all transfer via wrapping):
| Tool | Purpose |
|---|---|
| ast-grep | AST-aware code search/replace |
| background-task | Background task management |
| call-omo-agent | Agent invocation |
| delegate-task | Task delegation to subagents |
| glob | File pattern matching |
| grep | Content search |
| hashline-edit | Line-addressable file editing |
| interactive-bash | Interactive terminal sessions |
| look-at | Media file analysis |
| lsp | Language server protocol tools (goto-definition, find-references, symbols, diagnostics, rename) |
| session-manager | Session list/read/search/info |
| skill | Skill loading and invocation |
| skill-mcp | Skill-embedded MCP operations |
| slashcommand | Slash command execution |
| task | Task spawning and management |

**3 Built-in MCPs** (transfer as defaults in config):
- `context7` — Library docs (Upstash)
- `grep-app` — GitHub code search
- `websearch` — Exa web search

**6 Built-in Skills** (transfer as bundled assets):
- playwright, frontend-ui-ux, git-master, dev-browser, review-work, ai-slop-remover

**8 CLI Commands** (transfer via builtin-commands feature):
- init-deep, ralph-loop, ulw-loop, cancel-ralph, refactor, start-work, stop-continuation, handoff, remove-ai-slops

**8 Categories** (transfer via config):
- visual-engineering, artistry, ultrabrain, deep, quick, writing, unspecified-low, unspecified-high

### Superpowers v5.0.7 (Claude Code plugin, loaded via bridge)

**Source:** `~/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.7/`
**License:** MIT
**How loaded:** oh-my-openagent feature `claude-code-plugin-loader` scans `~/.claude/plugins/`, finds superpowers, loads `.opencode/plugins/superpowers.js`

| Component | Count | Details |
|---|---|---|
| Agent | 1 | `code-reviewer` (agents/code-reviewer.md) |
| Skills | 14 | brainstorming, dispatching-parallel-agents, executing-plans, finishing-a-development-branch, receiving-code-review, requesting-code-review, subagent-driven-development, systematic-debugging, test-driven-development, using-git-worktrees, using-superpowers, verification-before-completion, writing-plans, writing-skills |
| Commands | 3 | brainstorm, write-plan, execute-plan |
| Hooks | 1 | `SessionStart` → runs `hooks/session-start` script |

**Plugin entry (`superpowers.js`) does two things:**
1. `config` hook — pushes `skills/` directory path into `config.skills.paths[]` so OpenCode discovers all 14 skills
2. `experimental.chat.messages.transform` hook — injects `using-superpowers` skill content + tool mapping into first user message of each session

**Other Claude Code plugins installed (also loaded via bridge):**
context7, code-simplifier (1.0.0), playwright, frontend-design, skill-creator, claude-md-management (1.0.0), prisma

**For hiai-opencode:** Include superpowers as optional Claude Code plugin bridge. The `claude-code-plugin-loader` feature in oh-my-openagent handles this automatically — no additional code needed. Document the dependency clearly.

### @openspoon/subtask2 — Command Orchestration Layer

**Unique capabilities not in oh-my-openagent:**
| Feature | What It Does |
|---|---|
| `return` | Prompt chaining after subtask/command completion. First return replaces OpenCode's generic "summarize" message. Subsequent returns fire sequentially. Supports `/command` triggers. |
| `parallel` | Run multiple /commands as concurrent subtasks. All complete before parent's return fires. |
| `$ARGUMENTS` | Pass arguments via frontmatter or `\|\|` pipe syntax. Priority: pipe > frontmatter > inherit. |
| `$TURN[n]` | Inject last N conversation turns into command body. Supports `[n]`, `[:n]`, `[:a:b:c]`, `[*]` syntax. |
| Config | `~/.config/opencode/subtask2.jsonc` — `replace_generic`, `generic_return` defaults. |

**Why it's NOT redundant:** oh-my-openagent's `task` tool spawns subagents with prompts. subtask2 orchestrates `/commands` with chaining, parallel execution, argument piping, and turn injection. Different abstraction level — agent-level vs command-level.

### @tarquinen/opencode-dcp — Token Optimization
- Dynamic context pruning
- Reduces token usage in long sessions

### opencode-fast-apply — File Operations
- Fast file apply via Morph API
- Provides `fast_apply_edit` and `morph_edit` tools

### opencode-pty — Terminal Management
- PTY spawn/read/write/kill/list tools
- Interactive terminal sessions via `bun-pty`

### opencode-websearch-cited — Web Search
- Gemini-style grounded web search
- Returns digest with inline citations + source URLs

### micode (4 unique agents to absorb)
| Agent | What It Does |
|---|---|
| mindmodel | Pattern catalog — mm-* series (stack-detector, dependency-mapper, convention-extractor, etc.) |
| ledger-creator | Creates/updates continuity ledgers for session state preservation |
| bootstrapper | Creates exploration branches with scopes for octto brainstorming |
| project-initializer | Project scaffolding and initialization |

### All Skills (41 total across 3 sources)

**21 Project-Local Skills (bundle as package assets):**
api-and-interface-design, browser-testing-with-devtools, ci-cd-and-automation, code-review-and-quality, code-simplification, context-engineering, debugging-and-error-recovery, deprecation-and-migration, documentation-and-adrs, frontend-ui-engineering, git-workflow-and-versioning, idea-refine, incremental-implementation, performance-optimization, planning-and-task-breakdown, security-and-hardening, shipping-and-launch, source-driven-development, spec-driven-development, test-driven-development, using-agent-skills

**6 oh-my-openagent Built-in Skills (come with oh-my-openagent dependency):**
ai-slop-remover, dev-browser, frontend-ui-ux, git-master, playwright, review-work

**14 Superpowers Skills (come via Claude Code plugin bridge):**
brainstorming, dispatching-parallel-agents, executing-plans, finishing-a-development-branch, receiving-code-review, requesting-code-review, subagent-driven-development, systematic-debugging, test-driven-development, using-git-worktrees, using-superpowers, verification-before-completion, writing-plans, writing-skills

---

## Architecture

### Package Structure

```
hiai-opencode/
├── package.json                 # npm package, bun-first
├── tsconfig.json
├── src/
│   ├── index.ts                 # Plugin entry: exports Plugin
│   ├── config/
│   │   ├── schema.ts            # Zod schema for hiai-opencode.json
│   │   ├── defaults.ts          # Default config values
│   │   └── loader.ts            # Config file discovery + parsing
│   ├── agents/
│   │   ├── index.ts             # Agent registry
│   │   ├── definitions/         # Per-agent prompt + config
│   │   │   ├── mindmodel.ts     # From micode
│   │   │   ├── ledger-creator.ts
│   │   │   ├── bootstrapper.ts
│   │   │   └── project-initializer.ts
│   │   └── micode-adapter.ts    # Adapts micode's 4 unique agents to oh-my-openagent format
│   ├── mcp/
│   │   ├── index.ts             # MCP config generator
│   │   ├── defaults.ts          # Default MCP server definitions
│   │   └── types.ts
│   ├── skills/
│   │   ├── index.ts             # Skill bundler
│   │   └── definitions/         # 21 SKILL.md files bundled as strings
│   │       ├── api-and-interface-design.ts
│   │       ├── ... (all 21)
│   │       └── using-agent-skills.ts
│   ├── lsp/
│   │   ├── index.ts             # LSP config generator
│   │   └── defaults.ts          # Default LSP server definitions
│   ├── hooks/
│   │   ├── index.ts             # Hook aggregator
│   │   └── lifecycle.ts         # Skill lifecycle enforcement hook
│   └── permissions/
│       ├── index.ts             # Permission generator
│       └── defaults.ts          # Default permission rules
├── config/
│   └── hiai-opencode.schema.json  # JSON Schema for config file
├── skills/                      # Bundled SKILL.md files (raw)
│   ├── api-and-interface-design/
│   │   └── SKILL.md
│   ├── ... (all 21)
│   └── using-agent-skills/
│       └── SKILL.md
└── dist/                        # Build output
    └── index.js
```

### Config File: `hiai-opencode.json`

Single config file replaces:
- `.opencode/oh-my-openagent.json` (agent models + categories)
- MCP server configs in `opencode.json`
- LSP server configs in `opencode.json`
- Permission configs in `opencode.json`
- Skill enable/disable in `.opencode/skills/`

```jsonc
// .opencode/hiai-opencode.json
{
  "$schema": "https://raw.githubusercontent.com/your-org/hiai-opencode/main/config/hiai-opencode.schema.json",

  // ═══════════════════════════════════════════════════════════════
  // AGENTS — model assignment for all 18 agents
  // ═══════════════════════════════════════════════════════════════
  // oh-my-openagent BuiltinAgentName (10): sisyphus, hephaestus, atlas,
  //   sisyphus-junior, oracle, librarian, explore, metis, momus, multimodal-looker
  // Feature-agents (3): prometheus, build, general (general uses category model)
  // Micode unique (4): mindmodel, ledger-creator, bootstrapper, project-initializer
  // Superpowers (1): code-reviewer
  //
  // NOTE: Current oh-my-openagent.json only lists 7 agents — the other builtin
  // agents (oracle, librarian, explore, multimodal-looker) use internal fallback
  // model chains. In hiai-opencode, ALL agents are explicitly configurable.
  "agents": {
    // Primary agents (respect UI model selection)
    "sisyphus":        { "model": "openrouter/anthropic/claude-opus-4-6" },
    "hephaestus":      { "model": "openrouter/openai/gpt-5.4" },
    "atlas":           { "model": "openrouter/xiaomi/mimo-v2-pro" },
    // Subagents (use own model, ignore UI selection)
    "sisyphus-junior": { "model": "openrouter/google/gemini-3.1-pro-preview" },
    "oracle":          { "model": "openrouter/anthropic/claude-opus-4-6" },
    "librarian":       { "model": "openrouter/google/gemini-3.1-pro-preview" },
    "explore":         { "model": "openrouter/google/gemini-3.1-pro-preview" },
    "metis":           { "model": "openrouter/openai/gpt-5.4" },
    "momus":           { "model": "openrouter/qwen/qwen3.6-plus" },
    "multimodal-looker": { "model": "openrouter/google/gemini-3.1-pro-preview" },
    // Feature-agents
    "prometheus":      { "model": "openrouter/z-ai/glm-5.1" },
    "build":           { "model": "openrouter/anthropic/claude-sonnet-4-6" },
    // Micode unique agents (absorbed)
    "mindmodel":       { "model": "openrouter/google/gemini-3.1-pro-preview" },
    "ledger-creator":  { "model": "openrouter/google/gemini-3.1-pro-preview" },
    "bootstrapper":    { "model": "openrouter/google/gemini-3.1-pro-preview" },
    "project-initializer": { "model": "openrouter/openai/gpt-5.4" },
    // Superpowers agent
    "code-reviewer":   { "model": "openrouter/anthropic/claude-sonnet-4-6" }
  },

  // ═══════════════════════════════════════════════════
  // CATEGORIES — model routing for delegated task types
  // ═══════════════════════════════════════════════════
  "categories": {
    "visual-engineering": { "model": "openrouter/google/gemini-3.1-pro-preview", "variant": "high" },
    "artistry":          { "model": "openrouter/google/gemini-3.1-pro-preview", "variant": "high" },
    "ultrabrain":        { "model": "openrouter/openai/gpt-5.4", "variant": "xhigh" },
    "deep":              { "model": "openrouter/x-ai/grok-4.20-multi-agent", "variant": "medium" },
    "quick":             { "model": "openrouter/openai/gpt-5.4-mini" },
    "writing":           { "model": "openrouter/kimi-for-coding/k2p5" },
    "unspecified-low":   { "model": "openrouter/minimax/minimax-m2.7" },
    "unspecified-high":  { "model": "openrouter/anthropic/claude-sonnet-4-6", "variant": "max" }
  },

  // ═══════════════════════════════════════
  // MCP — external tool server definitions
  // ═══════════════════════════════════════
  "mcp": {
    "playwright": {
      "enabled": true,
      "type": "remote",
      "url": "http://localhost:9014/mcp"
    },
    "stitch": {
      "enabled": true,
      "command": ["bash", "/mnt/ai_data/scripts/opencode_stitch_mcp.sh"],
      "timeout": 600000,
      "environment": {
        "API_KEY": "{env:STITCH_AI_API_KEY}",
        "BASE_URL": "{env:STITCH_AI_BASE_URL}"
      }
    },
    "rag": {
      "enabled": true,
      "command": ["node", "/mnt/ai_data/scripts/opencode_rag_mcp.mjs"],
      "timeout": 600000,
      "environment": {
        "OPENCODE_RAG_URL": "http://localhost:9002/tools/search"
      }
    },
    "mempalace": {
      "enabled": true,
      "command": ["bash", "/mnt/ai_data/scripts/opencode_mempalace_mcp.sh"],
      "timeout": 60000
    },
    "context7": {
      "enabled": true,
      "command": ["npx", "-y", "@upstash/context7-mcp"],
      "timeout": 600000,
      "environment": {
        "CONTEXT7_API_KEY": "{env:CONTEXT7_API_KEY}"
      }
    },
    "docker": {
      "enabled": true,
      "command": ["npx", "-y", "docker-mcp"],
      "timeout": 600000,
      "environment": {
        "DOCKER_MCP_LOCAL": "true"
      }
    },
    "sequential-thinking": {
      "enabled": true,
      "command": ["npx", "-y", "@modelcontextprotocol/server-sequential-thinking"],
      "timeout": 600000
    },
    "firecrawl": {
      "enabled": true,
      "command": ["npx", "-y", "firecrawl-mcp"],
      "timeout": 600000,
      "environment": {
        "FIRECRAWL_API_KEY": "{env:FIRECRAWL_API_KEY}"
      }
    }
  },

  // ════════════════════════════════════════
  // LSP — language server configurations
  // ════════════════════════════════════════
  "lsp": {
    "typescript": {
      "command": ["typescript-language-server", "--stdio"],
      "extensions": [".ts", ".tsx", ".mts", ".cts"]
    },
    "svelte": {
      "command": ["svelteserver", "--stdio"],
      "extensions": [".svelte"]
    },
    "eslint": {
      "command": ["vscode-eslint-language-server", "--stdio"],
      "extensions": [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".svelte"],
      "initialization": { "nodePath": "" }
    },
    "bash": {
      "command": ["bash-language-server", "start"],
      "extensions": [".sh", ".bash"]
    },
    "pyright": {
      "command": ["pyright-langserver", "--stdio"],
      "extensions": [".py"]
    }
  },

  // ════════════════════════════════════════════════════
  // SUBTASK2 — command orchestration settings
  // ════════════════════════════════════════════════════
  "subtask2": {
    "replace_generic": true,   // Replace OpenCode's generic "summarize" message with return prompt
    "generic_return": null     // Custom fallback return prompt (null = use built-in default)
  },

  // ════════════════════════════════════════════
  // SKILLS — enable/disable bundled skills
  // ════════════════════════════════════════════
  "skills": {
    "enabled": true,  // master toggle
    "disabled": []    // skill names to disable, e.g. ["browser-testing-with-devtools"]
  },

  // ════════════════════════════════════════════
  // PERMISSIONS — tool permission rules
  // ════════════════════════════════════════════
  "permissions": {
    "read": {
      "*": "allow",
      "*.env": "deny",
      "*.env.*": "deny",
      "*.env.example": "allow"
    },
    "edit": {
      "*": "allow"
    },
    "bash": {
      "*": "allow"
    },
    "deny_paths": [
      "/mnt/ai_data/backup/*",
      "/mnt/ai_data/docs/secrets.md"
    ]
  }
}
```

---

## Implementation Strategy

### Phase 1: Scaffold + Config System
1. Initialize npm package with `bun init`
2. Define Zod config schema (`hiai-opencode.json`)
3. Config loader: discover `.opencode/hiai-opencode.json` or `~/.config/opencode/hiai-opencode.json`
4. Merge defaults + user overrides

### Phase 2: Plugin Core (wrap oh-my-openagent)
1. Import `oh-my-openagent` as primary dependency
2. Create plugin entry that:
   - Loads our unified config
   - Delegates to oh-my-openagent for agents/categories/hooks/tools
   - Overrides oh-my-openagent config with our unified config values
3. Re-export all oh-my-openagent functionality

### Phase 3: MCP Server Registration
1. Parse `mcp` section from config
2. Inject MCP server definitions into OpenCode's config via `config` hook
3. Each MCP server entry generates the correct opencode.json format
4. Support enable/disable per server

### Phase 4: LSP Server Registration
1. Parse `lsp` section from config
2. Inject LSP definitions into OpenCode's config via `config` hook
3. Support custom LSP server addition

### Phase 5: Skill Bundling
1. Copy 21 SKILL.md files into `skills/` directory in package
2. Register skills via oh-my-openagent's skill loading mechanism
3. Support enable/disable per skill
4. Ensure lifecycle ordering enforcement

### Phase 6: Micode Agent Absorption
1. Extract 4 unique micode agent definitions:
   - `mindmodel` (pattern catalog)
   - `ledger-creator` (session state)
   - `bootstrapper` (exploration branches)
   - `project-initializer` (project scaffolding)
2. Adapt prompts/definitions to oh-my-openagent's agent format
3. Register as additional agents in the unified plugin

### Phase 7: Permission System
1. Parse `permissions` section from config
2. Generate permission rules in OpenCode format
3. Merge with MCP-specific permissions (auto-generate `mcp_name_*: allow` for each enabled MCP)

### Phase 8: Unify opencode.json
1. Final `opencode.json` is minimal:
   ```json
   {
     "$schema": "https://opencode.ai/config.json",
     "plugin": ["hiai-opencode"]
   }
   ```
2. Everything else comes from `hiai-opencode.json`

---

## Dependencies

### Runtime Dependencies
```json
{
  "oh-my-openagent": "^3.17.2",         // Core: 10 agents, 60+ hooks, 19 features, 17 tools, 3 MCPs, 6 skills, 8 commands
  "@openspoon/subtask2": "^0.3.9",      // Command orchestration: return chaining, parallel, $ARGUMENTS, $TURN[n]
  "@tarquinen/opencode-dcp": "^3.1.9",  // Dynamic context pruning (token optimization)
  "opencode-fast-apply": "latest",       // Fast file apply via Morph API
  "opencode-pty": "latest",              // PTY/terminal management
  "opencode-websearch-cited": "latest",  // Gemini web search with citations
  "@opencode-ai/plugin": "^1.4.0",      // Plugin API
  "@opencode-ai/sdk": "^1.4.0",         // SDK
  "zod": "^4.3.0",                       // Config validation
  "jsonc-parser": "^3.3.1"               // JSONC config parsing
}
```

### Plugins NOT included (redundant)
- `@zenobius/opencode-skillful` — oh-my-openagent has built-in `opencode-skill-loader` feature
- `micode` — 4 unique agents absorbed into hiai-opencode, remaining 13 agents were duplicates

---

## Key Design Decisions

### 1. Wrap, Don't Fork
oh-my-openagent is a 153k-line compiled bundle with active development (v3.17.2). Forking would be unmaintainable. Instead:
- Import as dependency
- Override config via our unified config file
- Add our custom agents on top

### 2. MCP Stays External
MCP servers run as separate processes. They cannot be bundled. Our plugin:
- Provides default MCP configs
- Injects them via the `config` hook
- Users override in `hiai-opencode.json`

### 3. Single Config File
One `hiai-opencode.json` replaces:
- `oh-my-openagent.json` (agents/categories)
- MCP section in `opencode.json`
- LSP section in `opencode.json`
- Permission section in `opencode.json`
- Skill toggles

### 4. Skills Bundled as Package Assets
Skills are SKILL.md files. They ship inside the npm package under `skills/`. The plugin registers them at load time. Users can disable individual skills but get all 21 by default.

### 5. License: MIT
All absorbed components (micode, skills) are MIT-compatible. oh-my-openagent uses SUL-1.0 (permissive for our use case as we're using it as a dependency, not forking).

---

## Migration Path

### From Current Setup → hiai-opencode

1. Install: `bun add hiai-opencode`
2. Create `.opencode/hiai-opencode.json` (copy from template)
3. Update `opencode.json`:
   ```json
   { "plugin": ["hiai-opencode"] }
   ```
4. Remove old configs:
   - Delete `.opencode/oh-my-openagent.json`
   - Remove MCP/LSP/permission sections from `opencode.json`
5. Verify: `opencode` starts clean with all agents/tools available

---

## Hypothesis: Zero-Config Installation

**Goal:** `bun add hiai-opencode` → edit one JSON file → get 100% functionality.

**What "100% functionality" means:**
- All 18 agents + 8 categories configured
- All 11 MCP servers functional (8 external + 3 built-in)
- All 35 skills loaded (21 project + 6 oh-my-openagent + 8 superpowers)
- 5 LSP servers active
- Permission system working
- RAG backend connectable to any PostgreSQL/pgvector instance

**Integration Strategy — EXTRACT, DON'T INSTALL:**

| Old Plugin | Strategy | Rationale |
|---|---|---|
| `oh-my-openagent` | **Runtime dependency** | 153k lines, actively developed, wrap + override config |
| `@openspoon/subtask2` | **Runtime dependency** | Unique command orchestration, no replacement |
| `@tarquinen/opencode-dcp` | **Runtime dependency** | Token optimization, unique |
| `opencode-fast-apply` | **Runtime dependency** | Morph API integration |
| `opencode-pty` | **Runtime dependency** | Terminal management |
| `opencode-websearch-cited` | **Runtime dependency** | Gemini search with citations |
| `micode` | **EXTRACT 4 agents** | Rest are duplicates, absorb into hiai-opencode |
| `@zenobius/opencode-skillful` | **NOT NEEDED** | oh-my-openagent has skill-loader built-in |

| Old MCP Script | Strategy | Rationale |
|---|---|---|
| `opencode_rag_mcp.mjs` | **BUNDLE as package asset** | Zero deps, pure Node.js, stdio JSON-RPC |
| `opencode_stitch_mcp.sh` + stitch-mcp-auto | **BUNDLE as package asset** | Bash wrapper + npm package |
| `opencode_mempalace_mcp.sh` | **BUNDLE as package asset** | Bash wrapper, Python backend is external |
| `playwright` Docker | **Include config, document Docker dep** | Can't bundle Docker, graceful degradation |

| Claude Code Plugin | Strategy | Rationale |
|---|---|---|
| `superpowers` | **EXTRACT 8 skills + agent** | Don't depend on `~/.claude/plugins/` — embed in package |
| `claude-code-plugin-loader` | **NOT NEEDED** | We're embedding superpowers directly |

**Key Principle:** We never ask the user to install 8 separate plugins. We extract the valuable code, bundle MCP scripts, and ship one unified package. Old plugins become internal implementation details.

---

## Phase 9: MCP Script Bundling

### 9.1 RAG MCP — Configurable Backend
- Bundle `opencode_rag_mcp.mjs` as `assets/mcp/rag.mjs`
- Config in `hiai-opencode.json`: `rag.backend_url` (default: `http://localhost:9002/tools/search`)
- Support any PostgreSQL/pgvector backend by changing URL
- Zero external deps — pure Node.js stdio JSON-RPC

### 9.2 Stitch MCP — Bundle Wrapper + Token Management
- Bundle `opencode_stitch_mcp.sh` as `assets/mcp/stitch.sh`
- Token path: `~/.stitch-mcp-auto/tokens.json` (user creates manually or via systemd timer)
- Config in `hiai-opencode.json`: `stitch.api_key`, `stitch.base_url` (env var substitution)

### 9.3 Mempalace MCP — Bundle Wrapper
- Bundle `opencode_mempalace_mcp.sh` as `assets/mcp/mempalace.sh`
- Config in `hiai-opencode.json`: `mempalace.palace_path` (default: `$HOME/.cache/mempalace/opencode`)
- Python dependency (`pip install mempalace`) — document in README

### 9.4 Playwright MCP — Docker Integration
- Default config: `remote` at `http://localhost:9014/mcp`
- If Docker service not running → MCP fails to connect but doesn't crash plugin
- Document: `docker run -p 9014:9014 ...` in README

---

## Phase 10: Superpowers Embedding

Don't depend on `~/.claude/plugins/cache/claude-plugins-official/superpowers/5.0.7/`.

Instead:
1. Copy 8 SKILL.md files to `skills/superpowers/` in package
2. Embed `code-reviewer` agent definition in `src/agents/definitions/`
3. Register skill paths via our own config hook (not superpowers.js)
4. Skip `experimental.chat.messages.transform` hook (optional bootstrap — user can add manually)

**8 Superpowers Skills to embed:**
- brainstorming, dispatching-parallel-agents, executing-plans, finishing-a-development-branch
- receiving-code-review, requesting-code-review, subagent-driven-development, systematic-debugging
- test-driven-development, using-git-worktrees, using-superpowers, verification-before-completion
- writing-plans, writing-skills

---

## Phase 11: Permission Schema Extension

Current schema only covers `read/edit/bash/deny_paths`. Real opencode.json has:
- `doom_loop`, `question`, `plan_enter`, `plan_exit` — behavioral permissions
- `list`, `glob`, `grep`, `skill`, `task`, `todoread`, `todowrite`, `webfetch`, `websearch`, `codesearch` — tool permissions
- `external_directory` — cross-project access
- MCP-specific: `rag_*`, `mempalace_*`, `context7_*`, etc.

New schema structure:
```typescript
interface PermissionsConfig {
  // Behavioral
  doom_loop?: "allow" | "deny";
  question?: "allow" | "deny";
  plan_enter?: "allow" | "deny";
  plan_exit?: "allow" | "deny";
  // Tools
  list?: "allow" | "deny";
  glob?: "allow" | "deny";
  grep?: "allow" | "deny";
  skill?: "allow" | "deny";
  task?: "allow" | "deny";
  todoread?: "allow" | "deny";
  todowrite?: "allow" | "deny";
  webfetch?: "allow" | "deny";
  websearch?: "allow" | "deny";
  codesearch?: "allow" | "deny";
  // Path-based
  read?: Record<string, string>;
  edit?: Record<string, string>;
  bash?: Record<string, string>;
  external_directory?: Record<string, string>;
  deny_paths?: string[];
  // MCP-specific (auto-generated for enabled MCPs)
  [key: `${string}_*`]?: "allow" | "deny";
}
```

---

## Phase 12: Package Assets

Include in `files` array:
```
dist/          — compiled bundle
skills/        — 21 project SKILL.md files
skills/superpowers/ — 8+ superpowers SKILL.md files
assets/mcp/    — rag.mjs, stitch.sh, mempalace.sh
config/        — hiai-opencode.json template + schema
AGENTS.md      — bundled operational rules
```

---

## File Count Estimate (Updated)

| Area | Files | Notes |
|---|---|---|
| Core plugin | 5 | index.ts, config/, types |
| Config system | 4 | schema, defaults, loader, JSON schema |
| Agent adapters | 5 | 4 micode agents + registry |
| MCP integration | 3 | index, defaults, types |
| LSP integration | 2 | index, defaults |
| Skill bundling | 3 | index, loader, lifecycle hook |
| Skills (SKILL.md) | 21 | Raw markdown files |
| Permissions | 2 | index, defaults |
| Package infra | 4 | package.json, tsconfig, README, PLAN |
| **Total** | **~49** | |
# hiai-opencode — Full Build Plan

## Current State (after Phase 22 — Phases 14-22 COMPLETE)

### What hiai-opencode has NOW
- **22 agent files** (11K lines): Sisyphus, Prometheus, Hephaestus, Atlas, Oracle, Explore, Librarian, Metis, Momus, Multimodal-Looker, Sisyphus-Junior + micode agents (ledger-creator, bootstrapper, project-initializer, mindmodel) via micode-adapter.ts
- **52 hooks** (43 core + 7 continuation + 2 skill) across 27+ hook directories
- **17 tool directories** (16K lines): hashline-edit, delegate-task, background-task, skill, skill-mcp, session-manager, lsp, ast-grep, grep, glob, look-at, call-omo-agent, task, interactive-bash, slashcommand, read, question
- **19 feature directories** (19K lines): background-agent, skill-mcp-manager, builtin-skills, builtin-commands, mcp-oauth, claude-code-plugin-loader, etc.
- **Shared utilities** (100+ files): model-capabilities, tmux, migration, git-worktree, command-executor, logger, deep-merge, etc.
- **Plugin interface**: 10 OpenCode hook handlers via createPluginInterface
- **MCPs**: 8 total (playwright local, stitch, rag, mempalace, context7, sequential-thinking, firecrawl, grep.app)
- **LSPs**: 5 (typescript, svelte, eslint, bash, pyright)
- **Skills**: 21 in .opencode/skills/ + built-in skills bundled in plugin
- **Config**: Zod v4 schema, 27 sub-schemas, 12 plugin handlers
- **Build**: dist/index.js = 4.6MB (bun build) + ast-grep native binaries
- **LICENSE.md**: SUL-1.0 attribution for oh-my-openagent (done)

### Plugin Disposition (CONFIRMED by user)

| Plugin | Action | Reason |
|---|---|---|
| `oh-my-openagent` | **Fork+rebuild** | User directive, SUL-1.0 |
| `micode` | **Fork+rebuild** | Already absorbed 4 agents |
| `@openspoon/subtask2` | **Keep as dep** | MIT, 476 lines, session plumbing |
| `@tarquinen/opencode-dcp` | **Keep as dep** | AGPL-3.0, independent plugin |
| `opencode-pty` | **Keep as dep** | MIT, independent plugin |
| `opencode-websearch-cited` | **Keep as dep** | Independent plugin |
| `@zenobius/opencode-skillful` | **Remove** | User confirmed |
| `opencode-fast-apply` | **Remove** | User confirmed |
| `@morphllm/opencode-morph-plugin` | **Remove** | User confirmed |

---

## oh-my-openagent Source Audit

Source at `/mnt/ai_data/tmp/oh-my-openagent-src/src/`

### Module Sizes (non-test .ts)

| Directory | Lines | Files | Notes |
|---|---|---|---|
| hooks/ | 28,078 | 47 dirs + shared/ | 5 zauc-mocks excluded |
| tools/ | 16,230 | 16 dirs | |
| features/ | 19,507 | 19 dirs | |
| shared/ | 9,852 | 68 files + 6 subdirs | tmux, migration, model-capabilities, etc. |
| agents/ | 10,901 | 6 dirs | prometheus 2254, hephaestus 1425, atlas 1360, sisyphus 1257, sisyphus-junior 898, builtin-agents 581 |
| plugin/ | 3,617 | tool-registry, chat-params/headers/message, event, skill-context, etc. | |
| plugin-handlers/ | 1,212 | 12 config handlers | |
| openclaw/ | 2,148 | — | **STRIP** (Telegram/Discord) |
| config/ | 849 | 27 sub-schemas | |
| mcp/ | 103 | zauc-mocks | **STRIP** |
| Root files | 2,704 | index, create-*, plugin-* | |

### Factory Architecture

```
loadPluginConfig() → OhMyOpenCodeConfig
    ↓
createManagers() → { tmuxSessionManager, backgroundManager, skillMcpManager, configHandler }
    ↓
createTools() → { filteredTools, mergedSkills, availableSkills }
    ↓
createHooks() → { core, continuation, skill, toolGuard, session, transform }
    ↓
createPluginInterface() → PluginInterface (OpenCode hook handlers)
```

### OpenCode Hook Handlers (11)
tool, chat.params, chat.headers, command.execute.before, chat.message,
experimental.chat.messages.transform, experimental.chat.system.transform,
config, event, tool.execute.before, tool.execute.after, experimental.session.compacting

### What to STRIP
- **PostHog telemetry**: `shared/posthog.ts`, `shared/posthog-activity-state.ts`, references in `index.ts`
- **OpenClaw**: entire `openclaw/` dir + references in create-managers, tool-registry, event, config, index
- **Branding**: "oh-my-opencode" / "OhMyOpenCode" naming → "hiai-opencode"
- **Auto-updater**: `hooks/auto-update-checker/`
- **zauc-mocks**: `mcp/` dir entirely

---

## Transfer Phases

### Phase 14 — Foundation: shared/ utilities (~9,852 lines) ✅ DONE

**Goal**: Copy and adapt all shared utilities that everything else depends on.

**Copy list** (by dependency order):
1. `shared/logger.ts` (48 lines) — used by everything
2. `shared/file-utils.ts` (34 lines) — file ops
3. `shared/deep-merge.ts` (53 lines) — config merging
4. `shared/frontmatter.ts` (31 lines) — YAML frontmatter parsing
5. `shared/shell-env.ts` (175 lines) — shell environment resolution
6. `shared/agent-display-names.ts` (151 lines) — agent name mapping
7. `shared/config-errors.ts` — config load error types
8. `shared/opencode-server-auth.ts` (190 lines) — OpenCode server authentication
9. `shared/model-capabilities/` (434 lines, 6 files) — model resolution pipeline:
   - model-requirements.ts, model-availability.ts, model-capabilities-cache.ts
   - model-resolution-pipeline.ts, model-settings-compatibility.ts
   - model-error-classifier.ts, model-suggestion-retry.ts
   - dynamic-truncator.ts, connected-providers-cache.ts
10. `shared/tmux/` (686 lines) — tmux session management
11. `shared/migration/` (530 lines) — config migration
12. `shared/git-worktree/` (186 lines) — git worktree utilities
13. `shared/command-executor/` (264 lines) — command execution
14. `shared/zip-entry-listing/` (342 lines) — zip file handling

**SKIP**:
- `shared/posthog.ts` (170 lines) — telemetry
- `shared/posthog-activity-state.ts` (96 lines) — telemetry

**Adaptation**:
- Replace `@opencode-ai/plugin` / `@opencode-ai/sdk` imports with our installed versions
- Replace any `oh-my-opencode` string references with `hiai-opencode`
- Strip PostHog references from any copied files that import them

**Verification**: `tsc --noEmit` passes after each group of files

---

### Phase 15 — Config system (~849 lines + 1,212 plugin-handlers) ✅ DONE

**Goal**: Absorb the full config schema (27 sub-schemas) and 12 plugin config handlers.

**Copy list**:
1. `config/schema/` — all 27 Zod sub-schemas:
   - oh-my-opencode-config.ts (root), agent-config, hook-config, tool-config, mcp-config,
   - command-config, provider-config, category-config, skill-config, model-config,
   - subtask2-config, permission-config, lsp-config, tmux-config, etc.
2. `plugin-handlers/` — 12 config handlers:
   - agent-config, mcp-config, tool-config, command-config, provider-config,
   - category-config-resolver, agent-key-remapper, agent-priority-order,
   - agent-override-protection, plan-model-inheritance, plugin-components-loader,
   - config-handler (root)

**Adaptation**:
- Merge with our existing `src/config/schema.ts` (which already has permissions, subtask2, categories)
- Replace Zod v3 patterns with Zod v4 (`z.record(keySchema, valueSchema)`)
- Wire handlers into our `src/index.ts` plugin `config` hook

**Verification**: `tsc --noEmit` + `bun build` pass

---

### Phase 16 — Plugin interface (~3,617 lines) ✅ DONE

**Goal**: Copy the plugin glue layer — tool registry, chat params/headers/message, event handling, skill context, session-agent-resolver.

**Copy list**:
1. `plugin/tool-registry.ts` — tool registration and filtering
2. `plugin/chat-params.ts` — chat parameter injection
3. `plugin/chat-headers.ts` — chat header management
4. `plugin/chat-message.ts` — chat message handling
5. `plugin/event.ts` — event dispatching
6. `plugin/skill-context.ts` — skill context management
7. `plugin/session-agent-resolver.ts` — agent selection logic
8. `plugin/first-message-variant-gate.ts` — first message handling
9. Root files:
   - `plugin-interface.ts` (83 lines) — assembles OpenCode hook handlers
   - `plugin-config.ts` (314 lines) — config loading
   - `plugin-state.ts` (18 lines) — shared state
   - `plugin-dispose.ts` (51 lines) — cleanup
   - `create-hooks.ts` (93 lines) — hook factory
   - `create-managers.ts` (129 lines) — manager factory
   - `create-tools.ts` (53 lines) — tool factory
   - `index.ts` (156 lines) — entry point → adapt to our existing entry

**Adaptation**:
- Strip OpenClaw references from tool-registry, event, create-managers
- Strip PostHog references from index.ts
- Wire into our `src/index.ts` — replace our simple config-only hooks with full plugin interface

**Verification**: `tsc --noEmit` + `bun build` + manual test of config hook

---

### Phase 17 — Managers (~4,558 lines from features/) ✅ DONE

**Goal**: Copy the 4 managers that hooks/tools depend on.

**Copy list**:
1. `features/background-agent/` (4,353 lines) — BackgroundManager: background task spawning, notification, session tracking
2. `features/skill-mcp-manager/` (1,105 lines) — SkillMcpManager: MCP server lifecycle for skills
3. From `shared/tmux/` (686 lines, copied in Phase 14) — TmuxSessionManager
4. Config handler (from Phase 15) — configHandler

**Dependencies**: Phase 14 (shared/) + Phase 15 (config)

**Adaptation**:
- Strip OpenClaw from background-agent event emission
- Strip PostHog from background-agent metrics
- Adapt tmux paths for cross-platform

**Verification**: `tsc --noEmit` + `bun build`

---

### Phase 18 — Tools (~16,230 lines) ✅ DONE

**Goal**: Copy the 16+ tools that OpenCode agents and hooks use.

**Priority order** (by dependency chain):
1. `tools/hashline-edit/` (1,744 lines) — file editing with line anchoring (critical for agents)
2. `tools/delegate-task/` (3,972 lines) — task delegation (critical for orchestration)
3. `tools/background-task/` (925 lines) — background task management
4. `tools/skill/` (564 lines) — skill discovery/invocation
5. `tools/skill-mcp/` — skill MCP bridge
6. `tools/session-manager/` (1,133 lines) — session state management
7. `tools/lsp/` (2,556 lines) — LSP integration (complements our existing LSP config)
8. `tools/ast-grep/` (982 lines) — AST-aware code search/replace
9. `tools/grep/` (726 lines) — code search
10. `tools/glob/` — file pattern matching
11. `tools/look-at/` (889 lines) — media file analysis
12. `tools/call-omo-agent/` (934 lines) — inter-agent communication
13. `tools/task/` (680 lines) — subtask spawning
14. `tools/interactive-bash/` — interactive bash sessions
15. `tools/slashcommand/` — slash command execution
16. `tools/read/` — file reading (enhanced)

**Dependencies**: Phase 14 (shared/) + Phase 17 (managers)

**Adaptation**:
- Replace any `@opencode-ai/plugin` internal API usage with our adapted versions
- Strip PostHog analytics from tool execution tracking
- Ensure Zod v4 compatibility for tool input schemas

**Verification**: `tsc --noEmit` + `bun build` + manual tool invocation test

---

### Phase 19 — Hooks (~28,078 lines — SELECTIVE) ✅ DONE

**Goal**: Copy hooks in priority order. NOT all 47 hooks are needed.

**Priority tiers**:

**Tier 1 — Critical (MUST have)**:
1. `hooks/session-recovery/` (1,869 lines) — session state recovery on crash
2. `hooks/ralph-loop/` (1,721 lines) — self-referential development loop
3. `hooks/todo-continuation-enforcer/` (1,410 lines) — ensures todo completion
4. `hooks/compaction-context-injector/` (718 lines) — context injection on compaction
5. `hooks/compaction-todo-preserver/` — preserves todos during compaction
6. `hooks/edit-error-recovery/` — auto-recovery from edit failures
7. `hooks/comment-checker/` (837 lines) — comment quality enforcement

**Tier 2 — Important (SHOULD have)**:
8. `hooks/model-fallback/` (1,725 lines) — model capability fallback chain
9. `hooks/runtime-fallback/` (1,725 lines) — runtime error recovery
10. `hooks/anthropic-context-window-limit-recovery/` (2,612 lines) — context window management
11. `hooks/keyword-detector/` (1,322 lines) — keyword-based hook triggering
12. `hooks/start-work/` (578 lines) — work session startup
13. `hooks/auto-slash-command/` (626 lines) — auto command execution
14. `hooks/context-injector/` — system prompt injection
15. `hooks/rules-injector/` (1,041 lines) — rules/context injection
16. `hooks/directory-agents-injector/` — per-directory agent config
17. `hooks/directory-readme-injector/` — README context injection

**Tier 3 — Nice to have**:
18. `hooks/think-mode/` — thinking mode toggle
19. `hooks/anthropic-effort/` — effort level control
20. `hooks/interactive-bash-session/` (608 lines) — PTY session management
21. `hooks/read-image-resizer/` (967 lines) — image resize for vision
22. `hooks/tool-output-truncator/` — tool output length management
23. `hooks/json-error-recovery/` — JSON parse error recovery
24. `hooks/hashline-read-enhancer/` — enhanced file reading
25. `hooks/background-notification/` — background task notifications
26. `hooks/atlas/` (2,038 lines) — architecture context
27. `hooks/claude-code-hooks/` (2,397 lines) — Claude Code compatibility
28. `hooks/sisyphus-junior-notepad/` — Junior agent notepad

**SKIP**:
- `hooks/auto-update-checker/` — we handle updates ourselves
- Any hooks that are Claude-specific and not generically useful
- zauc-mock hooks

**Dependencies**: Phase 14-18 (shared, config, plugin, managers, tools)

**Adaptation**:
- Strip PostHog from any hook that captures events
- Strip "oh-my-opencode" branding from injected prompts
- Adapt tool references to our tool paths
- Verify each hook's `isHookEnabled` logic works with our config

**Verification**: `tsc --noEmit` + `bun build` after each tier

---

### Phase 20 — Agents (~10,901 lines) ✅ DONE

**Goal**: Copy agent definitions that provide the AI persona layer.

**Copy list** (by priority):
1. `agents/sisyphus/` (1,257 lines) — primary orchestrator agent
2. `agents/sisyphus-junior/` (898 lines) — lightweight parallel task agent
3. `agents/oracle/` — read-only high-IQ consultation
4. `agents/explore/` — contextual grep agent
5. `agents/librarian/` — reference grep (external docs)
6. `agents/metis/` — pre-planning consultant
7. `agents/momus/` — plan critic
8. `agents/hephaestus/` (1,425 lines) — builder agent
9. `agents/atlas/` (1,360 lines) — architecture agent
10. `agents/prometheus/` (2,254 lines) — deep research agent
11. `agents/multimodal-looker/` — media analysis agent
12. `agents/builtin-agents/` (581 lines) — build, general, plan, etc.

**Dependencies**: Phase 14-19 (everything)

**Adaptation**:
- Merge with our existing 4 micode agents (already in `src/agents/micode-adapter.ts`)
- Adapt tool references to our tool registry paths
- Strip any agent-specific telemetry
- Wire into our config handler's agent registration

**Verification**: `tsc --noEmit` + `bun build` + test agent listing

---

### Phase 21 — Features (~19,507 lines — SELECTIVE) ✅ DONE

**Goal**: Copy feature modules that enable hook/tool functionality.

**Copy list** (by priority):
1. `features/builtin-skills/` (2,880 lines) — built-in skill definitions (complements our 35 skills)
2. `features/opencode-skill-loader/` (1,587 lines) — skill discovery and loading
3. `features/builtin-commands/` (1,558 lines) — slash commands (start-work, stop-continuation, handoff, etc.)
4. `features/mcp-oauth/` (1,019 lines) — MCP OAuth flow (needed for stitch, context7)
5. `features/claude-code-plugin-loader/` (961 lines) — Claude Code plugin compatibility
6. `features/hook-message-injector/` (498 lines) — hook message injection

**SKIP**:
- `features/background-agent/` — already copied in Phase 17
- `features/tmux-subagent/` (2,858 lines) — only if tmux is confirmed needed
- `features/skill-mcp-manager/` — already copied in Phase 17

**Adaptation**:
- Strip PostHog from skill loader analytics
- Adapt skill path resolution to our bundled skills structure
- Wire commands into our plugin `command.execute.before` handler

**Verification**: `tsc --noEmit` + `bun build`

---

### Phase 22 — Built-in MCPs (~103 lines stripped → add 3 real ones) ✅ DONE

**Goal**: Add the 3 MCP servers that oh-my-openagent bundles internally.

**Copy list**:
1. Context7 MCP — `@upstash/context7-mcp` (already in our defaults as external)
2. grep.app MCP — grep.app code search API
3. websearch/Exa MCP — web search with citations

**Note**: These are small MCP server implementations. Some may already be covered by our existing MCP defaults. Evaluate each:
- **Context7**: Already available via `npx -y @upstash/context7-mcp` in our defaults. **SKIP** (duplicate).
- **grep.app**: New — adds GitHub code search. **COPY** the hook+tool integration.
- **websearch/Exa**: Already have `opencode-websearch-cited` as dep. **SKIP** (duplicate).

**Verification**: `tsc --noEmit` + `bun build`

---

### Phase 23 — Integration & Cleanup ✅ MOSTLY DONE

**Goal**: Wire everything together, clean up, verify end-to-end.

**Tasks**:
1. ✅ Update `src/index.ts` to use full plugin interface
2. ✅ Remove dead code, unused imports
3. ✅ Final PostHog/OpenClaw audit — 0 results
4. ✅ Update `package.json` — all runtime deps added
5. ✅ Run `bun install` — lockfile updated
6. ✅ Final `tsc --noEmit` + `bun build` — passes (4.6MB)
7. ✅ `LICENSE.md` with SUL-1.0 attribution — done
8. ⬜ End-to-end runtime test — not yet tested in OpenCode

---

### Phase 24 — Fast-Apply Integration (NEW)

**Goal**: Integrate local Fast-Apply via Ollama to replace the removed morph/opencode-fast-apply plugins.

**Context**: The original `opencode-fast-apply` and `@morphllm/opencode-morph-plugin` were removed during cleanup. The infra/docker/.env has `OLLAMA_URL=http://localhost:11434` and `OLLAMA_MODEL_BOB=qwen3.5:9b` configured, but no plugin code consumes these.

**Approach**: Create a hook that intercepts `apply_patch` tool invocations and routes them to Ollama for fast local patch generation using qwen3.5:9b.

**Tasks**:
1. Create `src/hooks/fast-apply/` — hook that intercepts apply-patch tool calls
2. Create `src/tools/fast-apply/` — tool that calls Ollama /api/generate with patch prompt
3. Wire into plugin config schema — add `fast_apply` config section (enabled, ollama_url, model, timeout)
4. Wire into `create-hooks.ts` — register as core hook
5. Update `package.json` if any new deps needed (likely none — just fetch)
6. Build verification

**Configuration** (from env):
- Ollama URL: `http://localhost:11434`
- Model: `qwen3.5:9b`
- Trigger: `apply_patch` tool invocations
- Fallback: If Ollama unavailable, pass through to default behavior

**Verification**: `tsc --noEmit` + `bun build` + manual test with apply-patch

---

## Estimated Effort

| Phase | Lines to copy | Difficulty | Status |
|---|---|---|---|
| 14 — shared/ | ~9,700 | Medium | ✅ DONE |
| 15 — config | ~2,000 | Medium | ✅ DONE |
| 16 — plugin interface | ~3,600 | Hard | ✅ DONE |
| 17 — managers | ~4,600 | Hard | ✅ DONE |
| 18 — tools | ~16,200 | Medium | ✅ DONE |
| 19 — hooks | ~15,000 (selective) | Hard | ✅ DONE |
| 20 — agents | ~10,900 | Medium | ✅ DONE |
| 21 — features | ~8,500 (selective) | Medium | ✅ DONE |
| 22 — built-in MCPs | ~200 | Easy | ✅ DONE |
| 23 — integration | — | Hard | ✅ MOSTLY DONE |
| 24 — Fast-Apply | ~500 | Medium | ⬜ TODO |
| **Total** | **~71,200** | | |

## npm Dependencies to Add

```
@modelcontextprotocol/sdk  — MCP protocol (used by skill-mcp-manager, mcp-oauth)
commander                   — CLI argument parsing (used by builtin-commands)
js-yaml                     — YAML parsing (used by skills, config)
picocolors                  — Terminal colors (used by logger, hooks)
vscode-jsonrpc              — LSP JSON-RPC (used by tools/lsp)
@ast-grep/napi              — AST search (used by tools/ast-grep)
yaml                        — YAML parsing (used by subtask2, already indirect dep)
```

## SUL-1.0 License Handling

oh-my-openagent is licensed under SUL-1.0 (Sustainable Use License):
- ✅ Allows use for internal business purposes
- ✅ Allows derivative works
- ✅ Compatible with our open repo (non-commercial)
- ❌ Non-sublicensable — cannot re-license under MIT
- **Action**: Include SUL-1.0 attribution in our LICENSE.md for all copied oh-my-openagent code. Our original code stays MIT.
