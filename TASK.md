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
- [ ] **T6:** Create `/mnt/ai_data/.opencode/hiai-opencode.jsonc` with full agent/category/MCP/LSP config ⚠️ (file exists, not fully verified)
- [ ] **T7:** Set up test OpenCode copy in `~/hiai_test/`
- [ ] **T8:** Verify plugin loads in test copy — check agents, tools, hooks
- [ ] **T9:** Provide user with TUI launch command for test copy

## 8b. Critical Bug Fixes Applied

- [x] **FIX-1:** Removed `agentRequirements` from `src/config/default-config.json` (blocked plugin loading)
- [x] **FIX-2:** Changed PTYPlugin from static `import` to dynamic `await import()` with try-catch (catches import-time failure of bun-pty native library)
- [x] **FIX-3:** `bun run typecheck` passes
- [x] **FIX-4:** `bun run build` passes (1445 modules, 5.1 MB)
- [x] **FIX-5:** Bundle copied to `~/.cache/opencode/packages/hiai-opencode@latest/dist/`
