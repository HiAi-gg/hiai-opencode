# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

---

## [0.3.0] — 2026-05-24

### Added
- **open-design integration** — 48 design skills, 150+ brand design-systems (Apple, Linear, Stripe, Vercel, Airbnb, etc.), 12 craft guidelines (typography, color, UX, animation, accessibility), prompt-templates for image/video generation. All sourced from [nexu-io/open-design](https://github.com/nexu-io/open-design) (Apache 2.0).
- **Designer agent research** — Deep integration plan for using design-systems library with the Designer agent
- **event-handlers/** — Extracted 5 files from event.ts: `session-error.ts` (117 lines), `message-updated.ts` (110 lines), `session-status.ts` (92 lines), `types.ts`, `utils.ts`
- **manager-types.ts** — Extracted types from BackgroundManager (MessagePartInfo, EventProperties, Todo, QueueItem, BackgroundEvent, etc.)
- **manager-notifier.ts** — Extracted notifyParentSession() + enqueueNotificationForParent() from BackgroundManager
- **Smoke test** — `tests/integration/plugin-smoke.test.ts` with 43 checks (build artifacts, agent factories, identity injection, permissions)
- **Shared execution module** — `prompt-library/shared-execution.ts` with buildSearchStopConditionsSection, buildDelegationPromptSection, buildSessionContinuitySection, buildFailureRecoverySection
- **Intent gate** — `prompt-library/intent-gate.ts` with router and executor variants
- **Changelog, Contributing, Security docs** — Full community documentation set

### Changed
- **Bob prompt** — Split into core+overlay architecture: `bob/core.ts` (16.5KB) + `bob/claude.ts` (1.9KB) + `bob/gpt.ts` (1.8KB). Was single 20KB file.
- **Coder prompt** — Split into core+overlay: `coder/core.ts` (10KB) + `coder/agent.ts` (3.9KB). Was 15KB single file.
- **event.ts** — Reduced from 640 to 310 lines (-52%) by extracting handlers to `event-handlers/`
- **manager.ts** — Reduced from 2223 to 1996 lines (-10%) by extracting types + notifier
- **Anti-duplication section** — Compressed from 40 lines to 3 lines (-1.2KB per agent)
- **Tables → bullets** — Converted all markdown tables in agent prompts to compact bullet lists (-1428 bytes across 6 files)
- **Schema** — Fixed stale model keys: guard→manager, brainstormer→writer, removed playwright, added firecrawl
- **.env.example** — Added CONTEXT7_API_KEY and HIAI_OPENCODE_LOG_LEVEL
- **Build** — Scoped package to `@hiai-gg/hiai-opencode`, added bin CLI, minified build (2.82MB), prepublishOnly script
- **Logger** — Added log levels (debug/info/warn/error/silent), logDebug(), setLogLevel(), restrictive file permissions
- **Error handling** — All 61 `.catch(() => {})` replaced with commented explanations across 28 files
- **Anti-duplication** — Compressed from 40 lines to 3 per agent
- **multimodal → vision** — Renamed across entire codebase: BuiltinAgentName, agentSources, config types, schemas, delegate-task aliases, display names, migration maps, tool restrictions (16 files)
- **Agent model resolution** — Agents no longer silently dropped when model resolution fails; systemDefaultModel used as fallback
- **Linter quality pass** — 27 files touched: nullish coalescing, import ordering, mechanical fixes
- **START.md** — Clean-machine install guide for @hiai-gg/hiai-opencode

### Fixed
- **Vision agent not found** — Root cause: agent registered as "multimodal" in agentSources but config used "vision". Bridged via legacy alias lookup in override/requirement resolution.
- **Agent model resolution drop** — Agents without fallback chains silently dropped from registry; now falls back to systemDefaultModel
- **68 failing tests** — All agent prompt section tests, closure protocol tests, snapshot tests, migration tests, boulder validation tests fixed
- **Empty catch blocks** — 23→0 `catch {}` blocks, 61→0 `.catch(() => {})` patterns
- **Dead code** — Deleted orchestration.ts (1.8KB duplicate), bob.ts re-export (301B)
- **Schema validation** — Removed stale model keys, added missing entries

### Removed
- **NonClaudePlannerSection** — Removed from bob.ts, bob/default.ts, bob/gpt-pro.ts, coder/gpt.ts
- **bob.ts re-export** — Replaced with bob/index.ts directory resolution
- **orchestration.ts** — Dead code, 100% duplicate of dynamic-agent-core-sections.ts

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
