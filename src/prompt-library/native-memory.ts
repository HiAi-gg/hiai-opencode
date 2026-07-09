// Shared prompt fragments for the HOST-NATIVE memory + task systems.
//
// The hiai host ships a built-in `memory` tool (Anthropic `memory_20250818`
// spec) backed by persistent, FTS5-indexed markdown files under the host's data
// dir (long-term project memory + per-session checkpoints and task progress).
// It also tracks delegation as a persistent parent/child `task` tree that
// survives restarts.
//
// BobPlugin therefore does NOT ship its own memory store and must not maintain
// a shadow task list — agents use these native systems directly.

export const NATIVE_MEMORY_PROMPT = `
## Project Memory Architecture

You have access to 6 tiers of memory/context:

1. **Current conversation** — everything in this session (messages, tool results, agent outputs)
2. **Session history** — browse past sessions via \`session_read\` / \`session_search\` tools
3. **Project memory (FTS5)** — search MEMORY.md, checkpoint.md, notes.md, progress files via \`hiai_memory_search\`
   Database at ~/.hiai-opencode/data/hiai-memory.db — BM25-ranked full-text search
4. **Project files** — AGENTS.md, README.md, TODO.md, plans/, .opencode/ — always the authoritative source of truth
5. **Subagent results** — summaries and CLOSURE blocks returned by delegated agents
6. **System context** — your identity, model, tools, skills, workspace path

**Persistence contract:**
- Before non-trivial work: use hiai_memory_search to recall prior decisions, patterns, open threads
- After significant work: write to MEMORY.md (Rules, Architecture Decisions, Discovered Knowledge sections)
- After each task: the checkpoint-writer captures status, files touched, next steps to checkpoint.md
- After task completion: update TODO.md if items reference your task; update plans/*.md status
- Keep entries short and factual; the FTS5 index searches them automatically

**Memory files layout:**
- MEMORY.md — project-level durable knowledge (Rules, Architecture Decisions, Discovered Knowledge, Patterns, Gotchas)
- checkpoint.md — per-session summary (Active intent, Next action, Task tree, Files/code, Errors/fixes)
- notes.md — free-form session scratchpad (reconciled by checkpoint-writer)
- tasks/<TID>/progress.md — per-task progress capture`;

export const NATIVE_TASKS_PROMPT = `
## Tasks & delegation tree (host-native)
Delegation via \`task({subagent_type: ...})\` is recorded by the host as a persistent parent/child
task tree (status, progress, checkpoints) that survives restarts. Do NOT keep a separate shadow
task list — rely on the native tree and write progress/decisions to native memory.`;
