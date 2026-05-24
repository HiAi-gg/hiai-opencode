# API Documentation

**hiai-opencode** configuration schema, agent model slots, MCP options, skill discovery, and hook configuration.

---

## Plugin Configuration Schema (`hiai-opencode.json`)

The user-facing config file lives at the project root (or `.opencode/hiai-opencode.json`). The canonical JSON Schema is at `config/hiai-opencode.schema.json`.

### Top-Level Shape

```json
{
  "$schema": "./config/hiai-opencode.schema.json",
  "models": { /* 10 primary model slots */ },
  "auth": { /* service auth placeholders */ },
  "mcp": { /* MCP server enable/disable */ },
  "lsp": { /* LSP tool enable/disable */ },
  "skill_discovery": { /* external skill folder scanning */ },
  "subtask2": { "replace_generic": boolean },
  "ralph_loop": { "enabled": boolean, "auto_start_threshold": number }
}
```

Only `models` is required. All other top-level keys are optional.

---

## Agent Model Slots

The `models` object holds **10 primary slots** — one per visible agent. Each slot accepts either a plain model-ID string or an object with `model` + optional `recommended`.

### TypeScript Interface

```typescript
type ModelSlot =
  | string
  | {
      model: string;
      recommended?:
        | "xhigh"   // architectural planning
        | "high"    // complex deep work
        | "middle"  // guard / gatekeeping
        | "fast"    // bounded cheap tasks
        | "design"  // UI / visual
        | "writing" // copy / content
        | "vision"; // multimodal extraction
    };
```

### The 10 Slots

| Config key | Display name | Purpose | Default recommended |
|---|---|---|---|
| `bob` | Bob | Orchestrator, router, entry point | `high` |
| `coder` | Coder | Deep implementation, bounded execution | `fast` |
| `strategist` | Strategist | Planning, architecture, pre-check | `xhigh` |
| `manager` | Manager | Delegation orchestrator, TODO tracker, memory steward | `middle` |
| `critic` | Critic | Review gate, high-accuracy verification | `high` |
| `designer` | Designer | UI/visual direction via Stitch MCP | `design` |
| `researcher` | Researcher | Local + external search | `fast` |
| `writer` | Writer | Copy, content, positioning, SEO | `writing` |
| `vision` | Vision | PDF/image/diagram extraction, browser UI verification | `vision` |
| `sub` | Sub | Bounded compatibility wrapper (hidden) | `fast` |

> **Note:** `guard` and `brainstormer` are legacy config keys preserved for migration compatibility. They map to `manager` and `writer` respectively via `src/shared/migration/agent-names.ts`. The schema still requires `guard` and `brainstormer` entries, but the runtime resolves them to the canonical slots.

### Recommended Effort Tiers

The `recommended` field is advisory only — it appends a prompt hint so the agent allocates the right reasoning effort. It does not change routing or enforce limits.

---

## MCP Server Configuration

The `mcp` object in `hiai-opencode.json` is the **user-facing on/off switchboard**. The source of truth for launch wiring (command, env vars, install strategy) is `src/mcp/registry.ts`.

### Generic Toggle

```json
{
  "mcp": {
    "<server>": { "enabled": boolean }
  }
}
```

### All MCP Servers

| Server | Config key | Default | Key env var | What it enables |
|---|---|---|---|---|
| Stitch | `mcp.stitch` | `true` | `STITCH_AI_API_KEY` | Designer: design systems, screen generation |
| Sequential Thinking | `mcp.sequential-thinking` | `true` | — | Strategist + Critic: deep reasoning |
| MemPalace | `mcp.mempalace` | `true` | `MEMPALACE_PYTHON` | Manager (primary), all agents (search before answer) |
| Context7 | `mcp.context7` | `true` | `CONTEXT7_API_KEY` | Researcher + Coder: library API lookup |
| grep_app | `mcp.grep_app` | `true` | — | Researcher: OSS code pattern search |
| Agent Browser | `mcp.agentBrowser` | `true` | `AGENT_BROWSER_*` | Coder: browser automation via `/agent-browser` skill |

### MemPalace Extended Config

```json
{
  "mcp": {
    "mempalace": {
      "enabled": true,
      "pythonPath": "{env:MEMPALACE_PYTHON:-./.venv/bin/python}"
    }
  }
}
```

- `pythonPath`: optional explicit Python/Ruv interpreter. Overrides `MEMPALACE_PYTHON` env var.
- When `HIAI_MCP_AUTO_INSTALL` is not `0`, `false`, or `no`, the launcher attempts `python -m pip install --user mempalace` on first start.

### Agent Browser Extended Config

```json
{
  "mcp": {
    "agentBrowser": {
      "enabled": true,
      "autoInstall": false,
      "sessionPrefix": "hiai-opencode",
      "timeout": 30000,
      "maxBatchCommands": 20
    }
  }
}
```

### Environment Variables in MCP Config

Use the `{env:VARIABLE_NAME}` placeholder to pass secrets through the env scrubber:

```json
{
  "mcp": {
    "firecrawl-cli": {
      "enabled": true,
      "environment": { "FIRECRAWL_API_KEY": "{env:FIRECRAWL_API_KEY}" }
    }
  }
}
```

