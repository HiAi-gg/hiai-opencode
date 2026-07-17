# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.7] — 2026-07-17

### 🛡️ TUI / output-leak hardening (Phase 1)

- **Completion controller `output.reason` is now sanitized.** New `sanitizeReason()` strips internal stack frames, `file://` URLs, `/path/file.ts:line` paths, long hex/session IDs, and oversized payloads before a reason is written to the TUI link. Reasons are truncated to 240 chars with an explicit `…` marker. The auto-continue path no longer injects a synthetic retry prompt on error (prevents TUI loops); it fails safe with `continue=false` and `reason=undefined`.
- **Hook error chain now emits TUI-safe DTOs.** `combineHookSets` wraps every hook handler (single or multi) so a thrown value is converted via `sanitizeHookError()` into a bounded `HookErrorDTO` (`code` + one-line `summary` + `hookPoint`) instead of leaking the raw `Error`/payload into `output.errors`. Errors are deduped and capped at `MAX_HOOK_ERRORS` (10). `BlockingHookError` still propagates.
- **Loop / continuation / stop-guard / todo-continuation logs use a short, non-leaky session id** (`shortId()`) instead of the raw session id.
- **Preemptive-compaction "consider compacting" warning is debounced** per session (60s cooldown) so it is not re-logged on every transform.
- **Dream-distill gains a burst/anti-replay guard.** `session.idle` / `session.created` are debounced per trigger type via an in-memory `burst_cooldown_ms` (default 60s, configurable in `bob.json` `dream.burst_cooldown_ms`); the hook also exposes a `dispose()` that clears the guard. Prevents duplicate dream sessions from bursty idle pings.

### 🧹 Compaction noise reduction

- **Compaction context injector now pushes a single compact preservation line** instead of seven verbose `PRESERVE:` lines. Gate rehydration lines (`GATE: quality command…`, `GATE: lsp_diagnostics pending…`, `GATE: changes pending Critic review…`) shortened. Idempotent across repeated compaction events.
- **Todo-preserver and error-recovery hooks emit single-line, concise hints** (edit / JSON parse recovery) rather than multi-line boilerplate. Quality-gate failure feedback collapsed to one actionable line.

### 🖥️ CLI: stdout stays clean for machine output

- **`hiai-opencode` CLI diagnostic/status strings now go to stderr** (`outInfo` helper) so stdout is reserved for future machine-readable (`--json`) output. Affects `doctor`, `mcp-status`, `export-mcp`, and `diagnose`.
- **`up`/`down`/`status` stack-management commands route all human output to stderr** (was stdout / `console.warn`).

### 🔌 MCP runtime: JSON-RPC stream hygiene

- **`npm-package-runner.mjs` now filters child stdout to valid JSON-RPC only.** npx download banners, warnings, and stack traces are redirected to stderr so they never corrupt the MCP protocol stream on stdout. Distinct exit codes (`EXIT_LAUNCH_FAILED`, `EXIT_CHILD_SIGNALED`) replace raw signal inheritance. Added `src/features/mcp/npm-package-runner.test.ts`.

### 🧪 Tests

- New: `sanitizeReason` unit tests (null/empty, clean pass-through, stack/path/hex stripping, whitespace collapse + truncation, non-string safety).
- New: dream-distill burst/anti-replay tests (idle burst, created burst, independent trigger types, idempotent repeats).
- Updated: completion-controller integration (no TUI-loop retry prompt on error), compaction-context-injector (single preserve line, idempotency), hooks/index (DTO sanitization), loop, quality-gate, edit/json error recovery, todo-continuation, preemptive-compaction, stop-continuation-guard.

## [0.3.6] — 2026-07-12

### 🔧 CLI: `bin` field & hardening

- **`hiai-opencode` is now a real executable.** Added `bin` field to `package.json` mapping `hiai-opencode` → `assets/cli/hiai-opencode.mjs`. Previously the documented `hiai-opencode doctor` / `mcp-status` commands were unreachable after `npm install` (no binary on PATH).
- **`doctor`/`mcp-status` now exit non-zero on hard failures** — usable as a CI gate.
- **Removed undeclared CLI dependencies.** Replaced `jsonc-parser` with a native `parseJsonc` (comment/trailing-comma stripping). Made `@modelcontextprotocol/sdk` a lazy import with graceful fallback — the CLI now runs without those transitive deps.
- **Agent roster corrected in diagnostics.** `REQUIRED_MODEL_SLOTS` and `getAgentSummary` now use the canonical slots (`bob, build, plan, manager, critic, designer, explore, writer, vision, general`) with legacy aliases (`coder`→`build`, `strategist`→`plan`, `researcher`→`explore`, `sub`→`general`, `guard`→`manager`, `brainstormer`→`writer`) mapped via `DEPRECATED_MODEL_KEYS`.
- Removed dead doctor checks (pgvector with hardcoded deployment, MemPalace auto-save hook, delegation permissions) and stale `toolCount`/agent list in `diagnose`.

