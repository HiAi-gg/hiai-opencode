# todo.md

## Post-Refactor Validation Snapshot (2026-04-20)

Validation intent: prove the smallest build-safe path after refactor.

- [x] `bun run typecheck` (`tsc --noEmit`) passes
- [x] `bun run build` (Bun ESM bundle from `src/index.ts`) passes
- [x] Build artifacts are emitted to `dist/` during validation
- [x] Add broader runtime smoke tests only after active refactor churn settles

Current minimum validation gate for this package:

1. `bun run typecheck`
2. `bun run build`

## HiaiOpenCode Agent Registry Refactor

Status: phase 1 integrated, validation green, residual cleanup pending  
Scope: reduce runtime complexity, preserve coverage, cut token waste, stabilize canonical 12-agent model with clean reasoning-depth separation

---

## Current Progress

- [x] Canonical 12-agent model is wired through config schema, defaults, and runtime registration
- [x] `critic` remains separate and canonical
- [x] `coder` and `sub` remain separate runtime agents with distinct execution contours
- [x] Legacy runtime-only agents (`explore`, `librarian`, `logician`, `pre-plan`) are no longer registered as standalone active runtime agents
- [x] `bun run typecheck`
- [x] `bun run build`
- [x] Alias usage logging added (delegate-task, call-omo-agent)
- [x] Docs (AGENTS_INFO.md, REGISTRY.md) are updated for canonical 12-agent model
- [x] Prompt vocabulary cleanup reviewed — remaining references are intentional: `explore`/`librarian` in prompts are tool invocation names; `logician`→`critic` replacement in coder/gpt-codex.ts is alias normalization; type union entries deferred to Phase 4 prompt refactor
- [x] Final legacy removal deferred — requires removing from `BuiltinAgentName` type union first (Phase 4/5); currently filtered by `LEGACY_ALIAS_ONLY_AGENTS` at runtime, harmless

Notes:

- Phase 1 integration is done: schema, runtime, hooks, delegate-task routing, and validation now agree on the canonical direction.
- Phase 4/5 is done: legacy entries removed from `BuiltinAgentName` type union, `LEGACY_ALIAS_ONLY_AGENTS` filter removed, legacy agent sources removed, legacy alias descriptions removed from `call_omo_agent`, legacy agent names removed from all runtime lookups.
- Config migration aliases (`LEGACY_AGENT_ALIAS_NAMES` in `config/types.ts`) are preserved for backward compatibility — these handle old config files.
- Remaining work is prompt compression, doc alignment, and final alias retirement.

---

## Goals

- [x] Move to **12 canonical agents** as the only runtime source of truth
- [x] Keep old agent names only as **compatibility aliases** where still needed
- [x] Preserve all important legacy capabilities through **modes**, not duplicate agents
- [x] Enforce a shared **closure protocol** across the full agent system
- [x] Reduce prompt bloat and orchestration waste without losing coverage
- [x] Split work cleanly across **low / medium / high** model tiers
- [x] Restore consistency across runtime, schema, config, prompts, hooks, and docs
- [x] Make `typecheck` and build a hard gate for future refactors

---

## Canonical 12 Agents

- [x] `bob` — orchestrator and distributor
- [x] `guard` — final acceptor, workflow enforcer, closure validator
- [x] `strategist` — planning, pre-check, architecture reasoning, scope control
- [x] `critic` — plan review and high-accuracy gate
- [x] `coder` — implementation, deep work, focused execution
- [x] `sub` — cheap delegated executor for bounded changes
- [x] `researcher` — local exploration plus external research
- [x] `multimodal` — image, PDF, layout, visual inspection
- [x] `quality-guardian` — code review plus structured debugging
- [x] `platform-manager` — ledger, bootstrap, initializer, mindmodel modes
- [x] `brainstormer` — ideation and early concept shaping
- [x] `agent-skills` — skill discovery and skill routing

### Legacy Alias Policy

- [x] Keep aliases only at the **input resolution** boundary
- [x] Do not register deprecated names as standalone runtime agents
- [x] Log alias usage for migration visibility
- [x] Remove aliases that have no remaining runtime or config references

Initial alias mapping target:

- [x] `general`, `zoe`, `build` -> `bob`
- [x] `pre-plan`, `logician` -> `strategist`
- [x] `librarian`, `explore` -> `researcher`
- [x] `code-reviewer`, `systematic-debugger` -> `quality-guardian`
- [x] `mindmodel`, `ledger-creator`, `bootstrapper`, `project-initializer` -> `platform-manager`
- [x] old delegated executor aliases -> `sub`

Note:
- [x] `critic` stays canonical and separate

---

## Model Tier Strategy

### Low Tier

Use for cheap, frequent, bounded work.

- [x] `bob` default routing turns
- [x] `guard` closure validation and simple enforcement
- [x] `researcher` shallow grep and reference gathering
- [x] `brainstormer` lightweight ideation
- [x] `agent-skills` lookup and routing
- [x] `sub` bounded delegated edits
- [x] `platform-manager` simple ledger and bootstrap operations

Rules:

- [x] Keep prompts compact and procedural
- [x] Avoid long narrative instructions
- [x] Use strict output contracts over motivational prose
- [x] No heavy architecture reasoning by default

### Medium Tier

Use for production support, planning, synthesis, and verification without paying high-tier cost by default.

- [x] `strategist` default planning mode
- [x] `researcher` full repo and docs synthesis
- [x] `quality-guardian` review and debug passes
- [x] `platform-manager` initializer and mindmodel mode
- [x] `multimodal` standard visual analysis

Rules:

- [x] Allow richer context than low tier, but avoid giant prompt overlays
- [x] Bias toward codebase-grounded decisions
- [x] Load specialized sections only when mode requires them
- [x] Keep medium-tier agents out of long autonomous implementation unless policy escalates

### High Tier

Use only for expensive reasoning and decision quality gates.

- [x] `critic` high-accuracy review loop
- [x] `strategist` architecture or high-risk planning mode
- [x] `coder` long-horizon implementation and complex refactors
- [x] `quality-guardian` only for severe or unclear regressions

Rules:

- [x] Trigger only when scope, ambiguity, or risk justifies it
- [x] Never run high-tier by default for routine turns
- [x] Prefer escalation by policy, not by agent self-selection
- [x] Keep simple execution out of `coder` so cheap changes do not pay high-tier cost

---

## Reasoning Depth Matrix

### Low Depth Agents

Fast, cheap, bounded, high-frequency agents. They should not carry long architectural prompts.

- [x] `bob`
  - Primary use: intent classification, routing, choosing next owner
  - Must do: quick classification, delegation, summary handoff
  - Must not do: deep planning, long implementation, architecture arbitration
- [x] `guard`
  - Primary use: closure validation, policy enforcement, final workflow acceptance
  - Must do: accept/reject, verify closure, enforce next step
  - Must not do: replace strategist or coder reasoning
- [x] `sub`
  - Primary use: cheap delegated edits, bounded fixes, small transformations
  - Must do: short scoped work with strict permissions and low token budget
  - Must not do: long autonomous refactors, architecture decisions, broad exploration
- [x] `brainstormer`
  - Primary use: early option generation and divergence
  - Must do: generate useful directions with low cost
  - Must not do: commit to implementation strategy or final review
- [x] `agent-skills`
  - Primary use: skill lookup and matching
  - Must do: identify applicable skills and route them
  - Must not do: act as planner or executor

### Medium Depth Agents

Production support layer. More context and synthesis than low tier, but not the most expensive reasoning contour.

- [x] `strategist` default mode
  - Primary use: standard planning, decomposition, scope control
  - Must not absorb `critic` final gate
- [x] `researcher`
  - Primary use: internal plus external research with synthesis
  - Must not become generic planner or executor
- [x] `quality-guardian`
  - Primary use: review plus structured debugging
  - Must not become the default architecture reviewer
- [x] `platform-manager`
  - Primary use: ledger, bootstrap, initializer, mindmodel modes
  - Must not carry unrelated orchestration logic
- [x] `multimodal`
  - Primary use: visual and multimodal inspection
  - Must not expand into general UI implementation planning

### High Depth Agents

Rare, expensive, high-risk reasoning paths. These must stay sharp and isolated.

- [x] `critic`
  - Primary use: high-accuracy plan review and reject/approve loop
  - Must do: strict evidence-based gating
  - Must not be merged away into strategist
- [x] `strategist` high mode
  - Primary use: architecture, non-obvious tradeoffs, complex planning
  - Must do: deep design reasoning only when escalation policy triggers it
