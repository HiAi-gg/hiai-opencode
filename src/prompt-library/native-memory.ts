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

Use the HOST tools — do not invent a shadow notebook.

1. **Native \`memory\` tool** (OpenCode built-in) — primary. Recall/write curated facts:
   decisions, architecture, patterns, open product questions. Call it BEFORE planning or
   a non-trivial wave. After a decision that should survive this session, write it back.
2. **Current conversation** — this session's messages and tool results
3. **\`hiai_memory_search\`** — forensic BM25 over transcripts/checkpoints when native memory
   has no hit (not the default lookup)
4. **Project files** — AGENTS.md, README.md, \`.bob/plans/\` — authoritative for this repo
5. **Subagent Result Envelopes** — consume, do not re-search
6. **System context** — identity, model, tools, workspace

**Persistence contract:**
- Before Plan / before a wave: native \`memory\` recall (then hiai_memory_search only if empty)
- After a durable decision: native \`memory\` write (short, factual)
- Do not dump session transcripts into memory
- Keep entries short; prefer one fact per write`;

export const NATIVE_TASKS_PROMPT = `
## Native tasks (OpenCode TUI)

The host has two trees. Use both; do not invent a third.

1. **\`task({subagent_type})\`** — OpenCode records parent/child sessions. This is how waves
   show up as nested work in the TUI. Fire parallel steps as concurrent \`task()\` in ONE turn.
2. **\`todowrite\`** — the checklist the user sees. Bob (and Plan in a *direct* session) MUST
   mirror the frozen plan as nested items so phases are parents and steps are children.

\`todowrite\` format (flat list; numbering + indent = hierarchy the TUI renders):

\`\`\`
todowrite({ todos: [
  { id: "p1", content: "Phase 1 — Research", status: "pending" },
  { id: "p1.1", content: "  1.1 Map structure — owner: explore", status: "pending" },
  { id: "p1.2", content: "  1.2 Find feature files — owner: explore", status: "pending" },
  { id: "p2", content: "Phase 2 — Implement", status: "pending" },
  { id: "p2.1", content: "  2.1 Auth module — owner: build", status: "pending" },
  { id: "p3", content: "Phase 3 — Delivery review — owner: critic", status: "pending" }
]})
\`\`\`

Rules:
- One todo per plan step. Phase headers are parent rows; steps are indented sub-items (\`  N.M \`).
- Mark the current wave \`in_progress\` before dispatch; mark a step \`completed\` when its envelope returns.
- Never batch-complete a whole phase in one write unless every step actually finished.
- Workers do not call \`todowrite\` (permission denied). Bob owns the list.
- Do not keep a markdown checkbox list as the source of truth — \`todowrite\` is.`;