### 🧹 MCP cleanup: 2 servers, no ghosts

- **CLI `MCP_REGISTRY` aligned with runtime registry** — both now expose exactly `sequential-thinking` and `grep_app`. The CLI previously advertised 5 servers (`mempalace`, `stitch`, `context7`, `sequential-thinking`, `grep_app`) that disagreed with the runtime's 2.
- **Fixed `export-mcp` dropping `grep_app`** and emitting ghost `stitch`/`mempalace`/`context7` entries. The generated `.mcp.json` now matches the runtime set, with validated passthrough for user-defined custom MCPs (requires `command`/`url`).
- **Removed `assets/mcp/mempalace.mjs`** launcher (331 lines) — MemPalace is not in the runtime registry since v0.3.0.
- **Cleaned `src/features/mcp/registry.ts`** — removed dead type fields (`install`, `optionalEnv`), normalized log prefix `[bob]` → `[hiai-opencode]`.
- **Updated `config/.mcp.json`** to match the current 2-server shape.

### ⚡ MCP auto-export at startup

- **New `src/features/mcp/auto-export.ts`.** The plugin now writes `.opencode/.mcp.json` at startup so hosts whose `opencode mcp list` only reads static config can see hiai-managed servers. Controlled by `HIAI_OPENCODE_AUTO_EXPORT_MCP` (`if-missing` default | `always` | `off`), `HIAI_OPENCODE_MCP_EXPORT_PATH`, `HIAI_OPENCODE_EXPORT_MCP_MODE` (`safe` | `force`). Previously this documented feature was not implemented.

### ⏲️ Circuit breaker is now live

- **`BackgroundManager` is wired to `tool.execute.after`** via new `src/hooks/circuit-breaker.ts`. The consecutive-identical-call limit (default 20) and total-tool-call limit (default 4000) now actually fire — previously `launch()`/`recordToolCall()` had zero production call sites, so the entire `background_manager` config in `bob.json` was inert.
- Added `recordSessionToolCall()` / `getTaskForSession()` APIs that auto-register a tracking task per session and abort via `client.session.abort` when a breaker trips.

### 🛡️ Completion gates hardened

- **`validateClosure` now enforces the `readiness` enum** (`done` | `accept` | `reject`) — previously any string passed validation despite the schema declaring the union.
- **Removed the `agentType`-fallback self-approval bypass** in the completion controller. An unknown/missing `agentType` no longer parses a CLOSURE block to self-approve; it falls through to the normal `decide()` path so the Critic requirement still applies.
- **Quality gate feeds the completion state machine.** `src/hooks/quality-gate.ts` now sets a `qualityGateFailed` flag on failed test/lint/typecheck runs; `decide()` blocks completion with a clear prompt until the command passes. Previously the gate was advisory-only (appended text).
- **LSP-diagnostics gate.** Edits set `lspPending=true`; any `lsp_*` tool call clears it; `decide()` blocks completion until diagnostics have been run. `mergeChangedFiles()` transfers child-session changes to the parent without re-tripping the gate.
- Expanded quality-command detection (added `eslint`, `vitest`, `jest`).

### 🗜️ Compaction: gate state rehydration

- **`compaction-context-injector` now re-injects live completion-gate state** (`qualityGateFailed`, `lspPending`, pending Critic review) into the compaction context. The in-memory gates survive compaction (keyed by sessionID), but the agent's awareness lived in message history — the rehydration ensures the post-compaction agent still knows which gates block completion.

### 📚 Documentation aligned with the actual codebase

- **`ARCHITECTURE.md` rewritten.** All file paths now point to files that actually exist. Removed fictional references to `src/plugin-handlers/*`, `src/agents/coder/`, `src/agents/strategist/`, `src/shared/migration/*`, `src/config/schema/skill-discovery.ts`, `src/agents/prompt-library/*`, `src/mcp/index.ts`, `buildAgentIdentitySection()`, and similar.
- **`AGENTS.md` Change Map, Prompting Layout, MCP Rules, Closure Protocol, and troubleshooting** updated to real files. Legacy alias mapping clarified (no separate migration module — mappings live only in CLI diagnostics). Removed phantom `skill_discovery` config instructions and MemPalace taxonomy section.
- Documented the new auto-export env vars, circuit-breaker wiring, and completion gates.