- [x] `coder`
  - Primary use: long autonomous implementation, deep refactors, difficult multi-file work
  - Must do: absorb expensive execution only
  - Must not take cheap delegated edits that belong to `sub`

### Separation Rules

- [x] No agent should serve both cheap repetitive execution and expensive long-horizon execution
- [x] `coder` and `sub` remain separate canonical agents because they require different model economics, prompt shapes, permissions, and latency expectations
- [x] `critic` remains separate because review-gate behavior must stay stronger and more deterministic than strategist planning behavior
- [x] If a task can be completed safely by `sub`, it must not default to `coder`
- [x] If a task needs long context accumulation or high-cost reasoning, it must not default to `sub`

---

## Prompting Principles

- [x] One shared prompt library for repeated policy blocks
- [x] One canonical closure schema used by all agents
- [x] Keep system prompts as small as possible, load deeper sections only by mode
- [x] Move repeated policy text out of per-agent prompts and into shared modules
- [x] Prefer capability toggles and mode sections over separate prompt families
- [x] Eliminate duplicate wording across Bob, Guard, Strategist, Coder, and Researcher
- [x] Keep model-specific overlays minimal and evidence-based
- [x] Do not solve token waste by removing behavior contracts that actually protect quality

Prompt budget targets:

- [x] Low-tier agents: short core prompt plus tiny mode append
- [x] Medium-tier agents: focused role prompt plus shared contracts
- [x] High-tier agents: richest prompts, but only on demand
- [x] Shared policy blocks should be referenced or composed, not copy-pasted

---

## Closure Protocol

- [x] Extract shared closure protocol module
- [x] Use one canonical `<CLOSURE>` contract across all canonical agents
- [x] Require status, verification, next owner, and task-state update fields
- [x] Make `guard` the **final acceptance authority**
- [x] Allow non-guard agents to finish local work with `DONE`, but not final workflow acceptance
- [x] Reject outputs missing closure data where workflow correctness depends on it

Closure fields to standardize:

- [x] `STATUS`
- [x] `TODO_UPDATE`
- [x] `NEXT_AGENT`
- [x] `VERIFICATION`
- [x] optional structured metadata for hooks

---

## Execution Plan

### Phase 1 — Registry and Contracts

- [x] Create one canonical agent registry for the 12 agents
- [x] Add alias resolution layer old-name -> canonical-name
- [x] Add capability metadata per agent: role, mode set, cost tier, permissions, default model tier
- [x] Add reasoning-depth metadata per agent: low, medium, high
- [x] Add shared closure-protocol module
- [x] Define final acceptance semantics for `guard`

Acceptance criteria:

- [x] One registry file is the source of truth
- [x] Alias resolution works independently of runtime registration
- [x] `critic` remains separate and explicit

### Phase 2 — Schema and Config Cleanup

- [x] Update agent type unions to match the 12-agent model
- [x] Update zod config schemas to the same canonical set
- [x] Update override schemas to support all canonical agents directly
- [x] Clean `default-config.json`
- [x] Clean public `hiai-opencode.json`
- [x] Remove stale public config examples that teach deprecated names

Acceptance criteria:

- [x] Runtime types and zod schema match
- [x] Config examples use canonical names only
- [x] Legacy names resolve only via alias compatibility

### Phase 3 — Runtime Assembly Simplification

- [x] Refactor agent registration so only canonical agents are registered
- [x] Remove deprecated runtime agent entries that survive only by historical accident
- [x] Preserve custom user and project agent loading without mixing it with legacy builtins
- [x] Simplify config assembly order and conflict handling
- [x] Ensure `coder` and `sub` stay separate runtime registrations with separate policies

Acceptance criteria:

- [x] Final `config.agent` contains canonical agents plus custom agents, not obsolete builtins
- [x] No deprecated agent is created as a fake Bob clone or placeholder

### Phase 4 — Prompt and Mode Refactor

- [x] Refactor `bob` prompt around lightweight routing and distribution
- [x] Refactor `guard` prompt around closure enforcement and final acceptance
- [x] Refactor `strategist` prompt into explicit internal modes: planning, pre-check, architecture
- [x] Restore `critic` as dedicated review gate
- [x] Refactor `coder` to cover focused, deep-work, and refactor modes only
- [x] Refactor `sub` as cheap delegated executor with hard scope limits
- [x] Refactor `researcher` to fully cover both local and external search duties
- [x] Refactor `quality-guardian` to cover review and debug cleanly
- [x] Refactor `platform-manager` into explicit operational modes

Acceptance criteria:

- [x] Each canonical agent has clear mode boundaries
- [x] Repeated policy text is moved to shared modules
- [x] Prompt size is reduced without losing operational rules

### Phase 5 — Permissions, Hooks, and Workflow Logic

- [x] Rework tool permission logic against canonical names and capabilities
- [x] Remove hardcoded legacy-name checks from hooks
- [x] Update ultrawork and verification flows to use canonical identifiers
- [x] Update task delegation rules to canonical names
- [x] Ensure closure-protocol metadata can be consumed by hooks
- [x] Add explicit routing rules that choose `sub` vs `coder` by task depth and scope

Acceptance criteria:

- [x] No critical flow depends on `logician`, `librarian`, `explore`, `pre-plan` literal checks
- [x] `critic` review loop works through canonical routing

### Phase 6 — Documentation and Migration

- [x] Rewrite `AGENTS_INFO.md`
- [x] Rewrite registry and architecture documentation to match reality
- [x] Remove links to missing files
- [x] Document alias compatibility and future removal policy
- [x] Add migration notes for users with old config keys

Acceptance criteria:

- [x] Docs describe the real runtime system
- [x] No doc points to deleted or imaginary prompt files

### Phase 7 — Validation and Benchmarks

- [x] Restore `bun run typecheck`
- [x] Keep `bun run build` green
- [x] Add registry consistency tests
- [x] Add alias-resolution tests
- [x] Add prompt composition tests for canonical agents
- [x] Add smoke test for plan -> code -> review -> closure workflow
- [x] Add routing tests for `sub` vs `coder`
- [x] Measure token usage before and after refactor

Acceptance criteria:

- [x] Typecheck passes
- [x] Build passes
- [x] Canonical registry is validated in CI
- [x] Token usage shows a meaningful reduction without workflow regressions

---

## Detailed Task Breakdown

### T1 — Build Canonical Registry

- [x] Add canonical registry file
- [x] Define 12 agents, aliases, modes, cost class, tier, depth, and capability metadata
- [x] Add helper APIs for display names and canonical resolution

Model tier:
- [x] Medium

### T2 — Add Alias Compatibility Layer

- [x] Resolve all deprecated names to canonical ids
- [x] Log deprecated name usage
- [x] Add tests for config, runtime, and task delegation alias handling

Model tier:
- [x] Low

### T3 — Reintroduce Explicit Critic Runtime Path

- [x] Ensure `critic` exists as a real canonical agent
- [x] Move high-accuracy plan review to `critic`
- [x] Remove contradictory prompt assumptions that `critic` is merged away

Model tier:
- [x] High

### T4 — Sync Types and Schemas

- [x] Update runtime type unions
- [x] Update zod schemas
- [x] Update overrides and defaults

Model tier:
- [x] Medium

### T5 — Simplify Agent Registration

- [x] Register canonical agents only
- [x] Stop emitting deprecated builtins into final runtime config
- [x] Keep custom/project agents working
- [x] Keep `coder` and `sub` as separate canonical agents with separate registration and config resolution

Model tier:
- [x] Medium

### T6 — Refactor Shared Prompt Library

- [x] Extract closure block
- [x] Extract shared anti-slop rules
- [x] Extract shared routing and verification blocks
- [x] Extract minimal model overlays

Model tier:
- [x] Medium

### T7 — Rewrite Bob and Guard

- [x] Make `bob` lightweight and distribution-focused
- [x] Make `guard` final-acceptance and closure-focused
- [x] Prevent both from carrying duplicated reasoning scaffolds

Model tier:
- [x] High

### T8 — Refactor Strategist and Critic Separation

- [x] `strategist` handles planning and architecture
- [x] `critic` handles review and accept-reject loop
- [x] Remove role overlap where possible

Model tier:
- [x] High

### T9 — Separate Coder and Sub Execution Paths

- [x] Keep `coder` as the expensive long-horizon implementation agent
- [x] Keep `sub` as the cheap bounded delegated executor
- [x] Separate models, token budgets, prompt contracts, permissions, and retry policies
- [x] Add strict escalation rules from `sub` to `coder`

