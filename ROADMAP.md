<!-- portfolio-audit:2026-09-13 -->
> **Source reconciliation — 2026-09-13:** Read [TEAM_BACKLOG.md](TEAM_BACKLOG.md) before using the tasks/status below. Version 0.6.6 remains; old README test counts and DEV-01 browser bootstrap must be checked against current scripts. Runtime/remote-CI claims retain their original dates; they were not revalidated in this pass. The linked task ledger holds execution status; this document retains its original product direction/history.

# ROADMAP — hiai-opencode
Date: 2026-09-05 · HEAD `cfa8185` · origin HiAi-gg/hiai-opencode · branch main
Live: none (npm `@hiai-gg/hiai-opencode@0.6.6`) · LAN `/hiai-opencode/` is source browse · not a VPS app

## Snapshot

OpenCode plugin (`@hiai-gg/hiai-opencode` 0.6.6, MIT) that registers Bob plus plan / build / critic / vision / designer / writer / manager / explore / general, with plan-lifecycle freeze, one delivery Critic, completion-controller quality + LSP gates, and a `hiai-opencode` CLI (`doctor`, `up`/`down`). It is not an HTTP product and must not be provisioned as `portfolio@hiai-opencode`. npm `latest` is the tagged `v0.6.6` (2026-08-26). HEAD is one unpublished chore past that tag (TypeScript 6 / Drizzle 0.45.2, keep `.env.example` tracked). CI on HEAD is green.

## Evidence

- Code: `src/index.ts`, `src/agents/`, `src/features/plan-lifecycle/`, `src/features/completion-controller/`, `src/hooks/plan-lifecycle-gate.ts`, `assets/cli/hiai-opencode.mjs`, `bob.json`
- Live/LAN: no listening port; Caddy `file_server browse`. npm 0.6.6 matches `package.json`
- CI: `.github/workflows/ci.yml` + `release.yml` — workflows install Bun `1.4.x` (approved DEV-01). A passing GitHub run was not revalidated in this pass.
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
4. **Track OpenCode host API drift** — `@opencode-ai/plugin` surface moves; keep `bun test` + `hiai-opencode doctor` as the gate. Ready when `doctor` stays non-zero on hard failures.
5. **Publish only when there is a user-facing change** — HEAD pin plus this docs/CI pass; npm 0.6.6 is enough until the next real release.

## Later / Not doing

- Do not provision `portfolio@hiai-opencode` or deploy to Coolify / any VPS
- Engineering SSH / remote executors stay out
- Skill marketplace, agent analytics, and Observe telemetry export are optional later — not blockers for the plugin
