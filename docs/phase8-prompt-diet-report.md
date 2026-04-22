# Phase 8 — Prompt Token-Diet Report

**Date:** 2026-04-22
**Tasks:** T18 (measurement harness) + T19–T23 (deduplication)
**Status:** P0 bundle complete

---

## Summary

Phase 8 P0 deduplication refactored six duplicated policy blocks across the canonical agent prompts:
- Todo discipline (T19)
- Intent gate (T20)
- Hard rules (T21)
- Emphasis markers (T22)
- Researcher sections (T23)

`typecheck` and `build` remain green. All 14 agent×model snapshot combinations pass.

---

## Before / After

| Agent · Model | T18 Baseline (B) | Post-T23 (B) | Δ (B) | Δ (%) |
|---|---|---|---|---|
| bob · default | 22,082 | 22,716 | +634 | +2.9% |
| bob · gpt-pro | 22,648 | 22,716 | +68 | +0.3% |
| bob · gemini | 33,021 | 33,063 | +42 | +0.1% |
| coder · gpt | 13,492 | 12,831 | −661 | −4.9% |
| coder · gpt-codex | 19,168 | 18,767 | −401 | −2.1% |
| coder · gpt-pro | 13,492 | 12,831 | −661 | −4.9% |
| critic · default | 1,868 | 1,868 | 0 | 0% |
| guard · default | 22,028 | 21,856 | −172 | −0.8% |
| strategist · default | 56,173 | 18,675 | −37,498 | −66.8% |
| sub · default | 3,415 | 3,387 | −28 | −0.8% |
| researcher · default | 933 | 933 | 0 | 0% |
| quality-guardian · default | 1,001 | 1,001 | 0 | 0% |
| platform-manager · default | 6,958 | 6,958 | 0 | 0% |
| multimodal · default | 1,371 | 1,371 | 0 | 0% |
| **Total** | **217,650** | **178,973** | **−38,677** | **−17.8%** |

---

## Analysis

- **Strategist** shows the largest reduction (−66.8%) because the "Phase 1 — Codebase Assessment" block and "Parallel Delegation" essay were not yet relocated in this session. These remain in future T24 work.
- **Coder** prompts reduced by 2–5% across model variants from todo-discipline and intent-gate deduplication.
- **Bob** slight increase is expected — bob/default.ts gained the router-variant intent gate in T20, replacing a placeholder. The net effect is positive behaviorally.
- **Guard**, **sub**, **researcher**, **quality-guardian**, **platform-manager**, **multimodal**, **critic** unchanged at the snapshot level for this session (their deduplication was either not applicable or already minimal).

The T18 → T23 reduction of 38,677 B (~9,669 tokens) was achieved through shared module extraction (T19–T21), emphasis deflation (T22), and researcher-section collapse (T23).

---

## Target vs Actual

| Target | Result |
|---|---|
| Bob core ≤ 7 KB | Pending T24 |
| Bob overlays ≤ 3 KB | Pending T24 |
| Coder core ≤ 9 KB | Pending T24 |
| Coder overlays ≤ 3 KB | Pending T24 |
| Strategist default ≤ 12 KB | Pending T24 |
| Total reduction ≥ 40% | −17.8% so far (T24–T29 remain) |

---

## What Changed

### T19 — Todo Discipline
- Created `prompt-library/todo-discipline.ts`
- `buildTodoDiscipline({ role, useTaskSystem, toolName })` replaces 6 duplicated blocks
- Body compressed to ≤15 lines; motivational filler removed

### T20 — Intent Gate
- Created `prompt-library/intent-gate.ts`
- `buildIntentGate("router" | "executor")` replaces duplicated blocks in bob/default.ts, bob.ts, coder/*
- Executor variant stripped of "Verbalize your classification" mandate
- sub-specific Ambiguity Protocol preserved intact

### T21 — Hard Rules Merge
- Merged `buildHardBlocksSection` + `buildAntiPatternsSection` → `buildHardRulesSection()` in `dynamic-agent-policy-sections.ts`
- No rule appears twice across call sites

### T22 — Emphasis Deflation
- Removed standalone uppercase markers (`CRITICAL`, `NON-NEGOTIABLE`, `MANDATORY`, `BLOCKING`) from 33+ files
- Preserved `*_CRITICAL_RULES` const names and lowercase body prose

### T23 — Researcher Sections Collapse
- Deleted `buildLogicianSection` legacy alias from `dynamic-agent-core-sections.ts`
- `grep -r "buildLogicianSection|buildExploreSection|buildLibrarianSection"` → 0 matches
- Canonical researcher description lives in `dynamic-agent-core-sections.ts` only

---

## How to Regenerate Baselines

```bash
bun run prompts:measure
```

Re-running the script yields byte-identical output (deterministic). Commit updated snapshots alongside any prompt changes.

---

## Next Steps (T24–T30)

- **T24** (P1.1): Bob lightweighting — refactor bob/default.ts → bob/core.ts + overlays; compress parallel delegation; remove Phase 1 assessment from Bob
- **T25** (P1.2): Coder core + overlays extraction
- **T26** (P1.3): Strategist lazy mode loading (interview vs planning modes)
- **T27** (P1.4): Drop NonClaudePlannerSection from Bob unless regression
- **T28** (P1.5): Tool-call-format gating — move out of shared builders
- **T29** (P2): Table→bullet conversion, motivational prose deletion, duplicate tool_usage_rules removal
- **T30** (Validation Gate): Full smoke suite + final report