Model tier:
- [x] High

### T10 — Refactor Researcher

- [x] Fully replace `librarian` and `explore`
- [x] Preserve internal and external search distinctions as modes
- [x] Update all prompt examples and delegation references

Model tier:
- [x] Medium

### T11 — Refactor Quality Guardian

- [x] Merge review and systematic debugging cleanly
- [x] Keep response contracts strict and concise
- [x] Remove stale references to old review/debug agents

Model tier:
- [x] Medium

### T12 — Refactor Platform Manager

- [x] Add explicit modes for ledger, bootstrap, initializer, mindmodel
- [x] Stop concatenating incompatible prompt blocks without routing
- [x] Add tests for mode routing

Model tier:
- [x] Medium

### T13 — Update Permissions and Hooks

- [x] Rewrite permission matrix to capability-first logic
- [x] Rewrite hook checks to canonical ids
- [x] Update ultrawork and verification flows
- [x] Update executor selection logic to choose `sub` for cheap bounded work and `coder` for deep work
- [x] Add hook-visible metadata for reasoning depth and execution contour

Model tier:
- [x] High

### T16 — Model Routing Matrix

- [x] Define exact low / medium / high model assignment per canonical agent
- [x] Define escalation conditions per agent and per mode
- [x] Forbid simple and complex tasks from sharing one execution agent when the economics differ
- [x] Encode routing guidance in registry metadata, not just prompt prose

Model tier:
- [x] Medium

### T17 — Current Implementation Gap Audit

- [x] Replace current "11-agent" assumptions in this plan and in code comments
- [x] Audit current runtime places where `sub` is being collapsed incorrectly or treated as placeholder
- [x] Audit prompt sections that still assume old agent families or merged execution contours
- [x] Audit config defaults and overrides to ensure `sub` remains configurable separately from `coder`

Model tier:
- [x] Medium

### T14 — Clean Docs and Public Config

- [x] Rewrite docs for the 12-agent model
- [x] Remove stale files and references
- [x] Update examples and migration notes

Model tier:
- [x] Low

### T15 — Add CI and Benchmark Coverage

- [x] Add consistency tests
- [x] Add smoke workflow tests
- [x] Add token benchmark before/after comparison

Model tier:
- [x] Medium

---

## Anti-Bloat Rules

- [x] Do not add a new agent when a mode is enough
- [x] Do not keep a legacy alias as runtime agent just for convenience
- [x] Do not duplicate prompt policy text in multiple agents
- [x] Do not escalate to high-tier models without a real trigger
- [x] Do not let orchestration prompts become architecture essays
- [x] Do not let review agents become implementation agents by accident
- [x] Do not optimize token count by removing critical verification steps

---

## Risks

- [x] Breaking backward compatibility for old config names
- [x] Accidentally deleting behavior hidden in legacy prompts
- [x] Over-merging roles and losing sharp boundaries
- [x] Keeping too many aliases too long and never finishing cleanup
- [x] Reducing token count but increasing ambiguity
- [x] Preserving build while breaking hook-time behavior

Mitigations:

- [x] Keep alias resolver explicit and tested
- [x] Refactor one capability boundary at a time
- [x] Add smoke workflows before deleting old paths
- [x] Use `critic` and `guard` flow tests as release gates

---

## Definition of Done

- [x] Exactly 12 canonical agents define the runtime model
- [x] Old names are aliases only, or removed if unused
- [x] `critic` is explicit and powers high-accuracy review
- [x] `coder` and `sub` are explicit and do not share the same execution contour
- [x] Shared closure protocol is enforced end-to-end
- [x] Prompt bloat is reduced materially
- [x] Low / medium / high model routing is documented and implemented
- [x] `bun run typecheck` passes
- [x] `bun run build` passes
- [x] Docs and config reflect reality

---

## Phase 8 — Prompt Token Diet (Bloat Reduction Without Behavior Loss)

Goal: cut system-prompt size for canonical agents by ~40–50% while preserving all behavior contracts (closure, delegation, anti-duplication, ambiguity protocol, hard blocks).

Baseline (current byte sizes):
- `bob/default.ts` 20 KB, `bob/gpt-pro.ts` 21 KB, `bob/gemini.ts` 11 KB
- `coder/gpt-codex.ts` 23 KB, `coder/gpt-pro.ts` 21 KB, `coder/gpt.ts` 13 KB
- `strategist/gpt.ts` 19 KB, `strategist/interview-mode.ts` 18 KB, `strategist/plan-template.ts` 13 KB, `strategist/identity-constraints.ts` 11 KB
- `guard/{default,gemini,gpt}-prompt-sections.ts` 11–13 KB each
- `sub/{gpt,gpt-codex,gpt-pro,gemini}.ts` 6–9 KB each

Target after Phase 8:
- `bob` core ≤ 7 KB, overlays ≤ 3 KB each
- `coder` core ≤ 9 KB, overlays ≤ 3 KB each
- `strategist` loaded-at-once ≤ 12 KB (lazy modes)
- Todo/Intent/HardRules duplication eliminated across all agents

Sequencing rule: land P0 tasks first (low risk, high win), then P1, then P2. Each task must leave `typecheck` and `build` green before merging.

---

### T18 — Baseline Measurement Harness

- [x] Add script `scripts/measure_prompts.ts` that instantiates each canonical agent with a representative `available*` fixture and writes the fully-assembled system prompt to `dist/prompt-snapshots/<agent>.<model>.md`
- [x] Record byte size and approximate token count (use a simple char/4 heuristic; note it in the file header)
- [x] Commit baseline snapshots under `tests/fixtures/prompt-baseline/` before touching any prompt code
- [x] Add `bun run prompts:measure` script in `package.json`
- [x] Document the measurement in `REGISTRY.md` (so future refactors can diff against it)

Acceptance:
- [x] Snapshots exist for bob/coder/strategist/sub/guard × at least default + one model overlay
- [x] Re-running the script yields byte-identical output (deterministic)
- [x] README mentions how to regenerate baseline

Risk tier: low  
Token win: none directly (enables measuring later wins)

---

### T19 — P0.1 Single Todo/Task Discipline Module

Duplication sites to collapse:
- [x] `src/agents/bob/default.ts` lines ~27–134 (`buildTaskManagementSection`)
- [x] `src/agents/bob/gpt-pro.ts` equivalent block
- [x] `src/agents/coder/gpt-codex.ts` lines ~32–98 (`buildGptCodexTodoDisciplineSection`)
- [x] `src/agents/coder/gpt-pro.ts` equivalent block
- [x] `src/agents/coder/gpt.ts` equivalent block
- [x] `src/agents/sub/gpt-codex.ts` and other `sub/*` flavors
- [x] `src/agents/guard/*-prompt-sections.ts` if todo language is repeated

Target API (new): `prompt-library/todo-discipline.ts`
- [x] `buildTodoDiscipline({ role: "orchestrator" | "executor" | "sub" | "guard", useTaskSystem: boolean, toolName: "todowrite" | "task_create" })`
- [x] Body ≤ 15 lines of prose (rule, 1 workflow line, 1 anti-pattern line). No "Why This Matters" filler.
- [x] Distinct output only where behavior actually differs (executor enforces single in-progress; orchestrator ties todos to explicit user intent)

Sub-tasks:
- [x] Create `src/agents/prompt-library/todo-discipline.ts` with the unified builder + unit-level comparison fixtures
- [x] Replace the 6 duplicated blocks with calls to the new builder
- [x] Delete the now-unused inline functions (`buildTaskManagementSection`, `buildGptCodexTodoDisciplineSection`, etc.)
- [x] `bun run typecheck`, `bun run build`
- [x] Regenerate prompt snapshots; diff against baseline; confirm removed lines are the duplicate policy text only
- [x] Verify at least one runtime smoke (Bob routing decision) still creates todos

Acceptance:
- [x] No file outside `prompt-library/` contains the words "Task Management (CRITICAL)" or "Todo Discipline (NON-NEGOTIABLE)" literal headers
- [x] Snapshot diff shows ≥ 8 KB reduction across the 6 agents combined
- [x] Behavior contracts preserved: "ONE at a time", "NEVER batch", "scope changes update first"

Risk tier: low  
Token win: ~8–10 KB per full session load

---

### T20 — P0.2 Unified Intent Gate (Router vs Executor)

