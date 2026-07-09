# Configuration Reference

hiai-opencode is configured through two files: `bob.json` (models, features, LSP,
MCP) and `bob.env` (API keys). Both ship in the plugin package; users override
settings by placing `bob.json` in their project root.

## Config Resolution Order

1. Plugin's bundled `bob.json` (defaults)
2. `<project>/bob.json`
3. `<project>/.opencode/bob.json`
4. `<project>/bob.jsonc`
5. `<project>/.opencode/bob.jsonc`
6. `$XDG_CONFIG_HOME/hiai-opencode/bob.json`
7. `$XDG_CONFIG_HOME/hiai-opencode/bob.jsonc`

First found wins for each key; deep-merged with defaults.

## bob.json Reference

### `models` — Per-Agent Model Assignment

```jsonc
{
  "models": {
    "bob": { "model": "provider/model-name" },
    "build": { "model": "provider/model-name" },
    "plan": { "model": "provider/model-name" },
    "manager": { "model": "provider/model-name" },
    "critic": { "model": "provider/model-name" },
    "designer": { "model": "provider/model-name" },
    "explore": { "model": "provider/model-name" },
    "writer": { "model": "provider/model-name" },
    "vision": { "model": "provider/model-name" },
    "general": { "model": "provider/model-name" },
  },
}
```

Format: `<provider>/<model>`. All 10 agents must have models. If an agent is
missing, a warning is logged and the agent uses the host default.

### `mcp` — MCP Server Toggles

```jsonc
{
  "mcp": {
    "sequential-thinking": { "enabled": true },
    "grep_app": { "enabled": true },
  },
}
```

Available servers in the registry: `sequential-thinking` (local, npx),
`grep_app` (remote, mcp.grep.app).

context7 was intentionally removed from MCP and is available as an on-demand
skill (`skill("explore/context7")`). Stitch and MemPalace were also removed.

### `lsp` — Language Server Configuration

```jsonc
{
  "lsp": {
    "typescript": { "enabled": true },
    "svelte": { "enabled": true },
    "eslint": { "enabled": true },
    "pyright": { "enabled": true },
  },
}
```

Servers auto-install via npx on first use. Additional config per server:
`command`, `args`, `initializationOptions`, `env`.

### `agent_restrictions` — Per-Agent Tool Permissions

```jsonc
{
  "agent_restrictions": {
    "bob": {
      "write": false,
      "edit": false,
      "bash": false,
      "apply_patch": false,
      "grep": false,
      "glob": false,
    },
    "plan": { "bash": false, "grep": false, "glob": false, "webfetch": false },
    "critic": { "write": false, "edit": false },
    "explore": { "write": false, "edit": false },
    "general": { "task": false },
  },
}
```

> **Cross-project inspection**: Agents `explore`, `plan`, `critic`, `build`,
> `general`, `manager`, `writer`, and `designer` automatically receive
> `permission.external_directory = "allow"` by default for file access outside
> the project root. Agents `bob` and `vision` are excluded — Bob delegates
> discovery to **explore**, and Vision is browser/multimodal only.
> To revoke cross-project access for an agent, add `"external_directory": false`
> to the agent's restrictions block above. See `docs/PERMISSIONS.md` for details.

See docs/PERMISSIONS.md for details.

### `hooks.disabled` — Disable Hooks

```jsonc
{
  "hooks": {
    "disabled": ["non-interactive-env", "context-window-monitor"],
  },
}
```

Valid hook names: all 30 hooks listed in docs/HOOKS.md. The legacy
`disabled_hooks` array is also supported and merged.

### `tools.disabled` — Disable Tools

```jsonc
{
  "tools": {
    "disabled": ["firecrawl_search", "agent_browser_navigate"],
  },
}
```

### `agent_overrides` — Model/Prompt Overrides

```jsonc
{
  "agent_overrides": {
    "bob": {
      "model": "custom/model",
      "prompt_append": "Additional instructions appended to bob's prompt.",
    },
  },
}
```

### `caveman` — Internal Communication Protocol

Controls the Caveman internal protocol for compressed agent-to-agent
communication. Internal only — user-facing output stays normal.

