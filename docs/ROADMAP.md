# Roadmap

What's worth building next for `hiai-opencode`, grouped by phase and roughly
prioritized. This is a living document — open an issue to propose or reprioritize
items. Completed work lives in [CHANGELOG.md](../CHANGELOG.md) and `log.md`.

**Legend:** 🔴 urgent · 🟡 medium · 🟢 nice-to-have · ✅ done

**Dependency chains** (read these before starting work):
- `QW-AUTOPUB` → `PM-PROVENANCE` (unblock CI publish before chasing signed releases)
- `PM-BGMGR` → `PM-COVERAGE` (finish the manager refactor before raising coverage on it)
- `PM-OBSERVE` → `SI-TELEMETRY` (wire a single trace export before building analytics on top)

---

## ✅ Recently shipped (0.2.4 → 0.2.5)

| Item | Version | Notes |
|---|---|---|
| **MemPalace canonical taxonomy** (14 rooms + diary, single source of truth) | 0.2.5 | All agent prompts updated; auto-save hook fixed (`mempalace_add_drawer`) |
| **Manager complexity routing** (Bob MUST-DELEGATE at 5+ todos / 3+ parallel) | 0.2.5 | Sub vs Coder routing gate |
| **Critic mandatory completion gate** | 0.2.5 | Verification required before completion (both prompt copies) |
| **agent-tool-permission hook** | 0.2.5 | Runtime enforcement of `CANONICAL_AGENT_RESTRICTIONS` for primary sessions |
| **Postgres content-update rules** + `db-content-update.sh` | 0.2.5 | Direct psql; no ad-hoc `.sql` migrations for content |
| **Biome lint+format gates** in Coder/Critic | 0.2.5 | CI lint made fatal |
| **Dead-code purge** (51 source files, 4 exports, 1 barrel) | 0.2.5 | knip-detected |
| **15 npm vulnerabilities resolved** (2 high, 11 moderate) | 0.2.5 | `bun update @opencode-ai/*` → 1.16.2 |
| **Tag-triggered release pipeline** (`.github/workflows/release.yml`) | 0.2.5 | npm + GitHub release; first npm publish of `@hiai-gg/hiai-opencode` |
| **Bob/Coder prompt compression** (Bob 20→12.3KB, Coder 15→9.2KB) | 0.2.5 | `shared-execution.ts` wired, tables→bullets |

---

## ⚡ Phase 1: Quick Wins (ship this cycle, ≤4h each)

### 🔴 Critical

| ID | Task | Est. | Why | Depends On |
|---|---|---|---|---|
| **QW-AUTOPUB** | Make CI `release.yml` publish to npm unattended (currently blocked by account-level 2FA-on-write → EOTP; 0.2.5 was published manually) | 1h | Removes the manual recovery-code step from every release | — |
| **QW-T35** | E2E smoke on a clean Linux + OpenCode runtime: install the published package, confirm all 9 visible agents register and MCP servers resolve | 3h | The only "READY but unverified" item from the audit | QW-AUTOPUB |

### 🟡 Important

| ID | Task | Est. |
|---|---|---|
| **QW-NODE24** | Bump GitHub Actions off the deprecated Node 20 runner (`setup-node@v4` warns; forced to Node 24 on 2026-06-16) | 30min |
| **QW-DOCTOR** | Expand `hiai-opencode doctor` / `mcp-status` output (per-MCP reachability, missing-key hints without printing secrets) | 3h |
| **QW-ROADMAP-LINK** | Cross-link this ROADMAP from README + Documentation Map | ✅ done |

### 🟢 Nice-to-have

| ID | Task | Est. |
|---|---|---|
| **QW-SKILL-DOC** | One-page "writing a bundled skill" guide (skill layout, discovery, permissions) | 2h |
| **QW-DS-INDEX** | Generate a browsable index of the 150+ bundled design systems | 2h |

---

## 🔧 Phase 2: Platform Maturation (1-4 days each)

