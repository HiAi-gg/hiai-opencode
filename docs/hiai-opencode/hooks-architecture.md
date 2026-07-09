# ARC-001: Hook Architecture

**Owner:** hiai-opencode core
**Status:** Implemented
**Created:** 2026-05-15

## Overview

The hook system is the primary extension point for hiai-opencode. It intercepts OpenCode lifecycle events (session lifecycle, tool execution, message updates) and allows the plugin to react, inject context, or trigger side effects.

Hooks are registered as handlers on OpenCode's plugin interface. Each hook returns an object with one or more handler methods corresponding to OpenCode hook types: `event`, `tool.execute.before`, `tool.execute.after`, `experimental.chat.messages.transform`, and `experimental.session.compacting`.

## Hook Tiers

Hooks are organized as named hook sets registered in `src/hooks/index.ts`:

| Category | Named Hooks | Purpose |
|----------|-------------|---------|
| **Total** | **30** (source: `ALL_NAMED_HOOK_FACTORIES` in `src/hooks/index.ts`) | All named hooks |

The 30 named hooks cover: closure injection, caveman protocol (system injector + message compressor), todo continuation, quality gate, context window monitor, tool pair validator, thinking block validator, write existing file guard, JSON error recovery, edit error recovery, non-interactive env, model fallback, runtime fallback, preemptive compaction, stop continuation guard, rules injector, legal gate, directory agents injector, loop, manager guard, compaction context injector, session notification, agent usage reminder, session recovery, think mode, token budget, compaction todo preserver, reasoning content cache, and context window limit recovery.

Note: Each named hook registers handlers at one or more hook points (`event`, `tool.execute.before`, `tool.execute.after`, `experimental.chat.messages.transform`, etc.). The sum of individual handler registrations across all hook points exceeds the named-hook count of 30.

## Compaction System Architecture

The compaction system prevents context window exhaustion through a layered approach:

```
┌─────────────────────────────────────────────────────┐
│               Compaction Flow                       │
│                                                      │
│  Preemptive Compaction                               │
│  ├── Trigger: usage ratio > 78% after assistant msg  │
│  ├── monitor: tokenCache (providerID, modelID, tokens)│
│  ├── guard: isCompacting() — prevents concurrent     │
│  └── action: session.summarize() with timeout        │
│                                                      │
│  Auto-Compact (error-triggered)                      │
│  ├── Trigger: session.error with parsed token limit  │
│  ├── Strategy 1: empty-content-recovery             │
│  ├── Strategy 2: deduplication                       │
│  ├── Strategy 3: target-token-truncation             │
│  ├── Strategy 4: aggressive-truncation               │
│  └── Strategy 5: summarize-retry                     │
│                                                      │
│  Post-Compaction Degradation Monitor                 │
│  ├── Track: 5 messages after compaction              │
│  ├── Trigger: 3 consecutive no-text responses         │
│  ├── Action: recovery compaction with toast          │
│  └── Guard: MAX_RECOVERY_ATTEMPTS=3                  │
└─────────────────────────────────────────────────────┘
```

## Key Hooks

### `preemptive-compaction.ts`

**Type:** Core — Session hook
**Handlers:** `tool.execute.after`, `event`

Preemptively triggers compaction when the session's token usage exceeds 78% of the resolved context limit. It does not wait for an error.

**Trigger conditions:**
- Usage ratio `(inputTokens + cacheReadTokens) / actualLimit > 0.78`
- Session has a cached token state (populated via `message.updated`)
- No active compaction in progress (`isCompacting()`)
- Cooldown elapsed (>60s since last compaction attempt)

**Key functions:**
- `withTimeout(promise, 60_000)` — hard timeout on summarize call
- `resolveCompactionModel()` — resolves per-agent compaction model override from `pluginConfig.agents.<agent>.compaction.model`
- `markCompacting()` / `markCompactionDone()` — shared state guard

**Dependencies:** `shared/compaction-in-progress` (isCompacting, markCompacting, markCompactionDone)

### `context-window-monitor.ts`

**Type:** Core — Session hook
**Handlers:** `tool.execute.after`, `event`

Monitors context usage and injects a reminder directive when usage exceeds 70%. Unlike preemptive compaction, this does not trigger compaction — it only advises the agent to be more concise.

**Trigger conditions:**
- Usage ratio > 0.70 after assistant message finish
- Session not yet reminded

**Effect:** Appends to tool output:
```
[Context Status: {usedPct}% used ({usedTokens}/{limitTokens} tokens), {remainingPct}% remaining]
```

### `anthropic-context-window-limit-recovery/`

**Type:** Core — Session hook (disposable)
**Handler:** `event`

Recovers from context window limit errors using a multi-strategy approach applied in sequence.

**Recovery strategies (priority order):**

| Strategy | File | Mechanism |
|----------|------|-----------|
| Empty content recovery | `empty-content-recovery.ts` | Handle empty/null content blocks in messages |
| Deduplication | `deduplication-recovery.ts` | Remove duplicate tool results from context |
| Target token truncation | `target-token-truncation.ts` | Truncate largest tool outputs to fit 50% target ratio |
| Aggressive truncation | `aggressive-truncation-strategy.ts` | Last-resort truncation with minimal output preservation |
| Summarize retry | `summarize-retry-strategy.ts` | Compaction + summarization then retry |

**Event handling:**
- `session.error` — parse error with `parseAnthropicTokenLimitError()`, schedule compaction with 300ms delay
- `message.updated` — capture error info if role=assistant with error
- `session.idle` — execute compaction if session is in pendingCompact state and has no summary

**Configuration:**
- Max attempts: 2
- Initial delay: 2s, backoff ×2, max 30s
- Max truncation attempts: 20
- Target token ratio: 0.5

