# todo.md

## Post-Refactor Validation Snapshot (2026-04-20)

Validation intent: prove the smallest build-safe path after refactor.

- [x] `bun run typecheck` (`tsc --noEmit`) passes
- [x] `bun run build` (Bun ESM bundle from `src/index.ts`) passes
- [x] Build artifacts are emitted to `dist/` during validation
- [ ] Add broader runtime smoke tests only after active refactor churn settles

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
- [ ] Preserve all important legacy capabilities through **modes**, not duplicate agents
- [ ] Enforce a shared **closure protocol** across the full agent system
- [ ] Reduce prompt bloat and orchestration waste without losing coverage
- [ ] Split work cleanly across **low / medium / high** model tiers
- [ ] Restore consistency across runtime, schema, config, prompts, hooks, and docs
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

- [ ] Create one canonical agent registry for the 12 agents
- [ ] Add alias resolution layer old-name -> canonical-name
- [ ] Add capability metadata per agent: role, mode set, cost tier, permissions, default model tier
- [ ] Add reasoning-depth metadata per agent: low, medium, high
- [ ] Add shared closure-protocol module
- [ ] Define final acceptance semantics for `guard`

Acceptance criteria:

- [ ] One registry file is the source of truth
- [ ] Alias resolution works independently of runtime registration
- [ ] `critic` remains separate and explicit

### Phase 2 — Schema and Config Cleanup

- [ ] Update agent type unions to match the 12-agent model
- [ ] Update zod config schemas to the same canonical set
- [ ] Update override schemas to support all canonical agents directly
- [ ] Clean `default-config.json`
- [ ] Clean public `hiai-opencode.json`
- [ ] Remove stale public config examples that teach deprecated names

Acceptance criteria:

- [ ] Runtime types and zod schema match
- [ ] Config examples use canonical names only
- [ ] Legacy names resolve only via alias compatibility

### Phase 3 — Runtime Assembly Simplification

- [ ] Refactor agent registration so only canonical agents are registered
- [ ] Remove deprecated runtime agent entries that survive only by historical accident
- [ ] Preserve custom user and project agent loading without mixing it with legacy builtins
- [ ] Simplify config assembly order and conflict handling
- [ ] Ensure `coder` and `sub` stay separate runtime registrations with separate policies

Acceptance criteria:

- [ ] Final `config.agent` contains canonical agents plus custom agents, not obsolete builtins
- [ ] No deprecated agent is created as a fake Bob clone or placeholder

### Phase 4 — Prompt and Mode Refactor

- [ ] Refactor `bob` prompt around lightweight routing and distribution
- [ ] Refactor `guard` prompt around closure enforcement and final acceptance
- [ ] Refactor `strategist` prompt into explicit internal modes: planning, pre-check, architecture
- [ ] Restore `critic` as dedicated review gate
- [ ] Refactor `coder` to cover focused, deep-work, and refactor modes only
- [ ] Refactor `sub` as cheap delegated executor with hard scope limits
- [ ] Refactor `researcher` to fully cover both local and external search duties
- [ ] Refactor `quality-guardian` to cover review and debug cleanly
- [ ] Refactor `platform-manager` into explicit operational modes

Acceptance criteria:

- [ ] Each canonical agent has clear mode boundaries
- [ ] Repeated policy text is moved to shared modules
- [ ] Prompt size is reduced without losing operational rules

### Phase 5 — Permissions, Hooks, and Workflow Logic

- [ ] Rework tool permission logic against canonical names and capabilities
- [ ] Remove hardcoded legacy-name checks from hooks
- [ ] Update ultrawork and verification flows to use canonical identifiers
- [ ] Update task delegation rules to canonical names
- [ ] Ensure closure-protocol metadata can be consumed by hooks
- [ ] Add explicit routing rules that choose `sub` vs `coder` by task depth and scope

Acceptance criteria:

- [ ] No critical flow depends on `logician`, `librarian`, `explore`, `pre-plan` literal checks
- [ ] `critic` review loop works through canonical routing

### Phase 6 — Documentation and Migration