### 🗑️ Removed dead code

- `assets/mcp/mempalace.mjs` (331 lines)
- `scripts/opencode_doctor.mjs` (broken ESM/require hybrid)
- `scripts/measure-prompts.ts` (referenced non-existent module paths)

### 🧪 Tests

- New: `src/features/mcp/auto-export.test.ts` (10 tests)
- New: `src/features/background-manager/circuit-breaker.test.ts` (7 tests)
- New: compaction gate-rehydration tests (4 tests)
- Updated: `decide.test.ts` (quality + lsp gate branches), `quality-gate.test.ts` (sessionID + new directive text), `state.test.ts` (new fields)

## [0.3.5] — 2026-07-10

### 🌲 Worktree Support

- **WorktreeManager**: New manager class (`src/features/worktree/index.ts`) for isolated worktree operations and lifecycle handling
- **4 worktree tools**: `hiai_worktree_create`, `hiai_worktree_list`, `hiai_worktree_remove`, `hiai_worktree_status` for git worktree lifecycle management
- **Lifecycle hooks**: Added worktree lifecycle hooks (`chat.message` for auto-create on plan start, `tool.execute.after` for auto-cleanup on CLOSURE)
- **Prompt integration**: Worktree context and commands integrated into Bob, Manager, and Coder prompts for seamless worktree-aware task execution
- **Skill**: New `using-git-worktrees` skill (`skills/general/using-git-worktrees/`) providing worktree operations via skill interface

## [0.3.3] — 2026-07-09

### 📦 Env/Config Consistency & Template Cleanup

- **Env templates consolidated**: Merged `.env.example` (OLLAMA vars, HIAI_OPENCODE_* vars) and `hiai-opencode.example` (MEMPALACE vars) into single canonical `bob.env.example`. Deleted `.env.example`, `hiai-opencode.example`, `hiai-opencode.example.json` (redundant third templates).
- **Removed `.env.example` from package.json `files`** — only `bob.env.example` ships as the canonical env template.
- **`.gitignore` updated**: Added `bob.env` entry to prevent accidental API key commits.
- **README.md**: Replaced `.env`/`.env.example` instructions with `bob.env`/`bob.env.example`. Added dual-config explanation (bob.json runtime + hiai-opencode.json user-facing).
- **AGENTS.md**: Replaced `.env.example` key template references with `bob.env.example`. Fixed Firecrawl env reference (`.env` → `bob.env`).
- **docs/quickstart.md**: Replaced `.env.example` → `bob.env.example`, `.env` → `bob.env`.
- **docs/CONFIG.md**: Clarified dual-config system (`bob.json` runtime + `hiai-opencode.json` user-facing + `bob.env` secrets). Fixed CONTEXT7_API_KEY required→optional (No). Fixed malformed JSON in full example (extra closing brace).
- **ARCHITECTURE.md**: Fixed security guidance — keys go in `bob.env` with `{env:VAR}` placeholders in JSON, not raw in config files.

## [0.3.2] — 2026-07-09

### 📝 Docs & Package Cleanup

- **README agent visibility corrected**: The "Model slots vs registered agents" note now accurately states that build/plan/explore/general ARE upgraded as native agents in `src/index.ts` (plan and general visible; build and explore hidden).
- **Mode-Based Task Routing table**: Replaced 11-entry dead table (which included unordered modes like artistry, git, bounded, cross-module, unspecified-low, unspecified-high) with Bob's 5 actual categories (quick→general, deep→build, visual-engineering→designer, writing→writer, ultrabrain→plan) plus explicit delegation categories (review→critic, research→explore, browser→vision).
- **Section reorder**: Post-Install Setup moved immediately after Install (was 255 lines later after Architecture).
- **Sequential-Thinking MCP label**: Updated to "MCP (local via npx @modelcontextprotocol/server-sequential-thinking)".
- **AGENTS.md task routing**: Replaced dead mode references with accurate category routing table matching Bob's prompt.
- **Package cleanup**: Removed CHANGELOG.md, CODE_OF_CONDUCT.md, CONTRIBUTING.md, SECURITY.md from npm `files` array (GitHub-only docs). Removed `mempalace` from keywords.
- **Stale docs removed**: `docs/ROADMAP.md` and `docs/hiai-opencode/release-notes-v0.2.5.md` deleted (outdated, superseded by CHANGELOG).

## [0.3.1] — 2026-07-09

### 🐛 Fixes