> **Architecture decision**: Caveman compresses internal LLM tokens (the
> most expensive resource). It does NOT compress disk-based MEMORY.md or
> session checkpoints. The `<CLOSURE>` protocol at the end of every agent
> response is never modified.

```jsonc
{
  "caveman": {
    "enabled": true,
    "level": "full",
    "bob_internal": true,
    "bob_to_agents": true,
    "agents_to_bob": true,
    "final_user_output": "normal",
    "target_agents": [
      "bob",
      "explore",
      "build",
      "critic",
      "general",
      "designer",
      "manager",
    ],
    "exclude_agents": ["vision", "writer"],
    "min_messages_to_compress": 5,
  },
}
```

| Field                      | Type                                    | Default            | Description                                                         |
| -------------------------- | --------------------------------------- | ------------------ | ------------------------------------------------------------------- |
| `enabled`                  | boolean                                 | `true`             | Master toggle. When false, no fragments injected.                   |
| `level`                    | `"minimal"` \| `"balanced"` \| `"full"` | `"full"`           | Compression aggressiveness (reserved for future use).               |
| `bob_internal`             | boolean                                 | `true`             | Bob gets internal caveman style prompt (drop filler, fragments OK). |
| `bob_to_agents`            | boolean                                 | `true`             | Bob gets delegation protocol for terse agent briefs.                |
| `agents_to_bob`            | boolean                                 | `true`             | Subagents get protocol to understand/respond tersely to Bob.        |
| `final_user_output`        | `"normal"`                              | `"normal"`         | User-facing output always normal language (only option).            |
| `target_agents`            | string[]                                | [list of 7 agents] | Agents that receive caveman protocol injection.                     |
| `exclude_agents`           | string[]                                | `["vision", "writer"]` | Agents excluded from caveman (e.g., vision/writer need full context). |
| `min_messages_to_compress` | number                                  | `5`                | Minimum message count before compressor hint activates.             |

**Disabling**: Add `"caveman-system-injector"` and/or `"caveman-message-compressor"`
to `hooks.disabled` in bob.json.

### `completion` — Auto-Continue Configuration

```jsonc
{
  "completion": {
    "enabled": true,
    "max_auto_continues": 25,
    "require_critic": true,
    "ui_globs": [
      "**/*.svelte",
      "**/*.tsx",
      "**/*.jsx",
      "**/*.vue",
      "**/*.css",
      "**/*.scss",
      "**/*.html",
      "**/*.astro",
    ],
    "reset_on_user_message": true,
  },
}
```

- `max_auto_continues`: Total auto-continues before forced stop (default 25)
- `require_critic`: Require critic approval before final stopping
- `ui_globs`: File globs that trigger Vision browser verification
- `reset_on_user_message`: Reset continuation state on new user message

### `loop` — Session Loop Configuration

```jsonc
{
  "loop": {
    "maxIterations": 10,
    "cooldownMs": 10000,
  },
}
```

Controls the session-idle loop driver in `loop.ts`.

### `dream` & `distill` — Memory Consolidation

```jsonc
{
  "dream": { "auto": true, "interval_days": 7 },
  "distill": { "auto": true, "interval_days": 30 },
}
```

- **dream**: Consolidates session knowledge into MEMORY.md
- **distill**: Discovers repeated workflows and packages as skills
- If bob has a `model`, dream/distill pin to it via `{ model: bob.model }`

### `background_manager` — Subagent Lifecycle

```jsonc
{
  "background_manager": {
    "concurrency_limit": 5,
    "stale_timeout_ms": 2700000,
    "circuit_breaker": {
      "enabled": true,
      "max_tool_calls": 4000,
      "consecutive_threshold": 20,
    },
  },
}
```

- `concurrency_limit`: Max parallel background subagents
- `stale_timeout_ms`: Kill subagents idle for this long (45 min default)
- `circuit_breaker.max_tool_calls`: Total tool call limit before shutdown
- `circuit_breaker.consecutive_threshold`: Same-tool repeat limit

### `telemetry` — OpenTelemetry Export

```jsonc
{
  "telemetry": {
    "enabled": false,
    "serviceName": "hiai-opencode",
    "endpoint": "http://localhost:4318/v1/traces",
    "sampleRate": 1.0,
  },
}
```

### `disabled_agents` — Remove Agents