- [ ] Rewrite `AGENTS_INFO.md`
- [ ] Rewrite registry and architecture documentation to match reality
- [ ] Remove links to missing files
- [ ] Document alias compatibility and future removal policy
- [ ] Add migration notes for users with old config keys

Acceptance criteria:

- [ ] Docs describe the real runtime system
- [ ] No doc points to deleted or imaginary prompt files

### Phase 7 — Validation and Benchmarks

- [ ] Restore `bun run typecheck`
- [ ] Keep `bun run build` green
- [ ] Add registry consistency tests
- [ ] Add alias-resolution tests
- [ ] Add prompt composition tests for canonical agents
- [ ] Add smoke test for plan -> code -> review -> closure workflow
- [ ] Add routing tests for `sub` vs `coder`
- [ ] Measure token usage before and after refactor

Acceptance criteria:

- [ ] Typecheck passes
- [ ] Build passes
- [ ] Canonical registry is validated in CI
- [ ] Token usage shows a meaningful reduction without workflow regressions

---

## Detailed Task Breakdown

### T1 — Build Canonical Registry

- [ ] Add canonical registry file
- [ ] Define 12 agents, aliases, modes, cost class, tier, depth, and capability metadata
- [ ] Add helper APIs for display names and canonical resolution

Model tier:
- [ ] Medium

### T2 — Add Alias Compatibility Layer

- [ ] Resolve all deprecated names to canonical ids
- [ ] Log deprecated name usage
- [ ] Add tests for config, runtime, and task delegation alias handling

Model tier:
- [ ] Low

### T3 — Reintroduce Explicit Critic Runtime Path

- [ ] Ensure `critic` exists as a real canonical agent
- [ ] Move high-accuracy plan review to `critic`
- [ ] Remove contradictory prompt assumptions that `critic` is merged away

Model tier:
- [ ] High

### T4 — Sync Types and Schemas

- [ ] Update runtime type unions
- [ ] Update zod schemas
- [ ] Update overrides and defaults

Model tier:
- [ ] Medium

### T5 — Simplify Agent Registration

- [ ] Register canonical agents only
- [ ] Stop emitting deprecated builtins into final runtime config
- [ ] Keep custom/project agents working
- [ ] Keep `coder` and `sub` as separate canonical agents with separate registration and config resolution

Model tier:
- [ ] Medium

### T6 — Refactor Shared Prompt Library

- [ ] Extract closure block
- [ ] Extract shared anti-slop rules
- [ ] Extract shared routing and verification blocks
- [ ] Extract minimal model overlays

Model tier:
- [ ] Medium

### T7 — Rewrite Bob and Guard

- [ ] Make `bob` lightweight and distribution-focused
- [ ] Make `guard` final-acceptance and closure-focused
- [ ] Prevent both from carrying duplicated reasoning scaffolds

Model tier:
- [ ] High

### T8 — Refactor Strategist and Critic Separation

- [ ] `strategist` handles planning and architecture
- [ ] `critic` handles review and accept-reject loop
- [ ] Remove role overlap where possible

Model tier:
- [ ] High

### T9 — Separate Coder and Sub Execution Paths

- [ ] Keep `coder` as the expensive long-horizon implementation agent
- [ ] Keep `sub` as the cheap bounded delegated executor
- [ ] Separate models, token budgets, prompt contracts, permissions, and retry policies
- [ ] Add strict escalation rules from `sub` to `coder`

Model tier:
- [ ] High

### T10 — Refactor Researcher

- [ ] Fully replace `librarian` and `explore`
- [ ] Preserve internal and external search distinctions as modes
- [ ] Update all prompt examples and delegation references

Model tier:
- [ ] Medium

### T11 — Refactor Quality Guardian

- [ ] Merge review and systematic debugging cleanly
- [ ] Keep response contracts strict and concise
- [ ] Remove stale references to old review/debug agents

Model tier:
- [ ] Medium

### T12 — Refactor Platform Manager

- [ ] Add explicit modes for ledger, bootstrap, initializer, mindmodel
- [ ] Stop concatenating incompatible prompt blocks without routing
- [ ] Add tests for mode routing

