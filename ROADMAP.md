<!-- portfolio-audit:2026-09-13 -->
> **Source reconciliation — 2026-09-15:** Read [TEAM_BACKLOG.md](TEAM_BACKLOG.md) before using the tasks/status below. Version 0.6.6 remains. GitHub CI on `6b493cc` succeeded (run 34766718339, Ubuntu/Windows/macOS + static checks). npm `latest` is still the tagged `v0.6.6`. This pass does not publish. The linked task ledger holds execution status.

# ROADMAP — hiai-opencode
Date: 2026-09-15 · HEAD `6b493cc` · origin HiAi-gg/hiai-opencode · branch main
Live: none (npm `@hiai-gg/hiai-opencode@0.6.6`) · LAN `/hiai-opencode/` is source browse · not a VPS app

## Snapshot

OpenCode plugin (`@hiai-gg/hiai-opencode` 0.6.6, MIT) that registers Bob plus plan / build / critic / vision / designer / writer / manager / explore / general, with plan-lifecycle freeze, one delivery Critic, completion-controller quality + LSP gates, and a `hiai-opencode` CLI (`doctor`, `up`/`down`). It is not an HTTP product and must not be provisioned as `portfolio@hiai-opencode`. npm `latest` is the tagged `v0.6.6` (2026-08-26). HEAD `6b493cc` is unpublished source past that tag (TypeScript 6, doctor hard-fail, Lightpanda docs). This pass adds isolated-PATH doctor proof and `ROADMAP.md` in the npm `files` allowlist. CI on `6b493cc` is green.

## Evidence

- Code: `src/index.ts`, `src/agents/`, `src/features/plan-lifecycle/`, `src/features/completion-controller/`, `src/hooks/plan-lifecycle-gate.ts`, `assets/cli/hiai-opencode.mjs`, `bob.json`
- Live/LAN: no listening port; Caddy `file_server browse`. npm 0.6.6 matches `package.json`
- CI: `.github/workflows/ci.yml` + `release.yml` — workflows install Bun `1.4.x` (approved DEV-01). GitHub run 34766718339 on `6b493cc` succeeded (2026-09-13).
- Docs (reconciled 2026-09-13):
  - `README.md` Quick start no longer hard-codes a test count; Roadmap points at this file
  - `AGENTS.md` workstation bootstrap installs Lightpanda only and does not run `agent-browser install` (Chrome). Public README still documents Chrome as an upstream-host option

## Now

- Published plugin + CLI; plan freeze, delivery Critic, quality/LSP/legal/circuit-breaker gates are in source and covered by tests
- Lightpanda is auto-selected when its binary is on PATH; Chrome is not hardcoded (`src/shared/agent-browser-engine.ts`)
- `.env.example` is tracked; `bob.env` stays gitignored
- Tag `v0.6.6` / npm 0.6.6 / README install path `opencode plugin @hiai-gg/hiai-opencode@latest --global`

## Next

1. ~~Rewrite `README.md` (test count + Roadmap section)~~ — done in the 2026-09-13 pass; still no version bump.
2. ~~Rewrite `AGENTS.md` browser bootstrap~~ — DEV-01 Lightpanda only; Chrome remains an upstream-host option in README.
3. ~~Align CI Bun~~ — `ci.yml` / `release.yml` use `1.4.x`. A live GitHub Actions run is still pending coordinator.
4. **Track OpenCode host API drift** — `@opencode-ai/plugin` is pinned at `^1.18.21` (resolved 1.18.21). npm latest observed **2026-09-15** is `1.18.31` (patch series 1.18.22–1.18.31 unpublished here). Keep `bun test` + `hiai-opencode doctor` as the gate. Do not bump the pin without a typecheck/test pass against the new types and a user-facing release. Ready when `doctor` stays non-zero on hard failures.
5. **Publish only when there is a user-facing change** — HEAD pin plus this docs/CI pass; npm 0.6.6 is enough until the next real release. `ROADMAP.md` is now in `package.json` `files` so the next publish ships the README link.

## Later / Not doing

- Do not provision `portfolio@hiai-opencode` or deploy to Coolify / any VPS
- Engineering SSH / remote executors stay out
- Skill marketplace, agent analytics, and Observe telemetry export are optional later — not blockers for the plugin
