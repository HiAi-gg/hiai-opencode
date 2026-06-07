# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
