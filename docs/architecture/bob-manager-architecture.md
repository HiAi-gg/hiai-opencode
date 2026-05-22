# Bob→Manager Worker Pool Architecture

**Document Version:** 2026-05-14
**ARC:** ARC-009
**Status:** Implemented (verified against source)

---

## Overview

The hiai-opencode agent system implements a two-tier orchestration hierarchy:

- **Tier 1 (Singletons):** Bob, Strategist, Critic, Designer — directly owned by the orchestrator
- **Tier 2 (Worker Pool):** Coder, Researcher, Vision, Writer — coordinated by Manager

This architecture ensures clear separation of concerns: Bob handles top-level orchestration and routing, Manager coordinates the execution workforce, and specialized agents perform domain-specific work.

---

## Agent Hierarchy

```
                    ┌─────────────────────────────────────────┐
                    │              USER INPUT                 │
                    └─────────────────┬─────────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────────────┐
                    │              BOB (Orchestrator)         │
                    │  • Intent classification                 │
                    │  • Strategic delegation routing           │
                    │  • Parallel execution orchestration       │
                    │  • Singleton: owns Strategist/Critic/      │
                    │    Manager/Designer directly              │
                    └──────────┬───────────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
   ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐
   │  STRATEGIST   │   │    CRITIC    │   │     MANAGER      │
   │  (Planning)   │   │   (Review)   │   │ (Worker Pool Co.)│
   │               │   │              │   │                  │
   │ Architecture  │   │ Plan gate   │   │ Coder            │
   │ Scope def     │   │ Code review  │   │ Researcher       │
   │ Work breakdown│   │ QA verify   │   │ Vision           │
   │               │   │             │   │ Writer           │
   └──────────────┘   └──────────────┘   └────────┬─────────┘
                                                  │
                              ┌───────────────────┼───────────────────┐
                              │                   │                   │
                              ▼                   ▼                   ▼
                       ┌────────────┐     ┌────────────┐     ┌────────────┐
                       │   CODER    │     │ RESEARCHER │     │   VISION   │
                       │ (Deep Impl)│     │ (Discovery)│     │ (Media/UI) │
                       └────────────┘     └────────────┘     └────────────┘
                                                           ┌────────────┐
                                                           │   WRITER   │
                                                           │   (Copy)   │
                                                           └────────────┘
```

---

## Tier 1 — Singleton Agents (Bob-owned)

Bob owns these four agents directly. They are singletons — one instance, directly callable.

### Bob
- **Role:** Primary orchestrator, intent classifier, top-level router
- **Mode:** `primary`
- **Delegates to:** Strategist, Critic, Manager, Designer
- **Key principle:** Never implements directly; orchestrates specialists

### Strategist
- **Role:** Planning, architecture, work breakdown
- **Mode:** `subagent`
- **Trigger:** Complex scope, multi-step tasks, ambiguous requirements
- **Bob's usage:** Consult FIRST before implementation on non-trivial tasks

### Critic
- **Role:** Review gate, high-accuracy verification
- **Mode:** `subagent`
- **Trigger:** Plan validation, code review, QA gate before completion
- **Bob's usage:** Blocks implementation until approval

### Designer
- **Role:** UI/visual direction via Stitch MCP, design systems
- **Mode:** `subagent`
- **Trigger:** Visual problems, layout, design tokens, screen generation
- **Bob's usage:** Routes all visual work to Designer, not Coder

---

## Tier 2 — Worker Pool Agents (Manager-coordinated)

Manager acts as the worker pool coordinator. These agents are spawned as needed for specific work units.

### Manager
- **Role:** Delegation orchestrator + Memory steward (MemPalace)
- **Mode:** `subagent`
- **Owns:**
  - TODO tracking and plan checkbox management
  - Session continuity (session_id tracking for handoffs)
  - MemPalace writes (durable decisions, architecture choices)
  - Post-wave verification coordination (Quality Guardian)
- **Coordinates:** Coder, Researcher, Vision, Writer
- **Key principle:** Delegates ALL implementation; never writes code

### Coder
- **Role:** Deep implementation, substantial code changes
- **Category routing:** `category="deep"`, `category="unspecified-high"`, `category="visual-engineering"`
- **Trigger:** Multi-file changes, complex logic, architecture implementation
- **Manager's usage:** Primary executor for implementation tasks

### Researcher
- **Role:** Codebase exploration, external documentation discovery
- **Category routing:** `subagent_type="researcher"` (direct call)
- **Trigger:** Pattern finding, library docs, OSS code search
- **Manager's usage:** Background discovery; always `run_in_background=true`

### Vision
- **Role:** PDF/image/diagram extraction, browser-based UI verification
- **Category routing:** `subagent_type="vision"` (direct call)
- **Trigger:** Screenshot analysis, multimodal extraction, UI verification
- **Manager's usage:** Screenshot/verification tasks via agent-browser skill

### Writer
- **Role:** Copy, content, positioning, SEO, landing pages
- **Category routing:** `subagent_type="writer"` (direct call)
- **Trigger:** Website copy, product messaging, naming
- **Manager's usage:** All text/copy tasks; uses `website-copywriting` skill