Model tier:
- [ ] Medium

### T13 — Update Permissions and Hooks

- [ ] Rewrite permission matrix to capability-first logic
- [ ] Rewrite hook checks to canonical ids
- [ ] Update ultrawork and verification flows
- [ ] Update executor selection logic to choose `sub` for cheap bounded work and `coder` for deep work
- [ ] Add hook-visible metadata for reasoning depth and execution contour

Model tier:
- [ ] High

### T16 — Model Routing Matrix

- [ ] Define exact low / medium / high model assignment per canonical agent
- [ ] Define escalation conditions per agent and per mode
- [ ] Forbid simple and complex tasks from sharing one execution agent when the economics differ
- [ ] Encode routing guidance in registry metadata, not just prompt prose

Model tier:
- [ ] Medium

### T17 — Current Implementation Gap Audit

- [x] Replace current "11-agent" assumptions in this plan and in code comments
- [x] Audit current runtime places where `sub` is being collapsed incorrectly or treated as placeholder
- [x] Audit prompt sections that still assume old agent families or merged execution contours
- [x] Audit config defaults and overrides to ensure `sub` remains configurable separately from `coder`

Model tier:
- [ ] Medium

### T14 — Clean Docs and Public Config

- [ ] Rewrite docs for the 12-agent model
- [ ] Remove stale files and references
- [ ] Update examples and migration notes

Model tier:
- [ ] Low

### T15 — Add CI and Benchmark Coverage

- [ ] Add consistency tests
- [ ] Add smoke workflow tests
- [ ] Add token benchmark before/after comparison

Model tier:
- [ ] Medium

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

- [ ] Add script `scripts/measure_prompts.ts` that instantiates each canonical agent with a representative `available*` fixture and writes the fully-assembled system prompt to `dist/prompt-snapshots/<agent>.<model>.md`
- [ ] Record byte size and approximate token count (use a simple char/4 heuristic; note it in the file header)
- [ ] Commit baseline snapshots under `tests/fixtures/prompt-baseline/` before touching any prompt code
- [ ] Add `bun run prompts:measure` script in `package.json`
- [ ] Document the measurement in `REGISTRY.md` (so future refactors can diff against it)

Acceptance:
- [ ] Snapshots exist for bob/coder/strategist/sub/guard × at least default + one model overlay
- [ ] Re-running the script yields byte-identical output (deterministic)
- [ ] README mentions how to regenerate baseline

Risk tier: low  
Token win: none directly (enables measuring later wins)

---

### T19 — P0.1 Single Todo/Task Discipline Module

Duplication sites to collapse:
- [ ] `src/agents/bob/default.ts` lines ~27–134 (`buildTaskManagementSection`)
- [ ] `src/agents/bob/gpt-pro.ts` equivalent block
- [ ] `src/agents/coder/gpt-codex.ts` lines ~32–98 (`buildGptCodexTodoDisciplineSection`)
- [ ] `src/agents/coder/gpt-pro.ts` equivalent block
- [ ] `src/agents/coder/gpt.ts` equivalent block
- [ ] `src/agents/sub/gpt-codex.ts` and other `sub/*` flavors
- [ ] `src/agents/guard/*-prompt-sections.ts` if todo language is repeated

Target API (new): `prompt-library/todo-discipline.ts`
- [ ] `buildTodoDiscipline({ role: "orchestrator" | "executor" | "sub" | "guard", useTaskSystem: boolean, toolName: "todowrite" | "task_create" })`
- [ ] Body ≤ 15 lines of prose (rule, 1 workflow line, 1 anti-pattern line). No "Why This Matters" filler.
- [ ] Distinct output only where behavior actually differs (executor enforces single in-progress; orchestrator ties todos to explicit user intent)