- **README agent count corrected**: `createAllAgents()` registers 8 agents (bob, manager, critic, writer, designer, vision, dream-consolidator, distill-packager), not 10. bob.json additionally defines 10 configurable model slots including build, plan, explore, general as internal routing targets.
- **README agent table corrected**: Fixed mode/visibility for all 8 registered agents. Removed phantom entries (build, plan, explore, general) that are model slots but not separate registrations. Updated footnote to reflect source truth.
- **Nonexistent file references removed**: `src/shared/agent-display-names.ts` and `src/shared/migration/agent-names.ts` do not exist; references removed from README, AGENTS.md, ARCHITECTURE.md, and CONTRIBUTING.md.
- **AGENTS.md "Expected Agent State" corrected**: Section now reflects actual `createAllAgents()` registration (8 agents) vs bob.json model slots (10 slots). Legacy migration note updated.
- **CI/Windows path fix**: GitHub Actions CI workflow corrected to handle Windows path format in `acb9c03`.

### 🔧 Lint Improvements

- Removed unused imports: `markCompleted` (loop.ts), `BobConfig, HookSet` (quality-gate.test.ts), `existsSync` (lsp.test.ts)
- Prefixed intentionally unused variables with underscore: `_id`, `_messageID`, `_agent`, `_name`, `_root`, `_ActorPostStopRegistration`
- Fixed template literals in test code
- Fixed `Number.parseInt` missing radix parameter (lsp-client.ts)
- Fixed computed key literal (lsp.test.ts)

## [0.3.0] — 2026-07-09

### 🏗️ Complete Rewrite — plugin-bob Architecture

- **Architecture**: Clean-slate rewrite. Migrated from legacy multi-plugin architecture to unified `BobPlugin` orchestrator.
- **Agents**: 10 specialized agents (bob, plan, general, build, explore, manager, critic, writer, designer, vision) with role-based prompts.
- **Tools**: 6 LSP tools, 14 agent-browser tools, Firecrawl (scrape/search/map), Memory (BM25 FTS5), 4 Session tools, Background task management.
- **Hooks**: 30+ runtime hooks (loop, session-recovery, context-window-limit-recovery, caveman protocol, quality-gate, closure-injector, edit-error-recovery, json-error-recovery, token-budget, model-fallback, preemptive-compaction, etc.).
- **Protocol**: Caveman internal protocol for plan serialization and execution.
- **Memory**: SQLite FTS5 BM25 backend at `~/.hiai-opencode/data/hiai-memory.db`.
- **Telemetry**: OpenTelemetry integration for metrics and tracing.

### 🔄 Migration from 0.2.9

- Data directory moved: `~/.hiai-bob/` → `~/.hiai-opencode/`
- Config directory moved: `$XDG_CONFIG_HOME/hiai-bob/` → `$XDG_CONFIG_HOME/hiai-opencode/`
- Install: `opencode plugin @hiai-gg/hiai-opencode@latest --global`
- All agent names, tool names, and hook names preserved where possible.
- Removed: Playwright integration (replaced by agent-browser CLI).
- Removed: design-systems/, prompt-templates/, craft/ (open-design artifacts — available separately).

### 📦 Dependencies

- Runtime: `@opencode-ai/plugin ^1.17.0`, `@opentelemetry/api ^1.9.1`, `drizzle-orm ^0.45.2`
- Dev: `@biomejs/biome ^2.4.15`, `bun-types ^1.3.0`, `typescript ^5.7.0`

### 🔧 Key Fixes in 0.3.0

- **Caveman writer exclusion**: Writer agent excluded from Caveman compression for full-context content work.
- **BackgroundManager sanitizer**: Circuit breaker (20 consecutive same-tool, 4000 total, 5 concurrent) prevents runaway subagents.
- **Vision/General browser gate**: Vision owns browser verification; General/Sub gets Sub as fallback when Vision unavailable.
- **Playwright/Puppeteer ban**: Agent-browser CLI is the sole browser automation tool — no Playwright, no Puppeteer.
- **context7 hardened**: Removed from MCP registry; on-demand CLI skill via `skill("explore/context7")`, requires `CONTEXT7_API_KEY`.
- **firecrawl**: CLI-only (not MCP), requires `FIRECRAWL_API_KEY`, with 3 dedicated tools (scrape, search, map).
- **Environment hardening**: bob.env loaded from 7-layer priority path (project → .opencode/ → ~/.config/hiai-opencode/ → plugin root), existing process.env values preserved.

## [0.2.9] — 2026-06-12

