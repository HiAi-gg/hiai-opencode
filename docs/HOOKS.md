# Hooks Reference

hiai-opencode registers 30 hooks, organized by category. Hooks are filtered at
composition time by `config.hooks.disabled` in `bob.json`.

## Safety (4 hooks)

| Hook | File | Purpose |
|------|------|---------|
| **legal-gate** | `legal-gate.ts` | Enforces project ethical-use policy — hard deny-list (military, ransomware, credential theft, C2, exfiltration, PII scraping) + contextual deny (dual-use security terms only block when paired with offensive-intent verbs). Also implements ask-before-do via `permission.ask` for high-risk tools (bash, write, edit, patch, webfetch). |
| **non-interactive-env** | `non-interactive-env.ts` | Blocks interactive commands (vim, ssh, nano, etc.) in subagent environments. |
| **write-existing-file-guard** | `write-existing-file-guard.ts` | Warns when writing to an existing file (prevents accidental overwrites). |
| **model-fallback** | `model-fallback.ts` | Falls back to alternate model on provider error. |

## Quality (4 hooks)

| Hook | File | Purpose |
|------|------|---------|
| **quality-gate** | `quality-gate.ts` | Detects lint/typecheck failures in tool output and flags them. |
| **tool-pair-validator** | `tool-pair-validator.ts` | Auto-injects missing `tool_result` blocks when a tool produces output. |
| **thinking-block-validator** | `thinking-block-validator.ts` | Fixes empty or malformed thinking tags. |
| **closure-injector** | `closure-injector.ts` | Enforces `<CLOSURE>` block structure in agent responses. |

## Recovery (5 hooks)

| Hook | File | Purpose |
|------|------|---------|
| **edit-error-recovery** | `edit-error-recovery.ts` | Auto-fix "oldString not found" by suggesting re-read. |
| **json-error-recovery** | `json-error-recovery.ts` | Suggests re-read on JSON parse errors in tool inputs. |
| **context-window-limit-recovery** | `context-window-limit-recovery.ts` | Detects context limit errors → injects compaction hints, resets loop state. |
| **runtime-fallback** | `runtime-fallback.ts` | Caps output at 32K tokens to prevent context overflow. |
| **session-recovery** | `session-recovery.ts` | Classifies session errors into 7 types, records them in loop-state. |

## System (8 hooks)

| Hook | File | Purpose |
|------|------|---------|
| **rules-injector** | `rules-injector.ts` | Injects AGENTS.md rules into system prompt. |
| **context-window-monitor** | `context-window-monitor.ts` | Warns at 70% context window threshold. |
| **think-mode** | `think-mode.ts` | Enables 10K thinking budget for supported agents. |
| **token-budget** | `token-budget.ts` | Manages token budget enforcement. |
| **session-notification** | `session-notification.ts` | Session lifecycle notifications. |
| **agent-usage-reminder** | `agent-usage-reminder.ts` | Reminds agents of available tools/agents. |
| **caveman-system-injector** | `caveman-system-injector.ts` | Injects caveman internal protocol fragments into system prompt for Bob and target subagents. |
| **caveman-message-compressor** | `caveman-message-compressor.ts` | Conservative message/history compressor — currently adds conciseness marker, no lossy rewriting. |

## Lifecycle (4 hooks)

| Hook | File | Purpose |
|------|------|---------|
| **compaction-context-injector** | `compaction-context-injector.ts` | Preserves context during session compaction. |
| **compaction-todo-preserver** | `compaction-todo-preserver.ts` | Preserves todo state across compaction. |
| **reasoning-content-cache** | `reasoning-content-cache.ts` | Caches reasoning content for reuse. |
| **preemptive-compaction** | `preemptive-compaction.ts` | Preemptive compaction before context limit is reached. |

## Loop & Continuation (3 hooks)

| Hook | File | Purpose |
|------|------|---------|
| **loop** | `loop.ts` | Main session-idle loop driver with iteration counting, cooldown, completion detection. |
| **todo-continuation** | `todo-continuation.ts` | Continues on incomplete todo state. |
| **stop-continuation-guard** | `stop-continuation-guard.ts` | Guards against unintended continuation stops. |

## Agent Management (2 hooks)

| Hook | File | Purpose |
|------|------|---------|
| **directory-agents-injector** | `directory-agents-injector.ts` | Injects directory-based agent definitions. |
| **manager-guard** | `manager-guard.ts` | Manages subagent delegation guardrails. |

## Disabling Hooks

In `bob.json`:

```jsonc
{
  "hooks": {
    "disabled": ["non-interactive-env", "context-window-monitor"]
  }
}
```

The `disabled_hooks` legacy array is also supported and merged with `hooks.disabled`.

## Adding a Hook

1. Create a factory function in `src/hooks/<name>.ts`:
   ```ts
   import type { BobConfig, HookSet } from "../types";
   export function createMyHook(config: BobConfig): HookSet { ... }
   ```
2. Register in `src/hooks/index.ts`:
   - Import the factory
   - Add `{ name: "my-hook", factory: createMyHook }` to `ALL_NAMED_HOOK_FACTORIES`
3. The hook is auto-enabled; disable via `hooks.disabled` in bob.json if needed.
