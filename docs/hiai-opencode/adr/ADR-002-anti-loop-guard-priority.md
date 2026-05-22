# ADR-002: Anti-Loop Guard Priority — CLOSURE Before Diary_Write

**Status:** Accepted
**Created:** 2026-05-15
**Owner:** hiai-opencode core

---

## Context

When an agent completes significant work, two post-action steps may apply:
1. **CLOSURE block** — mandatory task completion marker, required on every agent response
2. **MemPalace diary write** — optional recording of outcomes/decisions for project memory

Both are important, but they compete when an agent is operating near context limits or responding to a direct user request that implies action. The question: which one takes priority when only one can reliably fit in the output?

The original implementation placed diary_write at the same priority as CLOSURE delivery, creating a race condition. In high-pressure responses (tool calls, error recovery, final deliverables), agents sometimes omitted the CLOSURE block because they wrote diary content instead — triggering automatic rejection by the closure validator.

---

## Decision

The `<mandatory_knowledge_retrieval_policy>` embedded in every agent prompt via `buildAgentIdentitySection()` states the priority explicitly:

```
**PRIORITY ORDER**: When CLOSURE and diary_write both apply, deliver CLOSURE FIRST — diary is optional. If context-limit warning is active, skip diary_write, deliver CLOSURE immediately.
```

This rule is enforced by:

1. **Prompt-level instruction** — every agent receives the priority rule in their identity section
2. **Context-limit guard** — when `context-window-monitor` detects usage > 70%, the directive to skip diary_write is activated
3. **No hard dependency** — `mempalace_diary_write` is called voluntarily by the agent after CLOSURE; it is never a hard requirement for task completion

The CLOSURE block schema:

```xml
<CLOSURE>
{
  "reasoning": "Concise summary of what was achieved and why it satisfies the request.",
  "evidence": ["Link to test results", "File path to changes", "Log snippets", "LSP diagnostics clean"],
  "readiness": "done" | "accept" | "reject"
}
</CLOSURE>
```

---

## Consequences

**Positive:**
- Closure validator rejection rate drops to near-zero for normal completion paths
- Agents operating under context pressure cannot accidentally fail the closure gate by writing diary entries first
- Diary recording remains available and encouraged, just as a best-effort secondary action
- The priority rule is visible in every agent's prompt, making it self-enforcing

**Negative:**
- Diary entries may be less complete when agents are near context limits, as diary_write is skipped
- No hard technical enforcement — agents that ignore the prompt directive can still omit CLOSURE; the validator catches this downstream but does not prevent it

**Neutral:**
- The `mempalace_diary_write` tool is still available and recommended for significant work; the policy only prevents it from blocking CLOSURE delivery
- The context-window-monitor at 70% usage activates the "skip diary" recommendation, so agents are warned before hitting the 78% compaction threshold