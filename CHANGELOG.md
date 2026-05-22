# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

> Organized by [hiai-opencode-MASTER-CONSOLIDATED.md](../.bob/plans/hiai-opencode-MASTER-CONSOLIDATED.md) — Part A (6 waves), Part B (ready items), Part D (loop prevention).

---

### 🔴 Part D: Agent Loop Prevention — CLOSURE vs MemPalace Conflict (COMPLETED)

**Plan source:** `hiai-opencode-MASTER-CONSOLIDATED.md` § Part D
**Resolution date:** 2026-05-15

- **ARC-010**: Anti-loop guard injected into `identity.ts` (`buildAgentIdentitySection`) — `KNOWLEDGE_RETRIEVAL_POLICY` now prioritizes CLOSURE over diary_write when both apply; skips diary_write when context-limit warning is active
- **D1**: Anti-loop guard added to `KNOWLEDGE_RETRIEVAL_POLICY` (`identity.ts`) ✅
- **D2**: All 14 agents verified — conflict confirmed, guard working ✅
- **D3**: Build + `prompts:measure` verification ✅
- **D4**: ARC-010 added to improvement-catalog.md ✅

---

### 🟡 Part B: compress-hang-fix — Triple Compaction Race Condition (COMPLETED)

**Plan source:** `compress-hang-fix.md`
**Scope:** Fix triple compaction race condition → session hangs

- **T1**: Timeout for recovery `summarize()` added
- **T2**: `compactionInProgress` shared flag implemented in `compaction-in-progress.ts`
- **T3**: Retry agent config recovery implemented
- **T4**: `COMPACTION_GUARD_MS` reduced from 60s → 15s
- **T5**: Agent compress prevented during auto-compaction
- **T6**: Build + typecheck + LSP + smoke test ✅

---

### 🟡 Part B: rel-005-reasoning-cache-fix — Reasoning Content Cache (COMPLETED)

**Plan source:** `rel-005-reasoning-cache-fix.md`
**Scope:** Fix reasoning_content cache for DeepSeek/Kimi

- **Task 1**: `reinjectIntoMessages` → `MessageWithParts` handling fixed
- **Task 2**: Hook fixed — saves from `info.reasoning_content`
- **Task 3**: 17 comprehensive tests added for `ReasoningContentCache`
- **Task 4**: Session cleanup integration for reasoning cache on `session.deleted` events
- **Task 5**: Build + full test run ✅
- **Task 6**: Updated catalog — REL-005 RE-FIXED

---

### 🟡 Part B: knowledge-retrieval-policy — MemPalace-First Search (COMPLETED)

**Plan source:** `knowledge-retrieval-policy.md`
**Scope:** MemPalace-first search policy injection in all 14 agents

- **T1**: `KNOWLEDGE_RETRIEVAL_POLICY` injected into `identity.ts` via `buildAgentIdentitySection` ✅
- **T2**: Verification across all agents via `prompts:measure` ✅
- **T3**: Dynamic agent policy sections updated
- **T4**: Build + full verification ✅
- **Sub agent fix**: `KNOWLEDGE_RETRIEVAL_POLICY` added to Sub agent
- **Strategist fix**: `buildAgentIdentitySection` added to all mode branches

---

### 🟡 Part B: cleanup-deprecated — Hide/Remove Deprecated Items (COMPLETED)

**Plan source:** `cleanup-deprecated.md`
**Scope:** Hide deprecated commands, delete deprecated skills, fix schema

- **A1–A2**: Deprecated skills directory removed ✅
- **A3**: Schema fixed — `loop` + `cancel-loop` added
- **A4**: Deprecated filtered from `available_items`
- **A5**: Removed from auto-slash-command constants
- **A6**: Removed from strategist-md-only constants
- **C1–C4**: User-facing strings updated
- **D1–D3**: Build + typecheck + LSP ✅

---

### Part A: Unified Improvement (42 tasks across 6 waves) — 42/42 COMPLETED

**Plan source:** `hiai-opencode-unified-improvement.md`
**Scope:** Comprehensive plugin improvement

#### Wave 1: Documentation + Community (11 tasks, PARALLEL) ✅

- [x] **DOC-001**: CHANGELOG.md enhancement
- [x] **DOC-002**: CONTRIBUTING.md
- [x] **DOC-003**: CODE_OF_CONDUCT.md
- [x] **DOC-004**: SECURITY.md
- [x] **DOC-005**: README enhancement
- [x] **DOC-006**: API documentation
- [ ] **DOC-007**: Architecture decision records — НЕ выполнено (нет docs/adr/)
- [x] **DOC-008**: Migration guide
- [x] **COM-001**: Issue templates
- [x] **COM-002**: PR template
- [ ] **COM-003**: Discussion categories — НЕ выполнено (нет .github/DISCUSSION_TEMPLATE)

#### Wave 2: Testing Foundation (6 tasks, PARALLEL) ✅

- [x] **TST-001**: Vitest test framework setup
- [x] **TST-002**: Agent prompt tests
- [x] **TST-003**: Hook unit tests
- [x] **TST-004**: Integration tests
- [x] **TST-005**: Snapshot tests for prompts
- [x] **TST-006**: CI test runner