### Fixed
- **Reasoning models (GLM/z.ai, DeepSeek and other OpenAI-compatible reasoning endpoints) no longer reject delegated/multi-step turns with `thinking is enabled but reasoning_content is missing in assistant tool call message at index N`.** The OpenCode runtime builds the outgoing `reasoning_content` field **only** from an assistant message part of `type: "reasoning"` — an `info.reasoning_content` field is ignored. After history rewrites (delegation, context injection, truncation) an assistant message could reach the provider carrying `tool_calls` but no reasoning part, which these providers reject when thinking is enabled. The `reasoning-content-cache` transform hook now operates at the **parts** layer: it captures reasoning from parts (not just the legacy `info` field), and guarantees every tool-call assistant message has a non-empty `{type:"reasoning"}` part — restored from cache when available, otherwise a neutral placeholder. This also fixes the prior cache being a no-op against the provider (it only wrote `info.reasoning_content`, which the runtime never reads). Scoped to OpenAI-compatible (unsigned) reasoning sessions only; Anthropic signed-thinking flows are left untouched (owned by `thinking-block-validator`, since signatures cannot be fabricated).

## [0.2.8] — 2026-06-10

### Fixed
- **Sub-agent delegation no longer crashes the whole session with `Worker has been terminated`.** When a delegated sub-agent session ends or is aborted, the OpenCode runtime can `write()` to an already-destroyed stream, throwing an unhandled `Cannot call write after a stream was destroyed` (`ERR_STREAM_DESTROYED`). With no `unhandledRejection` listener, Bun terminated the worker running the `task` tool, killing the parent session. The error originates entirely in the runtime bundle (`/$bunfs/...`) with no plugin frames, and OpenCode does not persist it to its file logs. Added a narrowly-scoped process guard (`src/shared/runtime-stream-teardown-guard.ts`) that swallows only this benign stream-teardown race and re-throws every other rejection, so genuine bugs still surface. Upstream OpenCode bug; this is a plugin-side mitigation.

- **Nested delegators (e.g. Bob→Manager→children) now wait for and catch their delegated children.** A delegating sub-agent that itself launched background tasks was reported complete — and its session aborted — before those children finished, so it never received their results. Both completion chokepoints now defer while a session has active (`running`/`pending`) background descendants: `BackgroundManager.tryCompleteTask` (background delegation) via the new `hasPendingDescendantTasks()`, and the `delegate-task` sync poller (`pollSyncSession`, which governs Manager since Bob delegates it `run_in_background=false`). The idle/poll loops retry once children finish; stale children are TTL-pruned, so there is no deadlock. The `call-hiai-agent` path is unaffected — agents it spawns get `task: false` and cannot create background descendants.
- **Bob and Manager no longer over-route simple tasks to Coder.** Bob's prompt had no positive rule for choosing Sub on the initial dispatch (Sub appeared only in the failover chain), and Manager's "never default to Coder" was a soft trailing note. Added an explicit Executor-selection rule to Bob (`src/agents/bob/core.ts`) and hardened Manager's routing gate (`src/agents/manager/default-prompt-sections.ts`) with a prefer-Sub default and prohibition framing: simple fix (1-2 files) → Sub (`category="quick"`), complex/multi-file → Coder (`category="deep"`).

### Changed
- Bumped `@opencode-ai/plugin` and `@opencode-ai/sdk` to `^1.17.1` to match the OpenCode runtime.

## [0.2.7] — 2026-06-10

### Fixed
- **`supabase-postgres` skill now ships to installed users.** It lived only in the repo's local `.opencode/skills/` view, but the plugin skill materializer reads `pluginRoot/skills`, so installed users never received it — even though the Researcher/Writer prompts instruct agents to load it. Relocated to `skills/supabase-postgres/` alongside the other bundled skills.

### Removed
- **husky + commitlint** removed entirely. The `pre-commit` hook ran the full test suite and blocked commits; CI already gates typecheck/test/lint. Deleted `.husky/`, `commitlint.config.js`, the `prepare` script, and the `husky` / `@commitlint/*` devDependencies.

### Changed
- `.opencode/` is now fully gitignored (removed the `!.opencode/skills` exception); dropped `.opencode/skills/` from package `files`.

## [0.2.6] — 2026-06-10

### Added
- **Vision browser-verification delegation category** — `browser-verification` / `ui-inspection` / `screenshot` modes route to the Vision agent with an observation-only prompt (navigate, screenshot, compare, report; no code edits). New `src/tools/delegate-task/vision-categories.ts`.
- **`README.md` Roadmap section** — future-oriented features list. (Note: `docs/ROADMAP.md` was a separate deep-dive file removed in v0.3.2 as stale.)

