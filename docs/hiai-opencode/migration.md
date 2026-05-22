# Migration Guide

**hiai-opencode** — upgrading from legacy configurations and handling agent name changes.

---

## Agent Name Migrations

Three agent names have been deprecated and replaced. The migration is handled automatically by `src/shared/migration/agent-names.ts` — old names are resolved to their canonical replacements at config load time.

| Deprecated | Replacement | Deprecated since |
|---|---|---|
| `guard` | `manager` | 2026-04-11 |
| `brainstormer` | `writer` | 2026-04-11 |
| `multimodal` | `vision` | 2026-04-11 |

### `guard` → `manager`

`guard` was the delegation orchestrator with an emphasis on error verification. `manager` is the same role but focused on delegation, TODO tracking, session handoffs, and memory stewardship. Error verification is now `critic`'s explicit job.

**Config before:**
```json
{
  "models": {
    "guard": { "model": "opencode-go/qwen3.6-plus", "recommended": "middle" }
  }
}
```

**Config after:**
```json
{
  "models": {
    "manager": { "model": "opencode-go/qwen3.6-plus", "recommended": "middle" }
  }
}
```

**Prompt call before:**
```typescript
task(subagent_type="guard", description="Coordinate the review sprint", prompt="...")
```

**Prompt call after:**
```typescript
task(subagent_type="manager", description="Coordinate the review sprint", prompt="...")
```

---

### `brainstormer` → `writer`

`brainstormer` owned ideation and creative exploration. `writer` owns all copy, content, positioning, SEO, and ideation work. The capability set is the same; the name is more precise.

**Config before:**
```json
{
  "models": {
    "brainstormer": { "model": "openrouter/mistralai/mistral-small-2603", "recommended": "writing" }
  }
}
```

**Config after:**
```json
{
  "models": {
    "writer": { "model": "openrouter/mistralai/mistral-small-2603", "recommended": "writing" }
  }
}
```

**Prompt call before:**
```typescript
task(subagent_type="brainstormer", load_skills=["website-copywriting"], description="Draft landing page hero", prompt="...")
```

**Prompt call after:**
```typescript
task(subagent_type="writer", load_skills=["website-copywriting"], description="Draft landing page hero", prompt="...")
```

---

### `multimodal` → `vision`

`multimodal` was the PDF/image/diagram extraction and browser UI verification role. `vision` is the canonical name for this role.

**Config before:**
```json
{
  "models": {
    "multimodal": { "model": "openrouter/google/gemma-4-26b-a4b-it", "recommended": "vision" }
  }
}
```

**Config after:**
```json
{
  "models": {
    "vision": { "model": "openrouter/google/gemma-4-26b-a4b-it", "recommended": "vision" }
  }
}
```

**Prompt call before:**
```typescript
task(subagent_type="multimodal", description="Extract diagrams from the architecture PDF", prompt="...")
```

**Prompt call after:**
```typescript
task(subagent_type="vision", description="Extract diagrams from the architecture PDF", prompt="...")
```

---

## Auto-Migration

The plugin resolves legacy names automatically. If your config or prompt uses a deprecated name, it will be remapped to the canonical replacement at runtime via `migrateAgentNames()` in `src/shared/migration/agent-names.ts`.

Explicitly migrating to the new names is recommended to avoid relying on the compatibility layer.

---

## Config File Changes

### Schema Requirement: 10 Explicit Model Slots

The config schema requires these 10 keys in `models`:

```
bob, coder, strategist, guard, critic, designer, researcher, manager, brainstormer, vision
```

The schema still accepts the legacy `guard` and `brainstormer` keys alongside `manager` and `writer` for backward compatibility, but the runtime resolves them to the same slots.

If you have a minimal config with only the 5 legacy keys, you must add the missing 5 slots before the schema will validate.

### MCP Object Key Changes

| Old key | New key | Notes |
|---|---|---|
| `mcp.playwright` | `mcp.agentBrowser` | Playwright is forbidden; use `/agent-browser` skill instead |

---

## Breaking Changes in Recent Versions

### v0.x → v1.0 (2026-04-11)

- **Agent names:** `guard` → `manager`, `brainstormer` → `writer`, `multimodal` → `vision`
- **Config schema:** 10-key `models` object is now required; 5-key configs are no longer valid
- **Playwright removed:** All browser automation now uses `/agent-browser` skill; `mcp.playwright` is replaced by `mcp.agentBrowser`
- **CLOSURE protocol mandatory:** All agents must emit a `<CLOSURE>` block on every response; responses without it are rejected
- **Skill discovery defaults hardened:** Global OpenCode, Claude, and Agents skill folders are now `false` by default

### Before v0.x

- MCP servers were listed directly in `opencode.json` plugin config
- Now: MCP configuration lives exclusively in `hiai-opencode.json` under the `mcp` object
- Agent prompts did not include the mandatory CLOSURE protocol

---

## How to Downgrade If Needed

### Temporary Rollback via Config Override

If a new version causes issues, you can pin to a specific npm version:

```bash
opencode plugin @hiai-gg/hiai-opencode@<version> --global
```

Check available versions:

```bash
npm view @hiai-gg/hiai-opencode versions --json
```

### Restoring a Compatible Config

Before downgrading, restore a compatible `hiai-opencode.json`:

1. The 5-key model config (before the 10-key requirement) is only valid on versions before `2026-04-11`
2. Remove `vision`, `writer`, `manager` slots if present
3. Keep `guard`, `brainstormer`, `multimodal` slots

Example pre-v1.0 config:

```json
{
  "models": {
    "bob": { "model": "kimi-for-coding/k2p6", "recommended": "high" },
    "coder": { "model": "minimax-coding-plan/MiniMax-M2.7", "recommended": "fast" },
    "strategist": { "model": "deepseek/deepseek-v4-pro", "recommended": "xhigh" },
    "guard": { "model": "opencode-go/qwen3.6-plus", "recommended": "middle" },
    "critic": { "model": "opencode-go/mimo-v2.5-pro", "recommended": "high" }
  }
}
```

### Known Regressions When Downgrading

- **From v1.0 to pre-v1.0:** The `manager`, `writer`, `vision` model slots in your config will be ignored; agents route to the legacy `guard`/`brainstormer`/`multimodal` slots instead
- **Compaction hooks:** Pre-v1.0 did not have `compaction-context-injector` or `compaction-todo-preserver`; todo state is not preserved across compaction on older versions
- **CLOSURE enforcement:** Pre-v1.0 does not validate `<CLOSURE>` blocks; agents may produce responses that are now rejected after upgrading back