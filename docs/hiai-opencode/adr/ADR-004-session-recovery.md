# ADR-004: Session Recovery with State-Backup and Checkpoints

**Status:** Accepted
**Created:** 2026-05-15
**Owner:** hiai-opencode core

---

## Context

OpenCode sessions can fail in ways that lose work:
- Context window limit errors that cannot be recovered via compaction
- Session deletion (`:done`, timeout, or explicit close)
- Hard errors that put the session into an unrecoverable state
- Agent crashes mid-task with unresolved todos

When a session dies, the agent loses: conversation history, todo state, pending tool results, and any context that was being built. The user experience was: start over from scratch.

Existing recovery mechanisms were limited to compaction (context reduction), which helps with token limits but does not address session death, todo loss, or state corruption.

---

## Decision

Implement a multi-layer session recovery system:

### Layer 1: Todo Preservation Around Compaction

`src/hooks/compaction-todo-preserver/` captures the full todo list before compaction and restores it after:

- `session.compacted` event → restore todos via `opencode/session/todo`'s `Todo.update`
- `session.deleted` event → clear local snapshot
- Skips restore if todos already exist post-compaction (avoid overwriting intentional post-compaction changes)

This ensures todos survive the most common context-recovery operation.

### Layer 2: Compaction Context Injection

`src/hooks/compaction-context-injector/` saves a checkpoint of agent config before compaction, then injects a context summary after:

- `capture(sessionID)` — saves agent config checkpoint before `session.compacted`
- `session.compacted` → recovers checkpointed agent config, warns about no-text tails
- `session.idle` → finalizes tracked assistant messages
- `message.part.delta` → tracks text output to detect no-text tails

The `inject` function appends compaction context to the next prompt so the resumed session has continuity.

### Layer 3: Session Recovery Hook

`src/hooks/session-recovery.ts` (part of `createContinuationHooks`) handles post-failure session state reconstruction:

- On `session.idle` after an error → attempt to reconstruct todo state from last known good checkpoint
- On `session.created` → check for recovered state and offer to resume

### Layer 4: Background Task History for Delegated Sessions

`backgroundManager.taskHistory` tracks the history of delegated sub-agent sessions. When compaction occurs, `compaction-context-injector` injects this history into the compaction context prompt so the parent agent can see what sub-agents were working on.

---

## Consequences

**Positive:**
- Todo lists survive compaction and session recovery — the most common failure mode
- Agent config checkpoints survive compaction, allowing the resumed session to use the same model/settings
- Delegated task history provides continuity when a parent agent resumes after sub-agents complete
- No-text tail detection catches degraded sessions early and triggers recovery compaction

**Negative:**
- Checkpoint storage is in-memory (via `backgroundManager.taskHistory`) — a full server restart loses recovery state
- Session recovery from a fully deleted session is limited to todos and agent config; conversation history is not reconstructable
- The `compaction-context-injector` injects context that increases prompt size — too many compactifications can cause the injected context itself to approach context limits

**Neutral:**
- Session recovery is best-effort, not guaranteed — agents should still emit `<promise>DONE</promise>` promptly to allow the loop to exit cleanly rather than relying on recovery
- Todo preservation uses OpenCode's native `Todo.update` API, so todo state is as durable as OpenCode's native session storage