### Changed
- Prompt/permission refinements across manager, researcher, postgres-rules, messages-transform, agent-tool-restrictions, and permission-compat; snapshots regenerated. Test count 1839 → 1989.
- Hardened `scripts/db-content-update.sh`.

### Infrastructure
- **npm publish now uses OIDC trusted publishing** (tokenless) via `release.yml` — removes the account-2FA `EOTP` failures; node 22 + `npm@latest` (OIDC needs npm ≥ 11.5.1), provenance retained.
- **Fixed CI lint (exit 127)** — `@biomejs/biome` was missing from `package.json`/`bun.lock`, so `bun install --frozen-lockfile` never installed it; added as a devDependency.
- Untracked local agent state (`.bob/`, `todo.md`); added `PRs welcome` badge.

## [0.2.5] — 2026-06-09

### Added
- **MemPalace canonical taxonomy** — single source of truth (14 structured rooms + diary). File: `src/agents/prompt-library/mempalace-taxonomy.ts`. All agent prompts updated.
- **Manager complexity routing** — Bob dispatch threshold (5+ todos OR 3+ parallel units) MUST DELEGATE to Manager. Pre-Implementation Trigger section added to Bob prompt. Routing Gate section in Manager prompt distinguishes Sub (1-2 files, simple) from Coder (3+ files, complex).
- **Critic mandatory completion gate** — Critic verification REQUIRED before completion (both inline + shared-execution copies).
- **Postgres content-update rules** — agents use direct psql via `scripts/db-content-update.sh` wrapper. NEVER create new `.sql` migration files for content.
- **Biome lint+format rules** in Coder and Critic prompts — Coder must run `bun run lint && bun run format:check` before completion; Critic REJECTS on gate failure.
- **agent-tool-permission hook** — runtime enforcement of `CANONICAL_AGENT_RESTRICTIONS` for primary sessions (closes gap where restrictions only applied to subagent sessions).
- **Session work accumulation** — progressive work-in-progress tracking across agent sessions.
- **`minimum_idle_ms` config** for ralph_loop to prevent premature continuation.
- **CODEOWNERS file** for PR routing.
- **commitlint + husky** for conventional commit enforcement.

### Fixed
- **CRITICAL: MemPalace auto-save hook** — switched from `mempalace_diary_write` to `mempalace_add_drawer` so room routing works correctly (was silently dropping room categorization).
- **MemPalace `kg_add` syntax** in Researcher prompt — was non-functional (missing `skill_mcp()` wrapper).
- **MemPalace `add_drawer` syntax** in save checklist — was non-functional.
- **Critic verification** made a MANDATORY completion gate (both prompt copies updated).
- **Bob plan-writing prohibition** — explicit rule preventing Bob from writing plan files.
- **Bob self-delegation enforcement** — re-enabled dead `plannerSection`, strengthened Manager threshold to MUST-DELEGATE.
- **Manager dispatch threshold** — strengthened from advisory to MUST.
- **Background agent notification** — switched from `promptAsync` to `prompt` with timeout.
- **hiia-opencode-setup skill taxonomy** — replaced 6 wrong `project-aspect` room names with canonical 15-room taxonomy (prevents data loss).
- **Several lint/format issues** — biome gates now clean.

### Changed
- **4 dead exports** removed from `dynamic-agent-policy-sections` (`buildMemorySection`, `buildToolCallFormatSection`, `buildUltraworkSection`, `buildToolUsageRulesSection`).
- **`UNIFIED_STRATEGIST_PROMPT` const + `prompt-library/index.ts` barrel** removed (dead code, 0 imports).
- **51 dead source files** removed (knip-detected).
- **6 production `console.log` debug statements** removed from `dev-browser.ts` skill.
- **README.md, ARCHITECTURE.md, src/AGENTS.md** updated with 0.2.5 features.
- **Hook counts** corrected across all docs (actual: 51, was: 52-53).
- **CI lint check** made fatal (removed `||` fallback).
- **e2e-smoke-test.sh thresholds** updated to 120% of measured actual prompt sizes.

### Removed
- 51 dead source files
- 4 dead exports from `dynamic-agent-policy-sections`
- 1 dead const (`UNIFIED_STRATEGIST_PROMPT`)
- 1 dead barrel file (`prompt-library/index.ts`)

### Security
- **15 npm vulnerabilities** addressed: 2 high (jsdiff DoS), 11 moderate (hono, ip-address, uuid). Mostly transitive deps resolved via `bun update @opencode-ai/*` to 1.16.2.

