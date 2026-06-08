# BackgroundManager Persistence Layer Specification

> **Status:** Design spec only — NOT implemented.
> **Date:** 2026-06-08
> **Related:** Part A1.6 of hiai-opencode mega-plan

## Problem

BackgroundManager stores ALL task state in-memory (JavaScript Maps). If the OpenCode process restarts or crashes:
- All running/pending background tasks are lost
- Task history is lost
- Descendant counts are lost
- Parent session notifications are lost

This causes "tasks disappear forever" after process restarts.

## Goals

1. **Survive process restarts** — Running tasks should resume after OpenCode restarts
2. **Survive crashes** — Task state should be recoverable after unexpected termination
3. **Minimal overhead** — Persistence should not slow down normal operations
4. **Backward compatible** — In-memory mode should still work for users who don't enable persistence

## Non-Goals

- Full message history persistence (that's the session's job)
- Cross-machine replication
- Encryption at rest

## Design

### Storage: SQLite + WAL Journal

SQLite is chosen because:
- Single file, no external dependencies
- ACID transactions
- WAL mode allows readers without blocking writers
- Bun has built-in `bun:sqlite` (fast, native)

### Schema

```sql
CREATE TABLE IF NOT EXISTS background_tasks (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL, -- pending, running, completed, error, cancelled, interrupt
  agent TEXT NOT NULL,
  model_provider TEXT,
  model_id TEXT,
  description TEXT,
  prompt TEXT,
  parent_session_id TEXT,
  root_session_id TEXT,
  session_id TEXT,
  spawn_depth INTEGER DEFAULT 0,
  queued_at INTEGER, -- Unix timestamp (ms)
  started_at INTEGER,
  completed_at INTEGER,
  error TEXT,
  progress_tool_calls INTEGER DEFAULT 0,
  progress_last_tool TEXT,
  progress_last_update INTEGER,
  progress_tool_call_window TEXT, -- JSON
  concurrency_key TEXT,
  concurrency_group TEXT,
  category TEXT,
  fallback_chain TEXT, -- JSON
  attempt_count INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS task_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL,
  parent_session_id TEXT NOT NULL,
  notification TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch() * 1000),
  FOREIGN KEY (task_id) REFERENCES background_tasks(id)
);

CREATE TABLE IF NOT EXISTS descendant_counts (
  root_session_id TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON background_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON background_tasks(parent_session_id);
CREATE INDEX IF NOT EXISTS idx_tasks_root ON background_tasks(root_session_id);
```

### Write Strategy: Journal-First

1. On every state change (launch, start, complete, cancel, error), write to SQLite immediately
2. Use transactions for batch updates (e.g., shutdown)
3. WAL mode for concurrent reads during writes
4. Prune completed tasks older than TASK_TTL_MS (default 30 min)

### Read Strategy: Lazy Load

1. On BackgroundManager startup, load all non-terminal tasks from SQLite into memory
2. Terminal tasks (completed, error, cancelled > 30 min old) are skipped
3. In-memory Maps remain the primary working set

### Recovery on Startup

```typescript
async function recoverTasks(db: Database): Promise<BackgroundTask[]> {
  const rows = db.query(`
    SELECT * FROM background_tasks
    WHERE status IN ('pending', 'running')
       OR (status IN ('completed', 'error', 'cancelled', 'interrupt')
           AND completed_at > ${Date.now() - TASK_TTL_MS})
  `).all()

  return rows.map(row => ({
    id: row.id,
    status: row.status,
    agent: row.agent,
    model: row.model_provider ? { providerID: row.model_provider, modelID: row.model_id } : undefined,
    description: row.description,
    prompt: row.prompt,
    parentSessionID: row.parent_session_id,
    rootSessionID: row.root_session_id,
    sessionID: row.session_id,
    spawnDepth: row.spawn_depth,
    queuedAt: row.queued_at ? new Date(row.queued_at) : undefined,
    startedAt: row.started_at ? new Date(row.started_at) : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    error: row.error,
    progress: {
      toolCalls: row.progress_tool_calls,
      lastTool: row.progress_last_tool,
      lastUpdate: row.progress_last_update ? new Date(row.progress_last_update) : undefined,
      toolCallWindow: row.progress_tool_call_window ? JSON.parse(row.progress_tool_call_window) : undefined,
    },
    concurrencyKey: row.concurrency_key,
    concurrencyGroup: row.concurrency_group,
    category: row.category,
    fallbackChain: row.fallback_chain ? JSON.parse(row.fallback_chain) : undefined,
    attemptCount: row.attempt_count,
  }))
}
```

### Migration Path

1. Add `persistence.enabled` to `background_task` config schema (default: false)
2. If enabled, create/open SQLite DB on BackgroundManager init
3. If disabled, behavior is identical to current (in-memory only)
4. No breaking changes for existing users

### Files

- `src/features/background-agent/persistence.ts` — SQLite wrapper
- `src/features/background-agent/persistence-recovery.ts` — Startup recovery logic
- Update `src/features/background-agent/manager.ts` — Add persistence hooks
- Update `src/config/schema/background-task.ts` — Add `persistence` config

### Performance Considerations

- WAL mode keeps writes fast (~1ms per transaction)
- Reads are from in-memory Maps (no DB reads during normal operation)
- Only startup does a single SELECT query
- Background prune job every 5 minutes removes old terminal tasks

### Risks

1. **Disk space** — SQLite file grows with task volume. Mitigation: prune old tasks.
2. **Bun:sqlite compatibility** — Verify on all supported platforms. Fallback: `better-sqlite3`.
3. **Session ID validity** — Recovered tasks may have stale session IDs if OpenCode restarted. Session IDs are OpenCode-managed and may not survive restart. **Mitigation:** On recovery, verify session exists via `client.session.status()`. If session is gone, mark task as error.

## Acceptance Criteria (for future implementation)

- [ ] Config flag `background_task.persistence.enabled` (default: false)
- [ ] SQLite schema migration on first start
- [ ] All state changes written to DB within 10ms
- [ ] Recovery loads non-terminal tasks on startup
- [ ] Prune removes terminal tasks older than 30 min
- [ ] `bun run typecheck` passes
- [ ] Unit tests for persistence layer
- [ ] Manual test: launch task → kill OpenCode → restart → task resumes