| ID | Task | Priority | Days | Depends On |
|---|---|---|---|---|
| **PM-BGMGR** | Finish the BackgroundManager refactor: adopt `TaskPollingManager`, extract `event-handler.ts` / `task-cancellation.ts` / `session-observer.ts` (target ≤1400 lines, currently 1726) | 🔴 | 3d | — |
| **PM-COVERAGE** | Raise test count 1839 → 2000+ and coverage toward 20%, focused on `manager.ts`, hooks, and delegation routing | 🟡 | 3d | PM-BGMGR |
| **PM-PROVENANCE** | Publish with sigstore provenance from CI once `QW-AUTOPUB` lands (badge + supply-chain attestation) | 🟡 | 0.5d | QW-AUTOPUB |
| **PM-AGENTS** | Configurable agent roster — let users enable/disable hidden agents and remap mode→agent routing from `hiai-opencode.json` | 🟡 | 2d | — |
| **PM-MCP** | Add/curate more first-class MCP launchers and document per-agent ownership; health-gate degraded servers | 🟡 | 2d | QW-DOCTOR |
| **PM-LSP** | Broaden LSP defaults (Python/Pyright depth, Go, Rust, JSON/YAML) with per-language enable flags | 🟢 | 2d | — |
| **PM-OBSERVE** | Optional run telemetry export to [HiAi Observe](https://github.com/HiAi-gg/hiai-observe) — agent/tool spans + token usage via OTLP, opt-in | 🟡 | 2d | — |
| **PM-WIN** | Windows / non-tmux session support (the tmux pane model assumes a Unix terminal multiplexer) | 🟢 | 3d | — |
| **PM-COMPAT** | OpenCode version-compatibility matrix + a compat check in `doctor` (pin tested `@opencode-ai/*` ranges) | 🟡 | 1d | — |

---

## 🚀 Phase 3: Strategic Initiatives (weeks)

| ID | Task | Weeks | Depends On |
|---|---|---|---|
| **SI-TELEMETRY** | Agent analytics dashboard — per-agent cost/latency/delegation-depth, loop-guard trips, compaction frequency (built on `PM-OBSERVE`) | 3w | PM-OBSERVE |
| **SI-MARKETPLACE** | Skill + design-system marketplace — discover, install, and update bundled/3rd-party skills and design systems from a registry | 4w | QW-SKILL-DOC |
| **SI-EVAL** | Prompt/agent regression harness — score routing decisions and prompt changes against a fixed task suite to catch quality drift | 3w | PM-COVERAGE |
| **SI-MULTIMODEL** | First-class multi-provider routing presets (Claude / GPT / local) with per-agent model policy, beyond the current overlay split | 2w | — |

---

## 📈 KPI Targets

| Metric | Current (0.2.5) | Next | Later |
|---|---|---|---|
| Test count | 1839 (0 fail, 3 skip) | 2000+ | 2500+ |
| Test coverage | ~7% (54 test files) | 20%+ | 35%+ |
| BackgroundManager lines | 1726 | ≤1400 | ≤1200 |
| Typecheck errors | 0 | 0 | 0 |
| `as any` casts | 1 (documented) | ≤1 | 0 |
| Security vulnerabilities | 0 | 0 | 0 |
| Bundle size | 2.68 MB | <3 MB | <2.5 MB |
| npm publish | manual (recovery OTP) | automated CI | automated + provenance |
| Bob prompt size | 12.3 KB | ≤12 KB | ≤11 KB |
| E2E clean-machine verification | pending (T35) | gated in CI | nightly |

---

## 🗂️ Integration with existing docs

| Doc | Purpose | Status |
|---|---|---|
| `README.md` | Public landing + install | ✅ current (0.2.5) |
| `AGENTS.md` | Operator playbook / agent manual | ✅ current |
| `ARCHITECTURE.md` | System overview | ✅ current |
| `CHANGELOG.md` | Version history | ✅ current |
| `docs/quickstart.md` | First-run guide | ✅ current |
| `docs/HOOKS.md` / `HOOK_TIMINGS.md` | Hook reference | ✅ current |
| `docs/PERMISSIONS.md` | Agent permission model | ✅ current |
| `docs/hiai-opencode/adr/` | Architecture decisions | ✅ current |
| `docs/ROADMAP.md` | This file | ✅ new |

---

## 🛠️ Quick reference: how to pick up an item

1. Find the ID (e.g. `PM-BGMGR`) in the table above.
2. Check the `Depends On` column — is the dependency shipped?
3. Open an issue or branch with the ID as the prefix.
4. Update this file: move the item to `✅ Recently shipped` with the version tag.