### Infrastructure
- **`.github/workflows/release.yml`** added for tag-triggered release pipeline.
- **`.gitignore`** updated to exclude `.runtime-cache/` and `.npm-cache/`.
- **Snapshot tests** regenerated and CI-strict mode passes.

### Contributors
- 44 commits since 0.2.4
- 78 files changed
- +2,969 / -417 lines

## [0.2.4] — 2026-06-07

### Changed
- **Bob agent unified** — removed Claude/GPT model-specific variants:
  - Deleted `src/agents/bob/claude.ts` and `src/agents/bob/gpt.ts` (125 lines of duplication)
  - Created unified `src/agents/bob/agent.ts` with model-agnostic factory
  - Removed `isNonClaude` conditionals from dynamic prompt sections
  - Restored `buildDelegationWarningSection` in `buildHardRulesSection()`
  - All 5 mandatory delegation rules present in Bob prompt
  - Model-specific thinking config handled by OpenCode runtime
- **Documentation updated** — `AGENTS.md` and `ARCHITECTURE.md` references updated

## [0.2.3] — 2026-06-07

### Fixed
- **config/ npm leak (BLOCKER)**: Runtime artifacts (`config/.logs/`, `config/.mcp.json`, `config/.opencode/`) no longer ship in npm tarball. `package.json` `files` array now lists only `config/hiai-opencode.schema.json` and `config/opencode.json`. Added `.npmignore` as belt-and-suspenders.
- **execSync shell injection (MEDIUM)**: Two `execSync` calls with user-derived input converted to `execFileSync` (no shell):
  - `src/hooks/start-work/git-operations.ts:134` — `git merge` with `targetBranch`
  - `src/features/boulder-state/storage.ts:621` — `git worktree remove` with `worktreePath`
- **Stale package-lock.json deleted**: Project uses bun.lock; stale npm lockfile removed.

## [0.2.3] — 2026-06-06

### Changes
- **Skill rename**: `supabase-postgres-best-practices` → `supabase-postgres` (shorter, matches agent prompt references)
  - `src/agents/researcher.ts` — MANDATORY skill reference updated
  - `src/agents/writer.ts` — architecture context lookup updated
  - `.opencode/skills/supabase-postgres/SKILL.md` — frontmatter `name:` updated
- **Mempalace pinned to 3.4.0** (was 3.3.4) — `assets/mcp/mempalace.mjs` launcher still uses `>=3.3.0` floor; new venv at `projects/hiai-opencode/.venv/` resolves to 3.4.0
- **9 skills imported into plugin** from `~/.agents/skills/` (were hidden by `global_agents: false`, now part of packaged distribution):
  - Stitch workflow: `stitch-design`, `stitch-loop`, `design-md`, `enhance-prompt`, `taste-design`
  - Component generation: `shadcn-ui`, `react-components`
  - Video: `remotion`
  - Discovery: `find-skills`
- **Stale DB table references fixed** in `src/agents/researcher.ts`:
  - `project_hierarchy` → `project_identity_map` (real table)
  - `vertex_build` → `task_runs` (real table)
  - `project_cycle_log` → `cost_history` (real table)
- Plugin venv is now self-contained at `projects/hiai-opencode/.venv/` for reproducible MemPalace runtime
- **open-design integration** (npm pack + skill wiring):
  - `package.json`: `design-systems/` and `prompt-templates/` added to `files` array (567 new entries in pack)
  - New skills: `open-design-landing`, `open-design-landing-deck` (brand landing page templates)
  - New: `templates/kami-deck.html` (Kami slide deck starter)
  - `src/agents/designer.ts` — Added `<design-systems>` section with 150+ brand discovery workflow
  - `src/agents/bob/core.ts` — Mandatory delegation rule 2 updated with design-systems awareness
  - `src/agents/manager/shared-prompt.ts` — Agent roster Designer entry updated with bundled design-systems note
  - Prompt baselines updated: designer 7202→7994, bob 12185→12355, manager 24754→24863
- Config schema: Fixed malformed JSON in `config/hiai-opencode.schema.json` (extra closing brace)

---

## [0.2.2] — 2026-05-24

### Breaking Changes
- **Removed `HIAI_PLAYWRIGHT_INSTALL_BROWSERS`** — no longer needed
- **Playwright MCP removed** — replaced by `agent-browser` CLI (vercel-labs/agent-browser)
- **`multimodal` renamed to `vision`** — all references across 16 files updated

### New in This Release

