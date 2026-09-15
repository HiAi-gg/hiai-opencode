# Team backlog — hiai-opencode

Source audit: **2026-09-15**. Kind: **plugin**.
Baseline HEAD: `6b493cc4e4fb36e4edd59a48efbf282a67303a09`; branch: `main`.

Coordination and acceptance: [TEAM_HANDOFF.md](../TEAM_HANDOFF.md).

## Current reconciliation

Version 0.6.6 remains. 2026-09-15 pass: isolate doctor Lightpanda PATH so missing-binary is actually proven; include `ROADMAP.md` in npm `files`; record `@opencode-ai/plugin` 1.18.21 vs npm latest 1.18.31 without bumping. No publish, no tag, no OpenCode runtime certification.

2026-09-13 pass (committed as `6b493cc`): doctor hard-fail tests, Lightpanda-vs-Chrome docs split, README test-count/Roadmap, CI Bun 1.4.x. GitHub CI on that SHA succeeded.

Source checks support review, not runtime/visual/production certification. Coordinator alone marks accepted.

Recent local commits:

- `6b493cc Make doctor fail on invalid configuration and verify workstation guidance`
- `cfa8185 chore: pin TypeScript 6 / Drizzle 0.45.2 and keep .env.example tracked`
- `d17bf65 chore(release): v0.6.6`

Pre-existing Git status: **1 changed/untracked entries** before this audit. Preserve them; the baseline inventory records paths, not secret contents.

## Read first

- [ROADMAP.md](ROADMAP.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [README.md](README.md)
- [AGENTS.md](AGENTS.md)
- [scripts](scripts)
- [src](src)
- [.github/workflows](.github/workflows)

## Dependencies and scope

No cross-project implementation dependency assigned in this pass.
Use isolated fixtures. No production change, DNS, publishing, real messages or financial action is implied.

## Task ledger

Effort is a planning estimate, not a deadline. Confirm the first task baseline before implementation; already implemented work becomes verification.

### HIAI-OPENCODE-T01 — Verify orchestration gates and doctor diagnostics

- [x] **P1** · status: **accepted** · owner: **grok** · effort: M: about 0.5-1 day
- Depends on: current baseline and cited source inspection.
- Acceptance: Hard failures exit nonzero; plan/worker/review ownership and permission boundaries preserved.
- Evidence: `bun test` 1102 pass / 0 fail; doctor tests assert exit 1 on missing core models, unparseable `bob.json`, invalid `subagent_depth`, stale managed `.mcp.json`; exit 0 with complete models (Lightpanda absence is info). `src/permissions.test.ts` spawn matrix unchanged. Coordinator accepts.
- Delivery: [docs/acceptance/GROK-20260913.md](docs/acceptance/GROK-20260913.md).

### HIAI-OPENCODE-T02 — Separate DEV-01 Lightpanda requirements from upstream browser options

- [x] **P2** · status: **accepted** · owner: **grok** · effort: M-L: about 1-2 days
- Depends on: HIAI-OPENCODE-T01.
- Acceptance: Workstation docs do not install Chrome; unsupported visual APIs recorded; upstream user options remain accurately documented.
- Evidence: `AGENTS.md` bootstrap does not run `agent-browser install`; Lightpanda unsupported table recorded; README still documents `agent-browser install` as upstream Chrome. `scripts/check-docs.ts` gates that split. No Chrome installed. No visual verification claimed.
- Delivery: [docs/acceptance/GROK-20260913.md](docs/acceptance/GROK-20260913.md).

### HIAI-OPENCODE-T03 — Run docs/bundle/type/test gates and reconcile versions

- [x] **P2** · status: **accepted** · owner: **grok** · effort: M-L: about 1-2 days
- Depends on: HIAI-OPENCODE-T01.
- Acceptance: check:docs, typecheck, test and package checks recorded; CI Bun matches approved environment; no publish without a user-facing release.
- Evidence: `bun run check:docs` 0; `bun run typecheck` 0; `bun test` 1102/0; `bun run ci` 0 (183 files); `bun run build` 0; `bun run check:bundle-size` 0 (897.3 KB). CI/release Bun `1.4.x`; local Bun 1.4.0. Version 0.6.6, no publish. `npm pack` dry-run not repeated after permission denial. `run-check.py` blocked (EACCES on check-slots).
- Delivery: [docs/acceptance/GROK-20260913.md](docs/acceptance/GROK-20260913.md).

### HIAI-OPENCODE-T04 — Prove missing-Lightpanda doctor path and ship ROADMAP in the package

- [x] **P2** · status: **review** · owner: **grok** · effort: S: about 0.5 day
- Depends on: HIAI-OPENCODE-T01, HIAI-OPENCODE-T03.
- Acceptance: Doctor healthy-exit fixture does not inherit host PATH; missing Lightpanda is info (`not installed`) and present stub is ok. `package.json` `files` includes `ROADMAP.md`; `check:docs` gates it. Host plugin pin recorded vs npm latest; no bump/publish.
- Evidence: Isolated-PATH doctor tests; `check:docs` ROADMAP allowlist gate. See [docs/acceptance/NEXT-NIGHT-20260915.md](docs/acceptance/NEXT-NIGHT-20260915.md).
- Delivery: [docs/acceptance/NEXT-NIGHT-20260915.md](docs/acceptance/NEXT-NIGHT-20260915.md).

## Verification entry points

Available script names read from manifests (not executed and not automatically safe):

- `.`: `bun run build`, `bun run typecheck`, `bun run test`, `bun run lint`, `bun run check`, `bun run check:docs`.

CI definitions: .github/workflows/ci.yml, .github/workflows/release.yml. Presence does not prove a passing run.

Before acceptance attach actual test/typecheck/build evidence and explicitly record pending runtime/visual checks.

Independent evidence: [COORDINATOR-20260913.md](docs/acceptance/COORDINATOR-20260913.md). No public package release or live runtime certification.