Sub-tasks:
- [ ] Create `src/agents/prompt-library/todo-discipline.ts` with the unified builder + unit-level comparison fixtures
- [ ] Replace the 6 duplicated blocks with calls to the new builder
- [ ] Delete the now-unused inline functions (`buildTaskManagementSection`, `buildGptCodexTodoDisciplineSection`, etc.)
- [ ] `bun run typecheck`, `bun run build`
- [ ] Regenerate prompt snapshots; diff against baseline; confirm removed lines are the duplicate policy text only
- [ ] Verify at least one runtime smoke (Bob routing decision) still creates todos

Acceptance:
- [ ] No file outside `prompt-library/` contains the words "Task Management (CRITICAL)" or "Todo Discipline (NON-NEGOTIABLE)" literal headers
- [ ] Snapshot diff shows ≥ 8 KB reduction across the 6 agents combined
- [ ] Behavior contracts preserved: "ONE at a time", "NEVER batch", "scope changes update first"

Risk tier: low  
Token win: ~8–10 KB per full session load

---

### T20 — P0.2 Unified Intent Gate (Router vs Executor)

Duplication sites:
- [ ] `bob/default.ts` lines ~191–243 (Phase 0 Intent Gate for router)
- [ ] `bob/gpt-pro.ts` equivalent
- [ ] `coder/gpt-codex.ts` lines ~149–238 (Step 0/1/2/3 + Do NOT Ask)
- [ ] `coder/gpt-pro.ts`, `coder/gpt.ts` equivalents
- [ ] `sub/gpt-codex.ts` lines ~32–67

Target API: `prompt-library/intent-gate.ts`
- [ ] `buildIntentGate({ role: "router" | "executor" })`
- [ ] Router variant: keeps short surface→intent bullets (converted from table to bullets), routing hint, single "verbalize" line
- [ ] Executor variant: 5 lines max — "surface question usually implies action", "ambiguity → research first, ask last", "no permission gating", "note assumptions in final message", "commit to stated action in same turn"
- [ ] Remove `Verbalize your classification` mandate from executor paths (keep only in router)

Sub-tasks:
- [ ] Implement builder
- [ ] Convert the existing intent/surface tables into bullet pairs (`"Did you do X?" → do X now`) to save table-token overhead
- [ ] Replace duplicated blocks in bob/coder/sub
- [ ] Keep Ambiguity Protocol steps intact for `sub` specifically (scope-creep guard) — do not merge it into intent gate
- [ ] `typecheck`, `build`, snapshot diff

Acceptance:
- [ ] Intent gate source-of-truth lives only in `prompt-library/intent-gate.ts`
- [ ] Executor variants no longer instruct the model to emit a "I detect … intent" sentence
- [ ] Snapshot diff reduces bob+coder+sub by ≥ 6 KB combined
- [ ] Manual check: a router prompt still surfaces routing bullets; executor still forbids permission-asking

Risk tier: low–medium (must keep `sub` scope-discipline intact)  
Token win: ~5–7 KB per session load

---

### T21 — P0.3 Merge Hard Blocks + Anti-Patterns

Current duplication:
- [ ] `buildHardBlocksSection` and `buildAntiPatternsSection` in `dynamic-agent-policy-sections.ts` have overlapping Critic / background_cancel / type-safety rules
- [ ] Called from bob/coder/sub/guard independently

Sub-tasks:
- [ ] Introduce `buildHardRulesSection()` returning one `<Hard_Rules>` block with 6–8 deduplicated rules
- [ ] Keep ordering: safety first (never-violate), then anti-patterns (blocking violations)
- [ ] Update all call sites; delete the two old functions (or keep as aliases only if any external config references them — check with `grep -r "buildHardBlocksSection\|buildAntiPatternsSection"`)
- [ ] Snapshot diff + typecheck + build

Acceptance:
- [ ] Single call site per agent instead of two
- [ ] No rule appears twice (e.g., Critic-gate clause only once)
- [ ] ≥ 300 token reduction per agent that called both

Risk tier: low  
Token win: ~1.5–2 KB per full session load

---

### T22 — P0.4 Emphasis Deflation Pass

Principle: one emphasis per section header, zero in body. Remove stacked CAPS + bold + "(CRITICAL)/(NON-NEGOTIABLE)/(BLOCKING)/(MANDATORY)".