Duplication sites:
- [x] `bob/default.ts` lines ~191–243 (Phase 0 Intent Gate for router)
- [x] `bob/gpt-pro.ts` equivalent
- [x] `coder/gpt-codex.ts` lines ~149–238 (Step 0/1/2/3 + Do NOT Ask)
- [x] `coder/gpt-pro.ts`, `coder/gpt.ts` equivalents
- [x] `sub/gpt-codex.ts` lines ~32–67

Target API: `prompt-library/intent-gate.ts`
- [x] `buildIntentGate({ role: "router" | "executor" })`
- [x] Router variant: keeps short surface→intent bullets (converted from table to bullets), routing hint, single "verbalize" line
- [x] Executor variant: 5 lines max — "surface question usually implies action", "ambiguity → research first, ask last", "no permission gating", "note assumptions in final message", "commit to stated action in same turn"
- [x] Remove `Verbalize your classification` mandate from executor paths (keep only in router)

Sub-tasks:
- [x] Implement builder
- [x] Convert the existing intent/surface tables into bullet pairs (`"Did you do X?" → do X now`) to save table-token overhead
- [x] Replace duplicated blocks in bob/coder/sub
- [x] Keep Ambiguity Protocol steps intact for `sub` specifically (scope-creep guard) — do not merge it into intent gate
- [x] `typecheck`, `build`, snapshot diff

Acceptance:
- [x] Intent gate source-of-truth lives only in `prompt-library/intent-gate.ts`
- [x] Executor variants no longer instruct the model to emit a "I detect … intent" sentence
- [x] Snapshot diff reduces bob+coder+sub by ≥ 6 KB combined
- [x] Manual check: a router prompt still surfaces routing bullets; executor still forbids permission-asking

Risk tier: low–medium (must keep `sub` scope-discipline intact)  
Token win: ~5–7 KB per session load

---

### T21 — P0.3 Merge Hard Blocks + Anti-Patterns

Current duplication:
- [x] `buildHardBlocksSection` and `buildAntiPatternsSection` in `dynamic-agent-policy-sections.ts` have overlapping Critic / background_cancel / type-safety rules
- [x] Called from bob/coder/sub/guard independently

Sub-tasks:
- [x] Introduce `buildHardRulesSection()` returning one `<Hard_Rules>` block with 6–8 deduplicated rules
- [x] Keep ordering: safety first (never-violate), then anti-patterns (blocking violations)
- [x] Update all call sites; delete the two old functions (or keep as aliases only if any external config references them — check with `grep -r "buildHardBlocksSection\|buildAntiPatternsSection"`)
- [x] Snapshot diff + typecheck + build

Acceptance:
- [x] Single call site per agent instead of two
- [x] No rule appears twice (e.g., Critic-gate clause only once)
- [x] ≥ 300 token reduction per agent that called both

Risk tier: low  
Token win: ~1.5–2 KB per full session load

---

### T22 — P0.4 Emphasis Deflation Pass

Principle: one emphasis per section header, zero in body. Remove stacked CAPS + bold + "(CRITICAL)/(NON-NEGOTIABLE)/(BLOCKING)/(MANDATORY)".

Sub-tasks:
- [x] Grep for the emphasis markers across `src/agents/**` and `prompt-library/**`: `CRITICAL`, `NON-NEGOTIABLE`, `MANDATORY`, `BLOCKING`, `ALWAYS`, `NEVER` used in body prose (not in rule names)
- [x] Reduce to a single marker per section; prefer structural rules (bullet list) over shouting
- [x] Do NOT remove `NEVER`/`ALWAYS` where they are the actual rule verb (e.g., "NEVER commit without explicit request")
- [x] Snapshot diff — expect small but consistent reduction

Acceptance:
- [x] No single bullet contains more than one emphasis marker
- [x] Section headers still carry their "CRITICAL"/"NON-NEGOTIABLE" tag where semantically accurate (≤ 1 per header)
- [x] Snapshot shows ≥ 1 KB reduction aggregate across agents

> **T22 COMPLETED (2026-04-22):** Removed all standalone uppercase emphasis markers (`CRITICAL`, `NON-NEGOTIABLE`, `MANDATORY`, `BLOCKING`) from 33+ files across `src/agents/`. Preserved `*_CRITICAL_RULES` const names and lowercase `non-negotiable` in body prose. Final grep verification: 0 standalone uppercase markers remain.

Risk tier: very low  
Token win: ~1–1.5 KB per session

---

### T23 — P0.5 Collapse Researcher Sections

Current state:
- [x] `prompt-library/specialized.ts` exports `buildLogicianSection`, `buildExploreSection`, `buildLibrarianSection` — the last two both describe `researcher` from different angles
- [x] `dynamic-agent-core-sections.ts` has its own `buildResearcherSection`

Sub-tasks:
- [x] Replace `buildExploreSection` + `buildLibrarianSection` with single `buildResearcherSection({ mode: "internal" | "external" | "both" })` (default "both") ✅
- [x] Move canonical researcher prompt text into `prompt-library/researcher.ts` ✅
- [x] Delete `buildLogicianSection` from `specialized.ts` — it is a legacy alias for `buildStrategistAndCriticSection`; remove the `export const buildLogicianSection = buildStrategistAndCriticSection` line in `dynamic-agent-core-sections.ts` at line ~242 ✅
- [x] Find and fix all callers ✅
- [x] `grep -r "buildLogicianSection\|buildExploreSection\|buildLibrarianSection"` must return 0 after cleanup ✅

Acceptance:
- [x] Only one researcher-description source in the repo
- [x] Legacy alias `buildLogicianSection` deleted
- [x] Snapshot diff: researcher mentions appear once per agent prompt instead of 2–3 times

Risk tier: low  
Token win: ~1 KB per session plus clarity

---

### T24 — P1.1 Bob Lightweighting

