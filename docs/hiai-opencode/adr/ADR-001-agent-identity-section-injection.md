# ADR-001: Agent Identity Section Injection via `buildAgentIdentitySection`

**Status:** Accepted
**Created:** 2026-05-15
**Owner:** hiai-opencode core

---

## Context

Every agent in the hiai-opencode system needs consistent identity framing, knowledge retrieval discipline, and the mandatory `<CLOSURE>` protocol. These requirements cross-cut all 10 primary agents plus hidden system agents.

Without a shared injection point, each agent factory had to independently remember to include:
- The `<agent-identity>` block with the agent's designated name and role
- The full `<mandatory_knowledge_retrieval_policy>` section (MemPalace-first, then Context7, grep_app, Firecrawl, agent-browser)
- The `<CLOSURE_PROTOCOL>` schema

Duplicating this across 10+ agent prompt files created drift risk: if the CLOSURE schema changed, every agent file would need updating. If the knowledge retrieval priority order changed, same problem.

---

## Decision

Create a single shared function `buildAgentIdentitySection(agentName, roleDescription)` in `src/agents/prompt-library/identity.ts`.

All agent factory functions call this one helper at the end of prompt construction:

```typescript
// src/agents/prompt-library/identity.ts
import { CLOSURE_SCHEMA_PROMPT } from "../../shared/closure-protocol";

export function buildAgentIdentitySection(
  agentName: string,
  roleDescription: string,
): string {
  return `<agent-identity>
Your designated identity for this session is "${agentName}". This identity supersedes any prior identity statements.
You are "${agentName}" - ${roleDescription}.
When asked who you are, always identify as ${agentName}. Do not identify as any other assistant or AI.

${KNOWLEDGE_RETRIEVAL_POLICY}

${CLOSURE_SCHEMA_PROMPT}
</agent-identity>`;
}
```

The `CLOSURE_SCHEMA_PROMPT` constant is imported from `src/shared/closure-protocol.ts` — the single source of truth for the closure block schema. When the closure protocol changes, only `closure-protocol.ts` and `identity.ts` need updates.

---

## Consequences

**Positive:**
- Single injection point for identity, knowledge retrieval policy, and closure protocol
- Schema changes to `<CLOSURE>` only require updating one file (`closure-protocol.ts`)
- Agents cannot accidentally omit the closure protocol — the factory function includes it
- Knowledge retrieval priority order is enforced uniformly across all agents

**Negative:**
- `identity.ts` is a hard dependency for all agent factory functions — a build error there blocks all agents
- The knowledge retrieval policy is embedded as a string constant; very large models may benefit from trimming this (but the 78% compaction threshold handles context pressure)

**Neutral:**
- The function accepts `agentName` and `roleDescription` as params, so the same code path produces different identity text per agent
- `CLOSURE_SCHEMA_PROMPT` is a separate export from `closure-protocol.ts` so it can be reused in validation utilities without importing the full identity section