```jsonc
{
  "disabled_agents": ["writer", "designer"],
}
```

### `auth` — MCP Auth Tokens

```jsonc
{
  "auth": {
    "grep_app": "Bearer my-token",
  },
}
```

### Full Example

```jsonc
{
  "models": {
    "bob": { "model": "opencode-go/mimo-v2.5-pro" },
    "build": { "model": "deepseek/deepseek-v4-pro" },
    "plan": { "model": "deepseek/deepseek-v4-pro" },
    "manager": { "model": "opencode-go/deepseek-v4-flash" },
    "critic": { "model": "opencode-go/mimo-v2.5-pro" },
    "designer": { "model": "anthropic/claude-sonnet-4-5" },
    "explore": { "model": "opencode-go/deepseek-v4-flash" },
    "writer": { "model": "openrouter/mistralai/mistral-small-2603" },
    "vision": { "model": "opencode-go/mimo-v2.5" },
    "general": { "model": "opencode-go/deepseek-v4-flash" },
  },
  "mcp": {
    "sequential-thinking": { "enabled": true },
    "grep_app": { "enabled": true },
  },
  "lsp": {
    "typescript": { "enabled": true },
    "svelte": { "enabled": true },
    "eslint": { "enabled": true },
    "pyright": { "enabled": true },
  },
  "completion": {
    "enabled": true,
    "max_auto_continues": 25,
    "require_critic": true,
  },
  "dream": { "auto": true, "interval_days": 7 },
  "distill": { "auto": true, "interval_days": 30 },
    "telemetry": { "enabled": false, "serviceName": "hiai-opencode" },
  }
}
```

## bob.env Reference

| Variable               | Required | Description                                                         |
| ---------------------- | -------- | ------------------------------------------------------------------- |
| `FIRECRAWL_API_KEY`    | Yes      | Web search & scraping (firecrawl)                                   |
| `CONTEXT7_API_KEY`     | Yes      | Library documentation lookups                                       |
| `AGENT_BROWSER_HEADED` | No       | Set to `1` to opt into visible browser window (default is headless) |

Copy `bob.env.example` to `bob.env` and fill in keys. `bob.env` is git-ignored.

### bob.env Lookup Order

`bob.env` is loaded from multiple paths (first found wins, highest priority first):

1. `<projectDir>/bob.env` — project-local (highest priority)
2. `<projectDir>/.opencode/bob.env` — OpenCode project config
3. `$XDG_CONFIG_HOME/hiai-opencode/bob.env` — global user config (`~/.config/hiai-opencode/bob.env`)
4. `<plugin_root>/bob.env` — plugin bundled fallback (lowest priority)

Only keys **not already present** in `process.env` are set from bob.env.
This preserves any keys set by the hosting environment.

**Format:** Both `export KEY=value` and plain `KEY=value` are supported.
Lines starting with `#` are treated as comments.

### Firecrawl Error Classification

When Firecrawl CLI returns an error, it is classified into actionable categories:

| Error Type              | Cause                                               | Message                                                                               |
| ----------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **CLI not installed**   | `command not found` / `ENOENT`                      | "Firecrawl CLI is not installed. Install with: bun add -g firecrawl-cli"              |
| **Invalid/expired key** | 401 / `Unauthorized` / `Invalid token` (key is set) | "FIRECRAWL_API_KEY appears invalid or expired. Update in bob.env or get a fresh one." |
| **Missing key**         | `Missing API key` / `No API key` (key not set)      | "FIRECRAWL_API_KEY is not set. Copy bob.env.example to bob.env and fill in your key." |
| **Rate limit**          | `Rate limit` / `Too many requests`                  | "Firecrawl rate limit reached. Wait or upgrade your plan."                            |

> **Note:** A 401 with no key set suggests a missing key; a 401 with a key set suggests an invalid/expired key. These are distinct — the error message will be different in each case.

## Skill Namespace Convention

Skills are organized by agent name:

- `build/shadcn-ui`, `build/incremental-implementation`, `build/systematic-debugging`
- `plan/interview-me`, `plan/spec-driven-development`
- `explore/context7`
- `writer/documentation-and-adrs`
- `designer/theme-factory`

Top-level group names also work: `skill("build")`, `skill("plan")`.