**open-design Integration**
- 48 design skills, 150+ brand design-systems (Apple, Linear, Stripe, Vercel, Airbnb, etc.)
- 12 craft guidelines (typography, color, UX, animation, accessibility)
- prompt-templates for image/video generation
- All sourced from [nexu-io/open-design](https://github.com/nexu-io/open-design) (Apache 2.0)

**Browser Automation (agent-browser)**
- Full `agent-browser` CLI documentation with 6 key environment variables:
  - `AGENT_BROWSER_HEADED`, `AGENT_BROWSER_SESSION`, `AGENT_BROWSER_PROFILE`
  - `AGENT_BROWSER_PROVIDER` (browserbase, browseruse, kernel)
  - `AGENT_BROWSER_AUTO_CONNECT`, `AGENT_BROWSER_EXECUTABLE_PATH`
- Install via `bun add -g agent-browser && agent-browser install` or `npm i -g agent-browser`

**Agent Architecture**
- Bob/Coder core+overlay split — model-specific overlays separated from shared prompt core
- event.ts extraction — 640→310 lines, handlers moved to `event-handlers/`
- manager.ts extraction — types + notifier moved to separate modules
- Shared execution module — `prompt-library/shared-execution.ts` with reusable prompt sections
- Intent gate — `prompt-library/intent-gate.ts` with router and executor variants
- Smoke test — `tests/integration/plugin-smoke.test.ts` with 43 checks

**Delegation Rules (Bob)**
- UX Verification Gate — never close UX task without Vision + agent-browser
- UX Development Gate — never do UX work without Designer + design skills
- Content Gate — all text/copy/translation goes to Writer

**Project Context (All Agents)**
- Bob now queries PostgreSQL/RAG + MemPalace before delegating
- Manager queries MemPalace + RAG before orchestrating
- Strategist queries MemPalace + RAG before planning
- All 10 visible agents check MemPalace at session start

**Vision Agent**
- Screenshot saving capability added
- agent-browser integration for live UI verification
- Renamed from `multimodal` across entire codebase

**Updated Upstream References**
- Firecrawl: `mendableai/firecrawl` → `firecrawl/firecrawl`
- Agent-browser: `vercel-labs/agent-browser` now documented
- Supabase Postgres skill: `supabase/agent-skills` added to attribution table

**Agent Count Accuracy**
- `14-agent canonical model (9 visible + 5 hidden)` — reflected across all docs
- `Quality Guardian` properly documented as hidden agent
- Removed phantom duplicate Manager row from agent table

### Changed
- **Schema** — Fixed stale model keys: guard→manager, brainstormer→writer, removed playwright, added firecrawl
- **.env.example** — Added CONTEXT7_API_KEY, HIAI_OPENCODE_LOG_LEVEL, PostgreSQL env vars
- **Build** — Scoped package to `@hiai-gg/hiai-opencode`, added bin CLI, minified build (2.69MB), prepublishOnly script
- **Logger** — Added log levels (debug/info/warn/error/silent), logDebug(), setLogLevel()
- **Error handling** — All 61 `.catch(() => {})` replaced with commented explanations across 28 files
- **Anti-duplication** — Compressed from 40 lines to 3 per agent
- **Tables → bullets** — Converted all markdown tables in agent prompts to compact bullet lists
- **Agent model resolution** — Agents no longer silently dropped when model resolution fails
- **Linter quality pass** — 27 files touched: nullish coalescing, import ordering, mechanical fixes

### Fixed
- **Vision agent not found** — Root cause: agent registered as "multimodal" but config used "vision"
- **Agent model resolution drop** — Agents without fallback chains now fall back to systemDefaultModel
- **68 failing tests** — All agent prompt section tests, closure protocol tests, snapshot tests fixed
- **Empty catch blocks** — 23→0 `catch {}` blocks, 61→0 `.catch(() => {})` patterns
- **Dead code** — Deleted orchestration.ts (1.8KB duplicate), bob.ts re-export
- **Schema validation** — Removed stale model keys, added missing entries
- **Memory leaks** — Agents losing project context; fixed with MemPalace + RAG checks

### Removed
- **Playwright MCP** — Replaced by agent-browser CLI
- **`HIAI_PLAYWRIGHT_INSTALL_BROWSERS`** — No longer needed
- **Unused `websearch` MCP** — Removed from architecture
- **`TAVILY_API_KEY` / `EXA_API_KEY`** — Removed unused env vars
- **NonClaudePlannerSection** — Removed from bob.ts, coder/gpt.ts
- **bob.ts re-export** — Replaced with bob/index.ts directory resolution
- **orchestration.ts** — Dead code, 100% duplicate

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