### `compaction-context-injector/`

**Type:** Core — Transform hook (on `experimental.session.compacting`)
**Handlers:** `capture(sessionID)`, `inject(sessionID?)`, `event`

Injects context around compaction events. The `capture` function saves the agent config checkpoint before compaction. The `inject` function appends the compaction context prompt after compaction.

**Event handling:**
- `session.compacted` — recovers checkpointed agent config, warns about no-text tails
- `session.idle` — finalizes tracked assistant messages
- `message.part.delta` — tracks text output to detect no-text tails

**Key behavior:** Integrates with `backgroundManager.taskHistory` to inject active delegated session history into the compaction context prompt.

### `compaction-todo-preserver/`

**Type:** Core — Transform hook (on `experimental.session.compacting`)
**Handlers:** `capture(sessionID)`, `event`

Captures the todo list before compaction and restores it after.

**Event handling:**
- `session.compacted` — restores todos via `opencode/session/todo`'s `Todo.update`
- `session.deleted` — clears local snapshot

**Behavior:** Skips restore if todos already exist post-compaction.

## Shared State

### `shared/compaction-in-progress.ts`

```typescript
const compactionInProgress = new Set<string>()

export function isCompacting(sessionID: string): boolean
export function markCompacting(sessionID: string): void
export function markCompactionDone(sessionID: string): void
export function clearSession(sessionID: string): void
```

Prevents concurrent compaction attempts on the same session. Used by `preemptive-compaction.ts`, `preemptive-compaction-degradation-monitor.ts`, and `anthropic-context-window-limit-recovery/recovery-hook.ts`.

### `shared/compaction-model-resolver.ts`

```typescript
resolveCompactionModel(
  pluginConfig: HiaiOpenCodeConfig,
  sessionID: string,
  originalProviderID: string,
  originalModelID: string
): { providerID: string; modelID: string }
```

Resolves which model to use for compaction, reading from the session's assigned agent name. Falls back to the original model if no override is configured.

## Hook Execution Order

Hooks are executed in registration order. OpenCode calls handlers synchronously per hook type. The execution order across tiers is not deterministic — each hook type (`event`, `tool.execute.after`, etc.) runs its registered hooks in the order they were composed in `createHooks()`.

**Observed execution order for compaction:**

1. `context-window-monitor` — `tool.execute.after`: checks usage ratio, does not trigger compaction
2. `preemptive-compaction` — `tool.execute.after`: checks usage ratio, may trigger compaction via `session.summarize()`
3. `preemptive-compaction-degradation-monitor` — driven by `preemptive-compaction` callback, monitors post-compaction messages
4. `compaction-context-injector` — `experimental.session.compacting`: injects context
5. `compaction-todo-preserver` — `experimental.session.compacting`: preserves todos
6. `anthropic-context-window-limit-recovery` — `event` (`session.error`): handles error-based compaction

## Error Handling

- **`withTimeout` wrapper:** All `session.summarize()` calls are wrapped in a timeout (60s preemptive, 120s recovery). On timeout, the compaction is considered failed and the session continues.
- **Toast notifications:** Failures in preemptive compaction show a warning toast. Recovery compaction shows a "Session Degradation Detected" toast.
- **Per-hook isolation:** The `safeHook()` wrapper in composition files catches errors per-hook without breaking the chain. A failing hook does not prevent other hooks from running.
- **`dispose()`:** Some hooks expose a `dispose()` function to clean up timers and state. These are called via `disposeCreatedHooks()` when the plugin shuts down.

## Hook Handler Types

| Handler | File pattern | Purpose |
|---------|-------------|---------|
| `event` | Most session hooks | Handle session lifecycle events: `session.created`, `session.deleted`, `session.idle`, `session.error`, `session.compacted`, `message.updated` |
| `tool.execute.before` | Tool guard hooks | Inspect/modify tool input before execution |
| `tool.execute.after` | Tool guard hooks, monitoring hooks | Inspect/modify tool output after execution |
| `experimental.chat.messages.transform` | Transform hooks | Modify message content before sending to model |
| `experimental.session.compacting` | Compaction hooks | Capture/restore state around compaction |

## Key Files Reference

| File | Purpose |
|------|---------|
| `src/create-hooks.ts` | Top-level hook composition — `createCoreHooks()` + `createContinuationHooks()` + `createSkillHooks()` |
| `src/plugin/hooks/create-core-hooks.ts` | Aggregates session, tool guard, and transform hooks |
| `src/plugin/hooks/create-session-hooks.ts` | 22 session lifecycle hooks |
| `src/plugin/hooks/create-tool-guard-hooks.ts` | 15 pre/post tool execution guards |
| `src/plugin/hooks/create-transform-hooks.ts` | 6 message transform hooks |
| `src/plugin/hooks/create-continuation-hooks.ts` | 8 continuation/todo hooks |
| `src/plugin/hooks/create-skill-hooks.ts` | 2 skill hooks |
| `src/hooks/shared/compaction-in-progress.ts` | Shared compaction lock |
| `src/hooks/shared/compaction-model-resolver.ts` | Per-agent compaction model resolution |
| `src/hooks/preemptive-compaction.ts` | Preemptive compaction trigger |
| `src/hooks/preemptive-compaction-degradation-monitor.ts` | Post-compaction degradation detection |
| `src/hooks/preemptive-compaction-no-text-tail.ts` | Detects no-text assistant responses |
| `src/hooks/context-window-monitor.ts` | Context usage reminder |
| `src/hooks/anthropic-context-window-limit-recovery/` | Multi-strategy error recovery (~31 files) |
| `src/hooks/compaction-context-injector/` | Compaction context injection |
| `src/hooks/compaction-todo-preserver/` | Todo preservation |