Sub-tasks:
- [ ] Grep for the emphasis markers across `src/agents/**` and `prompt-library/**`: `CRITICAL`, `NON-NEGOTIABLE`, `MANDATORY`, `BLOCKING`, `ALWAYS`, `NEVER` used in body prose (not in rule names)
- [ ] Reduce to a single marker per section; prefer structural rules (bullet list) over shouting
- [ ] Do NOT remove `NEVER`/`ALWAYS` where they are the actual rule verb (e.g., "NEVER commit without explicit request")
- [ ] Snapshot diff — expect small but consistent reduction

Acceptance:
- [ ] No single bullet contains more than one emphasis marker
- [ ] Section headers still carry their "CRITICAL"/"NON-NEGOTIABLE" tag where semantically accurate (≤ 1 per header)
- [ ] Snapshot shows ≥ 1 KB reduction aggregate across agents

Risk tier: very low  
Token win: ~1–1.5 KB per session

---

### T23 — P0.5 Collapse Researcher Sections

Current state:
- [ ] `prompt-library/specialized.ts` exports `buildLogicianSection`, `buildExploreSection`, `buildLibrarianSection` — the last two both describe `researcher` from different angles
- [ ] `dynamic-agent-core-sections.ts` has its own `buildResearcherSection`

Sub-tasks:
- [ ] Replace `buildExploreSection` + `buildLibrarianSection` with single `buildResearcherSection({ mode: "internal" | "external" | "both" })` (default "both")
- [ ] Move canonical researcher prompt text into `prompt-library/researcher.ts`
- [ ] Delete `buildLogicianSection` from `specialized.ts` — it is a legacy alias for `buildStrategistAndCriticSection`; remove the `export const buildLogicianSection = buildStrategistAndCriticSection` line in `dynamic-agent-core-sections.ts` at line ~242
- [ ] Find and fix all callers
- [ ] `grep -r "buildLogicianSection\|buildExploreSection\|buildLibrarianSection"` must return 0 after cleanup

Acceptance:
- [ ] Only one researcher-description source in the repo
- [ ] Legacy alias `buildLogicianSection` deleted
- [ ] Snapshot diff: researcher mentions appear once per agent prompt instead of 2–3 times

Risk tier: low  
Token win: ~1 KB per session plus clarity

---

### T24 — P1.1 Bob Lightweighting