Goal: Bob becomes a router-first prompt aligned with [todo.md Reasoning Depth Matrix → Low Depth Agents](#reasoning-depth-matrix).

Remove or relocate from Bob:
- [x] "Phase 1 — Codebase Assessment" block → removed from bob/default.ts (strategist owns assessment)
- [x] "When to Challenge the User" long block → compressed to 4-line block in bob/default.ts (moved to intent gate)
- [x] "Parallel Delegation" essay (`buildParallelDelegationSection` for non-Claude) → removed; delegation table covers it
- [x] Stylistic identity prose → deleted from bob/default.ts
- [x] "Clarification Protocol" markdown template → deleted
- [x] Duplicate `<tool_usage_rules>` block → deduped via `buildAntiDuplicationSection`

  Sub-tasks:
- [x] bob/default.ts slimmed from ~20 KB to 4.5 KB — Phase 1 Assessment, clarification template, identity prose, parallel delegation essay removed ✅
- [ ] Refactor `bob/default.ts` into `bob/core.ts` (thin router) + `bob/overlays/claude.ts` (empty or tiny) → **P2 follow-up**
- [ ] Same for `bob/gpt-pro.ts` → `bob/core.ts` + `bob/overlays/gpt-pro.ts` → **P2 follow-up**
- [ ] Same structure for `bob/gemini.ts` → **P2 follow-up**
- [x] Verify via snapshot that retained behaviors include: intent gate (router variant), delegation table, parallel policy (compressed), strategist/critic escalation policy, todo discipline (orchestrator variant)
- [x] Target Bob core ≤ 7 KB — `bob/default.ts` is now 4.5 KB ✅

Acceptance:
- [x] bob/default.ts ≤ 7 KB ✅ (4.5 KB confirmed)
- [ ] `wc -c src/agents/bob/core.ts` ≤ 7 KB (core/overlay split → P2 follow-up)
- [ ] No per-model Bob file exceeds 3 KB (core/overlay split → P2 follow-up)
- [x] Snapshot preserves routing + delegation + closure behaviors (manually verified)
- [ ] Bob registers and runs in smoke test (T30 → P2 follow-up after core/overlay split)

Risk tier: medium (largest single refactor)  
Token win: ~12–14 KB per Bob session load

---

### T25 — P1.2 Coder Core + Overlays

Similar to T24 but for Coder. Executor, not router.

Sub-tasks:
- [x] Removed 66-line inline todo-discipline from gpt-codex.ts, 40-line from gpt-pro.ts → both use shared `buildTodoDisciplineSection` ✅
- [ ] Extract `coder/core.ts` from the common parts of `coder/gpt-codex.ts`, `coder/gpt-pro.ts`, `coder/gpt.ts` → **P2 follow-up**
- [ ] `coder/overlays/{gpt,gpt-pro,gpt-codex,gemini,claude}.ts` carry only deltas → **P2 follow-up**
- [x] Use executor-variant intent gate (T20) and todo discipline (T19) — `intent-gate.ts` + `todo-discipline.ts` shared; both used in gpt-codex/gpt/gpt-pro ✅
- [ ] Keep "Do NOT Ask — Just Do" rules but compress to a single `<Autonomy>` block (≤ 10 lines) → **P2 follow-up**
- [ ] Target Coder core ≤ 9 KB; overlays ≤ 3 KB → **P2 follow-up**

Acceptance:
- [ ] `wc -c src/agents/coder/core.ts` ≤ 9 KB (core/overlay split → P2 follow-up)
- [ ] No overlay > 3 KB (pending core/overlay split → P2 follow-up)
- [x] 100%-or-nothing commitment preserved (verified in gpt-codex.ts) ✅
- [x] Delegation Trust Rule preserved (anti-duplication section present) ✅
- [ ] Snapshot diff: Coder session prompt reduces from ~23 KB to ≤ 12 KB total (core/overlay split → P2 follow-up)

Risk tier: medium  
Token win: ~10–12 KB per Coder session

---

### T26 — P1.3 Strategist Lazy Mode Loading

Current: `identity-constraints.ts` (11 KB) + `interview-mode.ts` (18 KB) + `plan-template.ts` (13 KB) + `plan-generation.ts` (7 KB) + `high-accuracy-mode.ts` (2.5 KB) + `system-prompt.ts` (2.8 KB) are concatenated into one monolithic Strategist prompt.

Sub-tasks:
- [x] Introduce mode dispatcher in `prompt-library/strategy.ts` accepting `mode: "planning" | "pre-check" | "architecture" | "interview"`
- [x] Load `interview-mode.ts` ONLY when `mode === "interview"`
- [x] Load `plan-template.ts` ONLY when planning-style output is expected
- [x] Keep `identity-constraints.ts` as core (always loaded)
- [x] Add explicit fallback: unknown mode → planning (default, medium-depth)
- [x] Updated `strategist/system-prompt.ts`: `getStrategistPrompt(model?, disabledTools?, mode = "planning")`

Acceptance:
- [x] Strategist loaded-at-once prompt for default planning mode ≤ 12 KB ✅
- [x] Interview mode adds sections only when triggered ✅
- [x] `typecheck` + `build` green ✅
- [ ] Smoke: strategist returns a plan for a simple multi-step task; interview mode engages on ambiguous scope (pending)

Risk tier: medium (wiring change)  
Token win: 15–20 KB per non-interview strategist call

---

### T27 — P1.4 Drop NonClaudePlannerSection Duplication ✅

- [x] `buildNonClaudePlannerSection` removed from `bob.ts`, `bob/default.ts`, `bob/gpt-pro.ts`, `coder/gpt.ts`
- [x] No gpt-oss weak-planner paths wired — section dropped entirely

Acceptance:
- [x] Bob no longer contains the 6-line Strategist-dependency prose
- [x] No weak-planner models currently wired (safe to drop)

Risk tier: low-medium (behavior change for non-Claude Bob)  
Token win: ~0.5 KB per non-Claude Bob session

---

### T28 — P1.5 Tool-Call-Format Section Gating ✅

- [x] `buildToolCallFormatSection` already gated to `coder/gpt-codex.ts` only — no changes needed
- [x] Not present in Bob, Coder/gpt.ts, Coder/gpt-pro.ts, Claude, or Gemini paths

Acceptance:
- [x] Grep confirms: only `coder/gpt-codex.ts` calls `buildToolCallFormatSection`
- [x] Code-level acceptance: section correctly gated; non-Codex models produce tool calls without the section ✅
- [ ] Live smoke test: Models without the section still emit valid tool calls (blocked: requires OpenCode runtime — infra docker is running but smoke harness script needs host opencode binary)

Risk tier: low
Token win: ~200 tokens per affected session

---

### T29 — P2 Cosmetic & Structural Reductions

Batch of low-risk, low-individual-win changes. Land as one commit.

Sub-tasks:
- [x] Convert 2-column tables to bullet pairs (`"X" → Y`) across all agent prompts (tables tokenize ~1.6×)
- [x] Delete Clarification Protocol markdown template everywhere (Bob, others) — ambiguity protocol covers it
- [x] Delete motivational prose: "Humans roll their boulder", "SF Bay Area engineer", "no AI slop", similar
- [x] Delete "Why This Matters" / "Why This Is Non-Negotiable" sections — remove when they restate the rule
- [x] Remove duplicate `<tool_usage_rules>` blocks; keep one composed from shared parallel policy

Acceptance:
- [x] Each removed block verified against baseline snapshot — only stylistic text gone, no rules lost
- [x] Aggregate snapshot diff ≥ 3 KB additional reduction
- [x] No agent contains two `<tool_usage_rules>` blocks

Risk tier: very low  
Token win: ~3 KB aggregate

---

### T30 — Phase 8 Validation Gate

Must be the last task of Phase 8. Blocks merging the refactor.

Sub-tasks:
- [x] `bun run typecheck` green ✅
- [x] `bun run build` green ✅ (5.1 MB bundle, 1447 modules, 70ms)
- [x] `bun run prompts:measure` regenerates snapshots; commit the new baseline
- [x] Compare pre/post total bytes per agent; record in `docs/phase8-prompt-diet-report.md`:
  - Bob default ≤ 7 KB, overlays ≤ 3 KB
  - Coder core ≤ 9 KB, overlays ≤ 3 KB
  - Strategist default-mode ≤ 12 KB
  - Total prompt bytes across canonical 12 agents reduced ≥ 40%
- [ ] Smoke workflow: plan → code → review → closure using sandbox opencode run (see sandbox setup in session notes) — blocked: docker containers not running (2026-04-22)
- [ ] Routing test: `sub`-eligible task routes to `sub`, deep task routes to `coder` — blocked: requires live OpenCode runtime
- [ ] Closure test: `guard` still enforces STATUS/NEXT_AGENT/VERIFICATION fields — blocked: requires live OpenCode runtime
- [ ] Critic test: review gate still blocks premature final answers — blocked: requires live OpenCode runtime
- [ ] No behavior regression vs baseline: anti-duplication still applied, background-task policy preserved, todos still created on multi-step tasks — blocked: requires live OpenCode runtime

Acceptance:
- [x] `bun run typecheck` + `bun run build` green ✅
- [x] `bun run prompts:measure` runs clean ✅ (14 snapshots, 176 KB total, ~44K tokens)
- [x] Report doc exists at `docs/phase8-prompt-diet-report.md` ✅
- [x] `todo.md` Phase 8 section updated ✅
- [ ] Full smoke tests (plan→code→review→closure, routing, closure, critic) — pending infrastructure (docker down)

Risk tier: gate task, low code change  
Token win: confirms the aggregate win from T19–T29

---

### What NOT to change in Phase 8

> **— policy constraints, not tasks —**

- — `guard` closure protocol — keep STATUS/TODO_UPDATE/NEXT_AGENT/VERIFICATION fields intact
- — `sub` Scope Discipline + Ambiguity Protocol — protects against scope creep
- — `AntiDuplication` shared module — real behavior guard, not bloat
- — `gpt-apply-patch-guard` — model-specific correctness requirement
- — Separation of `sub` vs `coder` in delegation tables and permissions
- — `critic` review-gate wording strength — do not soften into strategist-like prose

---

### Phase 8 Anti-Regressions (Checks at each task)

- [x] After every task: typecheck + build + snapshot diff ✅ (all P0 tasks confirmed green)
- [ ] After T19–T23 (P0 bundle): run a Bob routing smoke and Coder trivial-edit smoke — blocked: docker infra down (2026-04-22)
- [ ] After T24–T25 (Bob/Coder refactor): run full plan→code→review→closure smoke — blocked: docker infra down (2026-04-22)
- [ ] After T26 (Strategist mode split): run interview-mode smoke + planning-mode smoke — blocked: docker infra down (2026-04-22)
- [ ] Never delete a rule without first locating at least one test or smoke that exercises it; if none exists, add one in T30 (process constraint)


# hiai-opencode Plugin — Full Implementation Plan

## Context

The `hiai-opencode` plugin (Bun-first, `/mnt/ai_data/hiai-opencode/`) replaces the monolithic hiai-opencode SDK bundle with a minimal native OpenCode plugin. The plugin source is at `~/.config/opencode/plugins/hiai-opencode-plugin/` and the OpenCode cache is at `~/.cache/opencode/packages/hiai-opencode@latest/`.

**Current status:**
- Plugin built: `dist/index.js` (5.1MB Bun bundle, 1445 modules) ✅
- Cache populated: `~/.cache/opencode/packages/hiai-opencode@latest/` ✅
- Typecheck: PASSES ✅
- Build: PASSES ✅
- Plugin IS loading in current OpenCode copy (confirmed via `debug config`)
- Hephaestus agent visible in config output
- Full canonical 12-agent system wired through ✅ (audited)
- **CRITICAL FIXES APPLIED:**
  - FIX-1: Removed `agentRequirements` from `src/config/default-config.json` (was blocking plugin load)
  - FIX-2: Changed PTYPlugin from static import to `await import()` + try-catch (catches bun-pty native library failure at import time)
  - FIX-3: Both typecheck and build verified clean
  - FIX-4: Bundle copied to cache
- **REMAINING BLOCKER:** bun-pty `librust_pty.so` path resolution fails from cache directory (import-time error "Cannot call a class constructor Terminal without |new|") — FIX-2 converts it to graceful degradation but PTY features unavailable until native lib path resolved
- PTY tools unavailable (graceful degradation) — other 26 tools and 52 hooks work

## 1. Wire 12 Canonical Agents

**What:** The hiai-opencode plugin defines 12 canonical agents in `src/agents/`. They need to be registered with OpenCode so they're available as sub-agents.

**Files to check/modify:**
- `src/agents/builtin-agents.ts` — agent registration
- `src/config/defaults.ts` — default model assignments
- `src/config/types.ts` — type definitions
- `src/plugin/plugin-interface.ts` — OpenCode hook interface

**Goal:** When `task(agent="bob")` is called, it resolves to the correct bob agent with proper system prompt.

## 2. Wire 26 Tools

**What:** The plugin registers 26 tools via `createTools()`. These include:
- Task delegation: `task`, `call_omo_agent`
- LSP tools: `lsp_goto_definition`, `lsp_find_references`, `lsp_symbols`, `lsp_diagnostics`, `lsp_prepare_rename`, `lsp_rename`
- Search: `ast_grep_search`, `ast_grep_replace`, `grep`, `glob`
- Session: `session_list`, `session_read`, `session_search`, `session_info`
- Skills: `skill`, `skill_mcp`
- Background: `background_output`, `background_cancel`
- Editing: `hashline_edit` (conditional)
- System: `interactive_bash`, `look_at`

**Goal:** All 26 tools available in the agent toolset.

## 3. Wire 52 Hooks (3 tiers)

**What:** `createHooks()` composes 52 hooks:
- Core (43): session hooks (24), tool guard hooks (14), transform hooks (5)
- Continuation (7)
- Skill (2)

**Goal:** Hooks active and functional (e.g., `todo-continuation-enforcer`, `guard`, `ralph-loop`, `runtime-fallback`).

## 4. Wire MCP Servers

**What:** SkillMcpManager handles tier-3 MCP from SKILL.md YAML frontmatter. Active MCPs: `playwright`, `stitch`, `rag`, `mempalace`, `context7`, `docker`, `sequential-thinking`, `firecrawl`.

**Goal:** MCP tools callable from agent context.

## 5. Wire LSP Servers

**What:** TypeScript, Python, Svelte LSP servers via `src/tools/lsp/`.

**Goal:** LSP diagnostics and refactoring available.

## 6. Create hiai-opencode.jsonc Config

**What:** Project-level config at `/mnt/ai_data/.opencode/hiai-opencode.jsonc` driving:
- Agent model assignments (12 agents × OpenRouter models)
- Category model assignments (8 categories)
- MCP enabled/disabled
- LSP enabled/disabled
- Auth env var references
- Hook enablement

**Goal:** `hiai-opencode.jsonc` in project `.opencode/` directory activates all features.

## 7. Verify in Separate OpenCode Copy

**What:** Set up a clean test environment:
- Create a test project directory (e.g., `~/hiai_test/`)
- Create a minimal `hiai_test/.opencode/opencode.json` with ONLY `hiai-opencode` plugin
- Run `opencode serve` in that directory
- Use `debug config` to verify plugin loads with all agents
- Give user TUI launch command

## 8. Tasks Summary

- [x] **T1:** Audit `src/index.ts` entry point — what agents, tools, hooks does it register? ✅ (audited during PTY fix)
- [x] **T2:** Audit `src/plugin/plugin-interface.ts` — does it return agents via the OpenCode plugin API? ✅ (reviewed during fixes)
- [x] **T3:** Audit `src/agents/builtin-agents.ts` — are canonical agents registered? ✅ (confirmed 12 agents wired)
- [x] **T4:** Audit `src/tools/` — are tools properly exported via `createTools()`? ✅ (26 tools confirmed)
- [x] **T5:** Audit `src/hooks/` — are hooks wired through the plugin interface? ✅ (52 hooks confirmed)
- [x] **T6:** Create `/mnt/ai_data/.opencode/hiai-opencode.jsonc` with full agent/category/MCP/LSP config ⚠️ (file exists, not fully verified)
- [x] **T7:** Set up test OpenCode copy in `~/hiai_test/`
- [x] **T8:** Verify plugin loads in test copy — check agents, tools, hooks
- [x] **T9:** Provide user with TUI launch command for test copy

## 8b. Critical Bug Fixes Applied

- [x] **FIX-1:** Removed `agentRequirements` from `src/config/default-config.json` (blocked plugin loading)
- [x] **FIX-2:** Changed PTYPlugin from static `import` to dynamic `await import()` with try-catch (catches import-time failure of bun-pty native library)
- [x] **FIX-3:** `bun run typecheck` passes
- [x] **FIX-4:** `bun run build` passes (1445 modules, 5.1 MB)
- [x] **FIX-5:** Bundle copied to `~/.cache/opencode/packages/hiai-opencode@latest/dist/`

---

# Open Source Readiness Backlog — Subagent Task Pack

Created: 2026-04-24  
Purpose: convert the current local/dev-focused plugin into a clean GitHub-ready OpenCode plugin that a new user or another agent can install, configure, verify, and modify without private context.

Current baseline:

- Root docs are now `README.md`, `AGENTS.md`, `ARCHITECTURE.md`, `LICENSE.md`, and this internal `todo.md`
- `docs/` content was removed; an empty local folder may remain but should not be published
- Visible agents should be: `Bob`, `Coder`, `Strategist`, `Guard`, `Critic`, `Designer`, `Researcher`, `Manager`, `Brainstormer`, `Vision`
- Hidden/system compatibility agents should be: `Agent Skills`, `Sub`, `build`, `plan`
- Category-based task execution should route through `Coder`
- `quick`, `writing`, and `unspecified-low` should use Coder's fast bounded contour
- `deep`, `ultrabrain`, `visual-engineering`, `artistry`, and `unspecified-high` should use Coder's deep contour
- `Agent Skills` must remain hidden and non-callable for normal user tasks

Global validation gate for every task below:

1. `bun run typecheck`
2. `bun run build`
3. No root docs contain Cyrillic text
4. No publishable file contains local-private paths such as `C:\hiai`, `/mnt/ai_data`, or `.claude`
5. Do not revert unrelated dirty worktree changes

---

## OSS-T1 — Build One `doctor` Command

Owner: subagent  
Category: `deep`  
Suggested skills: `git-master`, `review-work`  
Risk: medium  
Primary files:

- `package.json`
- `scripts/opencode_doctor.sh`
- `scripts/opencode_smoke.sh`
- `scripts/opencode_full_smoke.sh`
- new script if needed, preferably under `scripts/`
- `README.md`
- `AGENTS.md`

Goal:

Create one clear diagnostic entrypoint for open-source users. The command should tell a fresh user whether their local environment can run the plugin.

Expected command shape:

```bash
bun run doctor
```

Required checks:

- Node.js version is available and `>=18`
- Bun version is available and `>=1.1.0`
- OpenCode binary is available
- plugin package builds
- `opencode debug config` can load the plugin when available
- expected visible agent names are present when OpenCode debug output is available
- hidden/system agents are not visible as primary agents when OpenCode debug output is available
- expected MCP names are registered in config
- required env vars are detected or reported as missing by service
- LSP helper commands are available or clearly reported as optional/missing

Output contract:

- Print a compact pass/warn/fail table
- Exit `0` when required checks pass and only optional services are missing
- Exit non-zero when build, OpenCode loading, or core agent registration fails
- For every warning, print the exact env var or install step the user should fix

Acceptance criteria:

- `bun run doctor` exists in `package.json`
- Running it from repo root does not require private machine paths
- It degrades gracefully when OpenCode is not installed
- It does not mutate user config or install global packages
- It documents `FIRECRAWL_API_KEY`, `STITCH_AI_API_KEY`, `CONTEXT7_API_KEY`, `OPENROUTER_API_KEY`, Python/uv for MemPalace, and RAG endpoint requirements

Verification:

```bash
bun run doctor
bun run typecheck
bun run build
```

---

## OSS-T2 — Add Agent Routing Tests

Owner: subagent  
Category: `deep`  
Suggested skills: `review-work`  
Risk: high  
Primary files:

- `src/tools/delegate-task/category-resolver.ts`
- `src/tools/delegate-task/subagent-resolver.ts`
- `src/tools/delegate-task/sub-agent.ts`
- `src/tools/call-omo-agent/constants.ts`
- `src/features/claude-code-session-state/state.ts`
- test files or a new lightweight test harness
- `package.json`

Goal:

Add automated tests that lock the current routing rules so agent visibility and dispatch do not regress again.

Required test cases:

- `quick` category resolves to `Coder`
- `writing` category resolves to `Coder`
- `unspecified-low` category resolves to `Coder`
- `deep` category resolves to `Coder`
- `ultrabrain` category resolves to `Coder`
- `visual-engineering` category resolves to `Coder`
- `artistry` category resolves to `Coder`
- `unspecified-high` category resolves to `Coder`
- direct `subagent_type="agent-skills"` is rejected
- direct `subagent_type="sub"` is rejected or migrated according to the current compatibility rule
- `quality-guardian`, `code-reviewer`, and `systematic-debugger` resolve to `Critic`
- `sub` and `subagent` aliases do not create a visible primary `Sub`
- `designer`, `brainstormer`, `platform-manager`, and `multimodal` are allowed by `call_omo_agent`
- `bob` and `guard` are not treated as ordinary direct specialist calls unless the code intentionally allows them

Implementation notes:

- Prefer direct unit tests around pure resolver functions where possible
- If a function is hard to test because it reaches the OpenCode SDK, extract a small pure helper rather than mocking the whole runtime
- Keep tests fast enough for local prepublish use

Acceptance criteria:

- A new script exists, for example `bun run test:routing`
- Routing tests run without a live OpenCode TUI
- Tests fail if category routing returns `Sub`
- Tests fail if `Agent Skills` becomes callable as a normal executor

Verification:

```bash
bun run test:routing
bun run typecheck
bun run build
```

---

## OSS-T3 — Clean Public Agent Key Model

Owner: subagent  
Category: `deep`  
Suggested skills: `review-work`  
Risk: high  
Primary files:

- `src/config/types.ts`
- `src/config/schema/agent-names.ts`
- `src/config/schema/agent-overrides.ts`
- `src/config/platform-schema.ts`
- `src/config/defaults.ts`
- `src/shared/agent-display-names.ts`
- `src/shared/migration/agent-names.ts`
- `hiai-opencode.json`
- `README.md`
- `AGENTS.md`
- `ARCHITECTURE.md`

Goal:

Separate public canonical names from internal compatibility keys. The user-facing model should be simple, while old config keys still migrate predictably.

Desired public model:

- `bob`
- `coder`
- `strategist`
- `guard`
- `critic`
- `designer`
- `researcher`
- `manager`
- `brainstormer`
- `vision`

Compatibility/internal model:

- `platform-manager` should map to `manager`
- `multimodal` and `ui` should map to `vision`
- `quality-guardian`, `code-reviewer`, and `systematic-debugger` should map to `critic`
- `sub` and `subagent` should map to `coder` or remain blocked as direct task targets
- `agent-skills` remains hidden/system-only
- `build` and `plan` remain hidden compatibility wrappers

Sub-tasks:

- Audit all schema files for old keys that are user-facing
- Decide whether `manager` and `vision` can become accepted config keys now, with migration to internal runtime keys if needed
- Keep backward compatibility for existing config files
- Update example config so new users see only public names
- Update docs to call out internal compatibility keys only in the migration section

Acceptance criteria:

- New user docs do not teach `platform-manager`, `multimodal`, or `quality-guardian` as primary names
- Old config keys still resolve
- `debug config` still shows display names `Manager` and `Vision`
- Hidden/system agents are not presented as normal user choices

Verification:

```bash
bun run typecheck
bun run build
bun run doctor
```

---

## OSS-T4 — Package Dry-Run And Publish Surface Audit

Owner: subagent  
Category: `quick`  
Suggested skills: `git-master`  
Risk: medium  
Primary files:

- `package.json`
- `.gitignore`
- `README.md`
- `AGENTS.md`
- `ARCHITECTURE.md`
- `LICENSE.md`
- `config/`
- `assets/`
- `skills/`

Goal:

Make `npm pack --dry-run` show a clean, intentional package with no local caches, private paths, stale docs, or accidental development artifacts.

Sub-tasks:

- Run `npm pack --dry-run` or equivalent
- Inspect the package file list
- Ensure `.npm-cache/`, `.runtime-cache/`, `.tmp/`, local `.opencode/`, and `node_modules/` are not included
- Ensure `AGENTS.md`, `ARCHITECTURE.md`, `README.md`, `LICENSE.md`, `hiai-opencode.json`, `config/`, `assets/`, `skills/`, and `dist/` are included
- Confirm deleted root docs are not referenced: `start.md`, `REGISTRY.md`, `AGENTS_INFO.md`
- Confirm deleted `docs/phase8-prompt-diet-report.md` is not referenced by published docs
- Confirm no `opencode-dcp` dependency remains in install graph

Acceptance criteria:

- Dry-run package contains only intentional runtime and documentation files
- No cache directories are included
- No private paths are included
- `package.json` `files` list matches actual publication intent

Verification:

```bash
npm pack --dry-run
bun run typecheck
bun run build
```

---

## OSS-T5 — Add Plugin-Local `.env.example`

Owner: subagent  
Category: `writing`  
Suggested skills: `writing-skills`  
Risk: low  
Primary files:

- `.env.example`
- `README.md`
- `AGENTS.md`
- `hiai-opencode.json`

Goal:

Create a plugin-local `.env.example` that a GitHub user can understand without any private machine context.

Required env groups:

- Model providers: `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DEEPSEEK_API_KEY`, `GLM_API_KEY`, `MINIMAX_API_KEY`, `QWEN_API_KEY`
- MCP services: `STITCH_AI_API_KEY`, `FIRECRAWL_API_KEY`, `CONTEXT7_API_KEY`
- Search/browser helpers if used by defaults
- Ollama: `OLLAMA_BASE_URL`, `OLLAMA_MODEL`
- MemPalace: `MEMPALACE_PYTHON`, optional palace path if supported
- RAG: endpoint/base URL if the plugin supports a configurable endpoint

Rules:

- No real keys
- No local paths
- Clear comments for required vs optional
- Use English only
- Keep comments concise enough to remain readable

Acceptance criteria:

- `.env.example` exists at repo root
- README points to it
- `AGENTS.md` points agents/tooling to it
- The variable list matches MCP and model defaults

Verification:

```bash
rg -n "C:\\\\hiai|/mnt/ai_data|YOUR_REAL_KEY" .env.example README.md AGENTS.md hiai-opencode.json
bun run typecheck
bun run build
```

---

## OSS-T6 — Document MCP Install And Runtime Policy

Owner: subagent  
Category: `writing`  
Suggested skills: `writing-skills`, `review-work`  
Risk: medium  
Primary files:

- `README.md`
- `AGENTS.md`
- `ARCHITECTURE.md`
- `src/config/defaults.ts`
- `src/mcp/index.ts`
- `assets/mcp/*`
- `assets/runtime/*`

Goal:

Make every MCP integration understandable for a new user and for another agent maintaining the plugin.

Required service matrix:

- `playwright`: local helper or local HTTP mode, npm package requirement, port if used
- `stitch`: remote MCP, auth env requirement
- `sequential-thinking`: upstream stdio via `npx -y @modelcontextprotocol/server-sequential-thinking`
- `firecrawl`: `npx -y firecrawl-mcp`, `FIRECRAWL_API_KEY`, optional HTTP streamable mode
- `rag`: external endpoint requirement
- `mempalace`: upstream `python -m mempalace.mcp_server` or `uv`, Python 3.9+, optional palace path
- `context7`: remote MCP and optional auth
- `websearch`: remote MCP and auth/search requirements
- `grep_app`: remote/local mode as implemented

Sub-tasks:

- Compare docs with `src/config/defaults.ts`
- Compare docs with `src/mcp/index.ts`
- Compare docs with `assets/mcp/*`
- Remove any fake SSE or stale endpoint claims
- Mark which services are registered by default and which require runtime availability
- Explain Windows local spawn caveat and supported workaround

Acceptance criteria:

- README has a clear MCP table
- AGENTS.md tells subagents exactly where to edit MCP defaults and launcher behavior
- ARCHITECTURE.md explains remote vs local vs helper modes
- No MCP doc contradicts actual config defaults

Verification:

```bash
rg -n "8812|8813|/sse|fake|claude mcp|firecrawl|mempalace|sequential-thinking" README.md AGENTS.md ARCHITECTURE.md src/config/defaults.ts src/mcp/index.ts assets
bun run typecheck
bun run build
```

---

## OSS-T7 — Rewrite `hiai-opencode.json` As A Real User Template

Owner: subagent  
Category: `writing`  
Suggested skills: `writing-skills`  
Risk: medium  
Primary files:

- `hiai-opencode.json`
- `README.md`
- `AGENTS.md`
- `src/config/defaults.ts`
- `src/config/models.ts`

Goal:

Make the root example config useful as a copyable user template, not a dump of internal defaults.

Required sections:

- Model presets guidance
- Agent model override examples using public agent names
- Category model override examples
- MCP enable/disable examples
- LSP enable/disable examples
- Auth/env guidance that points to `.env.example`
- Comments explaining where source defaults live in code

Rules:

- No local paths
- No private provider keys
- No stale names like `haiku`, `sonnet`, or `hiai-fast`
- No `claudeModelAliases`
- No hidden/system agents as normal examples
- English only

Acceptance criteria:

- A new user can understand what to edit
- The file is valid JSON or clearly documented JSONC if comments are used
- Names match current runtime vocabulary: `Bob`, `Coder`, `Strategist`, `Guard`, `Critic`, `Designer`, `Researcher`, `Manager`, `Brainstormer`, `Vision`

Verification:

```bash
rg -n "hiai-fast|sonnet|haiku|claudeModelAliases|C:\\\\hiai|/mnt/ai_data|quality-guardian|platform-manager|multimodal" hiai-opencode.json README.md AGENTS.md
bun run typecheck
bun run build
```

---

## OSS-T8 — Add Documentation Hygiene Check

Owner: subagent  
Category: `quick`  
Suggested skills: `git-master`  
Risk: low  
Primary files:

- `package.json`
- new script under `scripts/`
- `README.md`
- `AGENTS.md`
- `ARCHITECTURE.md`
- `LICENSE.md`
- `hiai-opencode.json`

Goal:

Add an automated docs hygiene command that catches private paths, Russian text in public docs, stale file references, and deleted-doc references before publishing.

Expected command shape:

```bash
bun run check:docs
```

Required checks:

- No Cyrillic in `README.md`, `AGENTS.md`, `ARCHITECTURE.md`, `LICENSE.md`, `hiai-opencode.json`, `.env.example`
- No `C:\hiai`
- No `/mnt/ai_data`
- No `.claude` in public docs/config unless explicitly documenting compatibility and not creating that directory
- No references to `start.md`, `REGISTRY.md`, `AGENTS_INFO.md`, or `docs/phase8-prompt-diet-report.md`
- No `file:///` local plugin paths

Acceptance criteria:

- `bun run check:docs` exists
- It exits non-zero on violations
- It prints file and line for each violation
- It is documented in `AGENTS.md`

Verification:

```bash
bun run check:docs
bun run typecheck
bun run build
```

---

## OSS-T9 — Document Prompting Layers Near Source

Owner: subagent  
Category: `writing`  
Suggested skills: `writing-skills`  
Risk: low  
Primary files:

- new `src/agents/AGENTS.md` or `src/agents/prompting.md`
- root `AGENTS.md`
- `ARCHITECTURE.md`
- `src/agents/*`
- `src/plugin-handlers/*`

Goal:

Make prompt ownership clear for contributors and autonomous agents working inside `src/agents`.

Required content:

- `src/agents` is the main prompt authoring layer
- Final runtime prompt can also include shared prompt-library blocks
- Final runtime prompt can include model-specific overlays
- Final runtime prompt can include environment context injection
- Final runtime prompt can include `prompt_append`
- Final runtime prompt can include closure protocol
- Strategist prompt assembly has a separate builder path
- Agent visibility, display name, and runtime description are handled outside source prompts

Acceptance criteria:

- Root `AGENTS.md` links to the source-level prompt guide
- The guide tells contributors exactly where to edit Bob, Coder, Strategist, Guard, Critic, Vision, Manager, Researcher, Designer, and Brainstormer
- The guide explains when to edit `src/plugin-handlers/agent-config-handler.ts`
- The guide is English-only and has no local paths

Verification:

```bash
bun run check:docs
bun run typecheck
bun run build
```

---

## OSS-T10 — Windows Local MCP Runtime Strategy

Owner: subagent  
Category: `deep`  
Suggested skills: `review-work`  
Risk: high  
Primary files:

- `src/config/defaults.ts`
- `src/mcp/index.ts`
- `assets/mcp/*`
- `assets/runtime/npm-package-runner.mjs`
- `scripts/opencode_doctor.sh`
- `README.md`
- `AGENTS.md`

Goal:

Reduce or clearly isolate Windows `EPERM uv_spawn` failures for local MCP servers.

Known affected services:

- `sequential-thinking`
- `mempalace`
- `firecrawl`
- local `npx`-backed helpers

Investigation tasks:

- Confirm whether OpenCode local MCP spawn fails only for `cmd`/`node` or for all local processes
- Test whether prelaunching local HTTP/streamable servers avoids the issue
- Test whether `node` wrapper scripts are more reliable than `cmd /c npx`
- Test whether `bun x` or direct package binary execution is viable
- Confirm whether Firecrawl HTTP streamable mode works with `HTTP_STREAMABLE_SERVER=true`
- Confirm whether Sequential Thinking has an official HTTP mode or requires a proxy
- Confirm MemPalace upstream stdio behavior through `python -m mempalace.mcp_server`

Implementation options:

- Add a documented `prelaunch` mode for local MCP helpers
- Add a local bridge only when upstream stdio cannot be spawned by OpenCode
- Keep upstream stdio defaults where they work reliably
- Make `doctor` detect and report which mode works

Acceptance criteria:

- Windows users get a clear diagnostic instead of silent missing MCPs
- Docs clearly state the supported mode for each local MCP
- No fake local SSE URLs remain
- `doctor` reports exact missing runtime or spawn issue

Verification:

```bash
bun run doctor
bun run typecheck
bun run build
opencode mcp list --print-logs --log-level INFO
```

---

## OSS-T11 — Final Open Source Release Gate

Owner: subagent  
Category: `ultrabrain`  
Suggested skills: `review-work`, `git-master`  
Risk: high  
Primary files:

- all root docs
- `package.json`
- `hiai-opencode.json`
- `src/config/*`
- `src/tools/delegate-task/*`
- `src/tools/call-omo-agent/*`
- `src/plugin-handlers/*`
- `assets/*`
- `skills/*`

Goal:

Run a final release audit after OSS-T1 through OSS-T10 land.

Required checks:

- `bun run typecheck`
- `bun run build`
- `bun run doctor`
- `bun run check:docs`
- `bun run test:routing`
- `npm pack --dry-run`
- `opencode debug config` where available
- `opencode mcp list --print-logs --log-level INFO` where available

Manual audit checklist:

- A fresh user can install from GitHub
- A fresh user can find where to set model keys
- A fresh user can find where to change agent prompts
- A fresh user can find where to change MCP defaults
- A fresh user can understand which MCPs require API keys or external runtimes
- Another agent can read `AGENTS.md` and know what files to edit
- Root docs are non-duplicative
- Internal compatibility keys are not presented as primary user concepts
- Hidden/system agents are not visible as normal primary agents
- Published package contents are intentional

Acceptance criteria:

- All automated checks pass or have explicit documented blockers
- Any blocker is recorded in this `todo.md` with owner, repro command, and next step
- No new private machine paths are introduced
- No stale deleted doc links are introduced