Explicit `environment` entries are an allowlist and bypass the filter that strips secret-shaped variables from `process.env` before launching stdio MCP servers.

---

## Bundled Design Library

The plugin ships a comprehensive design library sourced from [nexu-io/open-design](https://github.com/nexu-io/open-design) (Apache 2.0). The Designer agent uses these assets to ground its output in real brand systems instead of generic AI aesthetics.

| Asset | Location | Contents |
|---|---|---|
| Brand design systems | `design-systems/` | 150+ brands (Apple, Linear, Stripe, Vercel, Airbnb, etc.) — each with `DESIGN.md`, `tokens.css`, `components.html` |
| Design skills | `skills/` | 48 skills covering visual storytelling, Figma integration, canvas design, accessibility, animation |
| Craft guidelines | `craft/` | Typography, color systems, UX patterns, anti-AI-slop references |
| Prompt templates | `prompt-templates/` | Ready-made prompts for image generation and video production |

---

## Skill Discovery Options

The `skill_discovery` object controls which external skill folders are scanned.

### TypeScript Interface

```typescript
interface SkillDiscovery {
  config_sources: boolean;    // default: true — hiai-opencode bundled skills
  project_opencode: boolean;  // default: true — .opencode/skills in project
  global_opencode: boolean;  // default: false — global ~/.opencode/skills/
  project_claude: boolean;    // default: false — project-level Claude skills
  global_claude: boolean;    // default: false — global ~/.claude/skills/
  project_agents: boolean;   // default: false — project-level Agents skills
  global_agents: boolean;    // default: false — global agents skills
}
```

### Default (Deterministic) Configuration

```json
{
  "skill_discovery": {
    "config_sources": true,
    "project_opencode": true,
    "global_opencode": false,
    "project_claude": false,
    "global_claude": false,
    "project_agents": false,
    "global_agents": false
  }
}
```

### Per-Skill Disable

To silence noisy individual skills without disabling an entire folder:

```json
{
  "skills": {
    "disable": ["claude-md-management"]
  }
}
```

---

## Hook Configuration

Hooks are registered internally and not directly user-configurable in `hiai-opencode.json`. The hook system intercepts OpenCode lifecycle events.

### Configuration via `ralph_loop`

Ralph-loop continuation behavior is tunable:

```json
{
  "ralph_loop": {
    "enabled": true,
    "auto_start_threshold": 5
  }
}
```

- `enabled`: whether ralph-loop is active
- `auto_start_threshold`: auto-start ralph-loop when this many or more open todos exist in a single session. `0` disables auto-start.

### Compaction Configuration

Compaction is triggered automatically at 78% context usage. Per-agent compaction model overrides can be set via:

```json
{
  "agents": {
    "<agentName>": {
      "compaction": {
        "model": "provider/model-id"
      }
    }
  }
}
```

### Available Hooks (55 total)

| Tier | Count | Files | Purpose |
|---|---|---|---|
| Core | 45 | `createSessionHooks` (23), `createToolGuardHooks` (16), `createTransformHooks` (6) | Primary session monitoring, tool guards, message transforms |
| Continuation | 8 | `createContinuationHooks` | Todo enforcement, stop-continuation guard, compaction context, session recovery |
| Skill | 2 | `createSkillHooks` | Category skill reminder, auto-slash command |

### Key Compaction Hooks

| Hook | Handler | Purpose |
|---|---|---|
| `preemptive-compaction` | `tool.execute.after`, `event` | Triggers `session.summarize()` when usage > 78% |
| `context-window-monitor` | `tool.execute.after`, `event` | Injects usage reminder at > 70% |
| `compaction-context-injector` | `experimental.session.compacting` | Injects checkpoint context post-compaction |
| `compaction-todo-preserver` | `experimental.session.compacting` | Preserves/restores todo list around compaction |
| `anthropic-context-window-limit-recovery` | `event` | Multi-strategy error recovery |

See [hooks-architecture.md](./hooks-architecture.md) for the full architecture.

---

## Ralph-Loop Configuration

```json
{
  "ralph_loop": {
    "enabled": true,
    "auto_start_threshold": 5
  }
}
```

The ralph-loop continuation engine runs an explicit completion loop for multi-todo sessions. It stops on `<promise>DONE</promise>`. Cancel with `/cancel-ralph`.

| Field | Type | Default | Description |
|---|---|---|---|
| `enabled` | boolean | `true` | Whether ralph-loop is enabled |
| `auto_start_threshold` | number | `0` | Auto-start when open todos ≥ this value. `0` disables |

---

## LSP Configuration

LSP tool defaults (not runtime language servers):

```json
{
  "lsp": {
    "typescript": { "enabled": true },
    "svelte": { "enabled": true },
    "eslint": { "enabled": true },
    "bash": { "enabled": true },
    "pyright": { "enabled": true }
  }
}
```

---

## Subtask2 Configuration

```json
{
  "subtask2": {
    "replace_generic": true
  }
}
```

When `true`, generic `task()` responses are replaced with a structured return prompt before the parent agent sees them.