Goal: Bob becomes a router-first prompt aligned with [todo.md Reasoning Depth Matrix → Low Depth Agents](#reasoning-depth-matrix).

Remove or relocate from Bob:
- [ ] "Phase 1 — Codebase Assessment" block → move to `strategist` (or skip entirely; strategist already owns assessment)
- [ ] "When to Challenge the User" long block with template → compress to one bullet in a shared `challenge-user.ts` helper; call only from strategist/critic
- [ ] "Parallel Delegation" essay (`buildParallelDelegationSection` for non-Claude) → shrink to 5 lines: decompose, delegate, parallel, sub-vs-coder, prompt contract
- [ ] Stylistic identity prose ("SF Bay Area engineer", "no AI slop", "Humans roll their boulder…") → delete; identity already set via `buildAgentIdentitySection`
- [ ] "Clarification Protocol" markdown template → delete; ambiguity protocol already covers it
- [ ] Duplicate `<tool_usage_rules>` block — deduplicate with `buildAntiDuplicationSection` + `buildParallelPolicy`

Sub-tasks:
- [ ] Refactor `bob/default.ts` into `bob/core.ts` (thin router) + `bob/overlays/claude.ts` (empty or tiny)
- [ ] Same for `bob/gpt-pro.ts` → use `bob/core.ts` + `bob/overlays/gpt-pro.ts` carrying only the GPT-specific adjustments (apply_patch guard, tool-call format)
- [ ] Same structure for `bob/gemini.ts`
- [ ] Verify via snapshot that retained behaviors include: intent gate (router variant), delegation table, parallel policy (compressed), strategist/critic escalation policy, todo discipline (orchestrator variant)
- [ ] Target Bob core ≤ 7 KB; overlays ≤ 3 KB

Acceptance:
- [ ] `wc -c src/agents/bob/core.ts` ≤ 7 KB
- [ ] No per-model Bob file exceeds 3 KB
- [ ] Snapshot preserves routing + delegation + closure behaviors (diff against T18 baseline)
- [ ] Bob registers and runs in smoke test (T30)

Risk tier: medium (largest single refactor)  
Token win: ~12–14 KB per Bob session load

---

### T25 — P1.2 Coder Core + Overlays

Similar to T24 but for Coder. Executor, not router.

Sub-tasks:
- [ ] Extract `coder/core.ts` from the common parts of `coder/gpt-codex.ts`, `coder/gpt-pro.ts`, `coder/gpt.ts`
- [ ] `coder/overlays/{gpt,gpt-pro,gpt-codex,gemini,claude}.ts` carry only deltas:
  - apply_patch guard (gpt-codex)
  - tool-call format (gpt-flavored only)
  - thinking/reasoning hints if model-specific
- [ ] Use executor-variant intent gate (T20) and todo discipline (T19)
- [ ] Keep "Do NOT Ask — Just Do" rules but compress to a single `<Autonomy>` block (≤ 10 lines)
- [ ] Target Coder core ≤ 9 KB; overlays ≤ 3 KB

Acceptance:
- [ ] `wc -c src/agents/coder/core.ts` ≤ 9 KB
- [ ] No overlay > 3 KB
- [ ] 100%-or-nothing commitment preserved
- [ ] Delegation Trust Rule preserved (still forbids manual duplicate searches)
- [ ] Snapshot diff: Coder session prompt reduces from ~23 KB to ≤ 12 KB total

Risk tier: medium  
Token win: ~10–12 KB per Coder session

---

### T26 — P1.3 Strategist Lazy Mode Loading

Current: `identity-constraints.ts` (11 KB) + `interview-mode.ts` (18 KB) + `plan-template.ts` (13 KB) + `plan-generation.ts` (7 KB) + `high-accuracy-mode.ts` (2.5 KB) + `system-prompt.ts` (2.8 KB) are concatenated into one monolithic Strategist prompt.

Sub-tasks:
- [ ] Introduce mode dispatcher in `strategist/index.ts` accepting `{ mode: "planning" | "pre-check" | "architecture" | "interview" }`
- [ ] Load `interview-mode.ts` ONLY when `mode === "interview"`
- [ ] Load `plan-template.ts` ONLY when planning-style output is expected
- [ ] Keep `identity-constraints.ts` + `system-prompt.ts` as core (always loaded), but audit for duplication with shared hard-rules (T21)
- [ ] Add explicit fallback: unknown mode → planning (default, medium-depth)
- [ ] Update `builtin-agents/strategist.ts` wiring to pass mode

Acceptance:
- [ ] Strategist loaded-at-once prompt for default planning mode ≤ 12 KB
- [ ] Interview mode adds ≤ 18 KB only when triggered
- [ ] `typecheck` + `build` green
- [ ] Smoke: strategist returns a plan for a simple multi-step task; interview mode engages on ambiguous scope

Risk tier: medium (wiring change)  
Token win: 15–20 KB per non-interview strategist call

---

### T27 — P1.4 Drop NonClaudePlannerSection Duplication

- [ ] `buildNonClaudePlannerSection` in `dynamic-agent-core-sections.ts` repeats "consult Strategist first for multi-step" — already implicit from Delegation Table
- [ ] Remove the call from Bob unless measurable behavior regression occurs
- [ ] If keeping, compress to 3 lines and gate by `model.startsWith("gpt-oss")` only (the weakest planners)

Acceptance:
- [ ] Snapshot shows Bob no longer contains the 6-line Strategist-dependency prose for Claude/Gemini models
- [ ] For `gpt-oss` or equivalent weak planners (if any are wired), compressed version still present

Risk tier: low-medium (behavior change for non-Claude Bob)  
Token win: ~0.5 KB per non-Claude Bob session

---

### T28 — P1.5 Tool-Call-Format Section Gating

- [ ] Move `buildToolCallFormatSection` call out of shared builders
- [ ] Invoke only from overlays where the model actually mis-emits tool calls as text (gpt-oss, some ollama flavors)
- [ ] Remove from Claude, Gemini 2.x, mainline OpenAI `gpt-4o+` paths

Acceptance:
- [ ] Grep confirms the section is not inlined in Claude/Gemini/gpt-4o overlays
- [ ] Models without the section still emit valid tool calls in smoke tests

Risk tier: low  
Token win: ~200 tokens per affected session

---

### T29 — P2 Cosmetic & Structural Reductions

Batch of low-risk, low-individual-win changes. Land as one commit.

Sub-tasks:
- [ ] Convert 2-column tables to bullet pairs (`"X" → Y`) across all agent prompts (tables tokenize ~1.6×)
- [ ] Delete Clarification Protocol markdown template everywhere (Bob, others) — ambiguity protocol covers it
- [ ] Delete motivational prose: "Humans roll their boulder", "SF Bay Area engineer", "no AI slop", similar
- [ ] Delete "Why This Matters" / "Why This Is Non-Negotiable" sections — remove when they restate the rule
- [ ] Remove duplicate `<tool_usage_rules>` blocks; keep one composed from shared parallel policy

Acceptance:
- [ ] Each removed block verified against baseline snapshot — only stylistic text gone, no rules lost
- [ ] Aggregate snapshot diff ≥ 3 KB additional reduction
- [ ] No agent contains two `<tool_usage_rules>` blocks

Risk tier: very low  
Token win: ~3 KB aggregate

---

### T30 — Phase 8 Validation Gate

Must be the last task of Phase 8. Blocks merging the refactor.

Sub-tasks:
- [ ] `bun run typecheck` green
- [ ] `bun run build` green
- [ ] `bun run prompts:measure` regenerates snapshots; commit the new baseline
- [ ] Compare pre/post total bytes per agent; record in `docs/phase8-prompt-diet-report.md`:
  - Bob default ≤ 7 KB, overlays ≤ 3 KB
  - Coder core ≤ 9 KB, overlays ≤ 3 KB
  - Strategist default-mode ≤ 12 KB
  - Total prompt bytes across canonical 12 agents reduced ≥ 40%
- [ ] Smoke workflow: plan → code → review → closure using sandbox opencode run (see sandbox setup in session notes)
- [ ] Routing test: `sub`-eligible task routes to `sub`, deep task routes to `coder`
- [ ] Closure test: `guard` still enforces STATUS/NEXT_AGENT/VERIFICATION fields
- [ ] Critic test: review gate still blocks premature final answers
- [ ] No behavior regression vs baseline: anti-duplication still applied, background-task policy preserved, todos still created on multi-step tasks

Acceptance:
- [ ] All checks above pass
- [ ] Report doc merged with before/after table
- [ ] `todo.md` Phase 8 section fully checked

Risk tier: gate task, low code change  
Token win: confirms the aggregate win from T19–T29

---

### What NOT to change in Phase 8

- [ ] `guard` closure protocol — keep STATUS/TODO_UPDATE/NEXT_AGENT/VERIFICATION fields intact
- [ ] `sub` Scope Discipline + Ambiguity Protocol — protects against scope creep
- [ ] `AntiDuplication` shared module — real behavior guard, not bloat
- [ ] `gpt-apply-patch-guard` — model-specific correctness requirement
- [ ] Separation of `sub` vs `coder` in delegation tables and permissions
- [ ] `critic` review-gate wording strength — do not soften into strategist-like prose

---

### Phase 8 Anti-Regressions (Checks at each task)

- [ ] After every task: typecheck + build + snapshot diff
- [ ] After T19–T23 (P0 bundle): run a Bob routing smoke and Coder trivial-edit smoke
- [ ] After T24–T25 (Bob/Coder refactor): run full plan→code→review→closure smoke
- [ ] After T26 (Strategist mode split): run interview-mode smoke + planning-mode smoke
- [ ] Never delete a rule without first locating at least one test or smoke that exercises it; if none exists, add one in T30
