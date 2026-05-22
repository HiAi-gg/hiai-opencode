# ADR-003: Compaction Mechanism — 15s Guard, 78% Threshold

**Status:** Accepted
**Created:** 2026-05-15
**Owner:** hiai-opencode core

---

## Context

Large context windows are a finite resource. When an OpenCode session runs long, the risk of hitting a hard context limit increases. The session becomes unusable — every message returns a token limit error with no recovery path except manual restart.

Two questions needed answers:
1. **When** should compaction trigger? (threshold)
2. **How** should concurrent compaction attempts be prevented? (guard)

Early prototypes triggered compaction only on hard errors (`session.error` with token limit). This meant the first compaction attempt always came *after* a failed response — the agent had already wasted a turn and potentially corrupted state. We needed preemptive action.

For the guard, early prototypes had no synchronization. Multiple hooks could independently decide to compact the same session simultaneously, causing race conditions in the summarize call.

---

## Decision

### Threshold: 78%

The `preemptive-compaction` hook monitors token usage after every assistant message. When the ratio `(inputTokens + cacheReadTokens) / actualLimit > 0.78`, it calls `session.summarize()` to compact the context before the hard limit is reached.

The 78% figure was chosen empirically:
- At 70%, `context-window-monitor` only *reminds* the agent to be concise — no compaction yet
- At 78%, there is enough headroom for the summarize call itself (~60s, ~5–10% of context) without immediately hitting the wall
- Below 78%, the overhead of compaction exceeds the benefit of doing it early
- Above 78%, the risk of not having enough room to complete the summarize call itself becomes non-trivial

### Guard: 15-Second Lock + Shared Set

Concurrent compaction attempts are prevented by a shared `compactionInProgress` Set in `src/hooks/shared/compaction-in-progress.ts`:

```typescript
const compactionInProgress = new Set<string>();

export function isCompacting(sessionID: string): boolean
export function markCompacting(sessionID: string): void
export function markCompactionDone(sessionID: string): void
export function clearSession(sessionID: string): void
```

Additionally, a 60-second cooldown between compaction attempts prevents thrashing on sessions that compact successfully but immediately approach the threshold again.

### Hard Timeout: 60s

All `session.summarize()` calls are wrapped in `withTimeout(promise, 60_000)`. On timeout, compaction is considered failed and the session continues without compaction. The `preemptive-compaction-degradation-monitor` then tracks post-compaction message quality to detect if the session entered a degraded (no-text response) state.

---

## Consequences

**Positive:**
- Preemptive compaction prevents hard limit errors in the common case where a session runs long but not extremely long
- The shared Set guard ensures no two hooks can trigger simultaneous compaction on the same session
- 60s timeout prevents summarize calls from blocking session progress indefinitely
- Degradation monitor provides a safety net: if compaction causes output quality collapse, recovery compaction is attempted

**Negative:**
- 78% threshold is a global constant — some models/context configurations may want a lower threshold
- The 60s timeout can fire on genuinely slow summarize calls, leaving the session uncompacted and approaching the limit
- Cooldown of 60s means a session that triggers compaction cannot be compacted again for 60 seconds, even if it immediately approaches the limit again

**Neutral:**
- Compaction model can be overridden per-agent via `pluginConfig.agents.<agent>.compaction.model`
- The summarize call itself consumes context (~5–10%), so the effective gain is context reduction, not elimination of the limit problem