---

## Delegation Path Summary

| From | To | Routing Method | Use Case |
|------|----|----------------|----------|
| Bob | Strategist | `task(subagent_type="strategist", ...)` | Architecture, scope, planning |
| Bob | Critic | `task(subagent_type="critic", ...)` | Plan review, code review, QA gate |
| Bob | Designer | `task(subagent_type="designer", ...)` | Visual work, Stitch UI, design systems |
| Bob | Manager | `task(subagent_type="manager", ...)` | Multi-wave plans, TODO orchestration |
| Manager | Coder | `task(category="deep", ...)` | Complex implementation |
| Manager | Researcher | `task(subagent_type="researcher", run_in_background=true, ...)` | Codebase search, docs |
| Manager | Vision | `task(subagent_type="vision", ...)` | Media extraction, UI verification |
| Manager | Writer | `task(subagent_type="writer", load_skills=["website-copywriting"], ...)` | Copy, content |

---

## Stewardship Responsibilities (Manager-owned)

Manager owns these stewardship responsibilities beyond worker pool coordination:

### MemPalace Memory Hygiene
- Search MemPalace BEFORE making decisions
- Write durable decisions, architectural choices, and session outcomes to MemPalace
- Never dump raw transcripts; write concise handoff ledgers

### TODO Hygiene
- Mark completed items `completed` immediately (not batched)
- Preserve unfinished tasks with blocker context and next action
- Remove duplicate stale TODOs

### Session Continuity
- Store `session_id` from every delegation
- Use `session_id` for retries and follow-ups
- Write handoff ledgers for complex multi-session work

### Post-Wave Verification
- Dispatch Quality Guardian after each wave completes
- Verify cross-task file conflicts via `git diff --name-only`
- Mark completed checkboxes in plan files

---

## Category-to-Agent Routing

Categories spawn agents with domain-specific configurations:

| Category | Spawns | Agent | Typical Use |
|----------|--------|-------|-------------|
| `deep` | SubAgent | Coder | Complex multi-file implementation |
| `ultrabrain` | SubAgent | Strategist | Architecture, hard logic planning |
| `quick` | SubAgent | Coder (fast contour) | Small targeted changes |
| `visual-engineering` | SubAgent | Designer | UI/layout/styling |
| `artistry` | SubAgent | Designer | Brand, creative, SEO |
| `writing` | SubAgent | Writer | Copy, content, documentation |
| `bounded` | SubAgent | Coder (fast contour) | Moderate bounded changes |
| `cross-module` | SubAgent | Coder | Multi-component changes |
| `unspecified-low` | SubAgent | Coder (fast contour) | Unclassified small tasks |
| `unspecified-high` | SubAgent | Coder | Unclassified substantial tasks |

---

## Verification Against Source

### Bob (src/agents/bob.ts)
- Bob delegates to: Strategist, Critic, Manager, Designer (line 145: `task(subagent_type='manager', ...)`)
- Bob does NOT implement directly; orchestrates only
- Intent gate classifies requests and routes to appropriate specialist

### Manager (src/agents/manager/*)
- Manager coordinates worker pool: Coder, Researcher, Vision, Writer
- Manager does NOT write code; only delegates
- Manager owns MemPalace stewardship, TODO tracking, session continuity

### Agent Roster in Manager (shared-prompt.ts lines 121-170)
- Lists all 11 agents with roles and routing patterns
- Worker pool agents clearly marked as Manager-coordinated
- Task routing decision table enforces specialist routing (not everything to Coder)

### Parallel Execution (default-prompt-sections.ts)
- Wave-based dispatch for multi-wave plans
- Sequential dispatch for single-task plans
- Routing table for task-type to specialist mapping

---

## File Reference

| File | Purpose |
|------|---------|
| `src/agents/bob.ts` | Bob's prompt and orchestration logic |
| `src/agents/manager/agent.ts` | Manager agent factory |
| `src/agents/manager/default.ts` | Manager's default prompt |
| `src/agents/manager/shared-prompt.ts` | Manager's delegation system, agent roster |
| `src/agents/manager/default-prompt-sections.ts` | Manager's workflow, parallel execution, boundaries |
| `src/agents/manager/guard-integration.ts` | Quality Guardian integration |
| `src/agents/manager/prompt-section-builder.ts` | Dynamic section builders |
| `src/agents/dynamic-agent-core-sections.ts` | Bob's delegation table, parallel section |
| `src/shared/closure-protocol.ts` | Closure protocol injection |
| `docs/architecture/bob-manager-architecture.md` | This document |

---

## Conclusion

The architecture is correctly implemented:

1. **Bob → [Strategist | Critic | Manager | Designer]** is the established delegation path
2. **Manager → [Coder | Researcher | Vision | Writer]** is the worker pool coordination path
3. Manager's stewardship (MemPalace, TODO hygiene, session continuity) is documented and enforced in prompts
4. No changes needed — source code matches the target architecture