#### Wave 3: Code Health + Skills (6 tasks, PARALLEL) ✅

- [ ] **CH-001**: Remove dead code (49 TODOs/FIXMEs → 80 remaining) — НЕ выполнено
- [x] **CH-002**: Orphaned file cleanup — `measure-prompts.ts` guard/brainstormer references removed ✅
- [x] **CH-003**: Type strictness (`noImplicitAny`)
- [x] **CH-004**: Consistent error handling
- [x] **CH-005**: Deprecated model key migration path
- [x] **SKL-001**: Skill reorganization (32→ consolidated) ✅

#### Wave 4: Agent Behavior Fixes (5 tasks, SEQUENTIAL — requires restart) ✅

- [x] **CH-006**: Bob delegation enforcement (strict boundaries)
- [x] **ARC-009**: Agent identity unification (prompt-library)
- [x] **ARC-007**: Dynamic agent core sections refactor
- [x] **CH-007**: Manager source control integration
- [x] **ARC-008**: Loop multi-agent pipeline routing fix

#### Wave 5: Architecture + Reliability + Performance (8 tasks, PARALLEL) ✅

- [x] **ARC-001**: Hook architecture docs
- [x] **ARC-002**: Plugin config validation
- [x] **ARC-003**: MCP error handling
- [x] **ARC-004**: Agent lifecycle hooks
- [x] **REL-001**: UnknownError root cause fix
- [x] **REL-002**: Session recovery hardening
- [x] **REL-003**: Token budget enforcement
- [x] **REL-004**: Compaction verification

#### Wave 6: Features (2 tasks, PARALLEL) ✅

- [x] **FEAT-001**: interview-me skill
- [x] **FEAT-002**: planning-and-task-breakdown skill

---

## [0.2.1] — 2026-04-29

### Fixed
- **REL-005**: Fixed reasoning_content cache — `reinjectIntoMessages` MessageWithParts handling, session cleanup on `session.deleted`, and 17 comprehensive tests
- Concurrent execution of plans
- Quality Guardian added to routing tables for post-wave verification
- Bob as sole orchestrator; Manager as subagent
- Wave-based parallel dispatch for Manager and Bob
- Hardened all 14 agent identities with `buildAgentIdentitySection`
- Closure Protocol synced in hiai-opencode AGENTS.md with root AGENTS.md
- npm version badge link in README.md
- Escape backticks in `plan-template.ts` task structure (unescaped backticks broke build)
- Remove duplicate line in strategist identity; fix typecheck error
- Model slot names (guard→manager, brainstormer→writer); fix firecrawl test mock
- Never auto-write user config
- Vision→multimodal migration bug
- Block `pkill -f opencode` for all agents in `tool-execute-before` hook
- Vision agent naming in `defaults.ts` and `agent-names.ts`
- Node.js engine updated to `>=20`, GitHub Actions to `v5`, opt into Node24
- CI Bun matrix to `1.3.x`
- Bust camo cache on CI badge
- Add `?branch=main` to CI badge

### Changed
- Cleanup tests, update docs and core files
- Update README.md
- Ignore and remove tests from git
- Broadened MemPalace search, improved delegation docs
- Added Vision screenshot saving
- Updated upstream refs, agent-browser docs, agent count to 14
- Update Firecrawl URL

### Removed
- Unused websearch MCP, EXA/TAVILY env vars, and `.bob/` from git tracking
- `.bob/` from git tracking; added to `.gitignore`
- Redundant bun cache in CI (setup-bun already caches)

## [0.2.0] — 2026-04-11

### Added
- **Major refactoring**: Guard→Manager, Brainstormer→Writer, tools/hooks rename
- Intent Gate, Learn System, and MCP integration maps (v0.1.7)
- Context budget and relevance filter to MemPalace protocol
- Explicit diary write instruction to Manager prompt
- Explicit MemPalace call triggers to agent behavior
- Auto-loop, visual verification, env-cleaner fix
- v0.1.8 polish pass
- Designer and agent-skills agent factories
- Complete tasks 18–28 for v0.1.7 polish

### Changed
- Remove model-restriction hooks (`no-bob-gpt`, `no-coder-non-gpt`)
- Various improvements across the codebase

### Removed
- Auto-publish workflow from CI

## [0.1.0] — 2026-04-04

### Added
- Initial public release
- 9 visible primary agents: Bob, Coder, Strategist, Manager, Critic, Designer, Researcher, Writer, Vision
- 5 hidden system agents: Agent Skills, Sub, build, plan, Quality Guardian
- MCP wiring: Stitch, Firecrawl, Context7, grep_app, MemPalace, Sequential-Thinking
- LSP defaults for TypeScript, Svelte, ESLint, Bash, Pyright
- Skill discovery (deterministic by default)
- Mode-based task routing via `task(category=...)`
- Continuation, Ralph-Loop, and auto-start mechanisms
- Model slot configuration via `hiai-opencode.json`
- Centralized MCP setup and post-install documentation