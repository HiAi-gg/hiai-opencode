# NEXT-NIGHT-20260915 — hiai-opencode

Date: 2026-09-15. Project: `/mnt/data/projects/hiai-opencode`. Work in the existing tree (no worktrees/copies). Version remains **0.6.6**. No tag, no npm publish, no DNS, no production mutation.

Status: **review**. Coordinator accepts. This file is review evidence, not accepted-live and not OpenCode runtime certification.

## Task

Reconcile recorded 2026-09-13 follow-ups against current source (`6b493cc`, CI run 34766718339 already green). Reproduce remaining gaps, then apply the smallest responsible fixes.

Historical findings not treated as fresh failures:

- OpenCode host session certification was never claimed and is still not claimed.
- Do not tag/publish 0.6.6 again without a user-facing release.
- Historical registry dated 2026-09-15 00:08Z is not fresh runtime evidence.

## Before (reproduced 2026-09-15)

1. **Doctor “missing Lightpanda is info” test inherited host PATH.** On this workstation `lightpanda` is `/home/vlgalib/.local/bin/lightpanda`. Inherited-PATH doctor reported `lightpanda binary found on PATH` (exit 0). Isolated PATH (stub bin only) reported `lightpanda not installed` (info, exit 0). The existing test could not fail when the missing-binary branch was never hit.
2. **`ROADMAP.md` was not in `package.json` `files`.** README links `[ROADMAP.md](ROADMAP.md)`. Unpacked npm package from HEAD would 404 that relative link. Confirmed by reading `package.json` `files` (False) and later by `npm pack --dry-run` after the fix (`npm notice 3.7kB ROADMAP.md`).
3. **Host plugin pin vs npm latest.** Installed `@opencode-ai/plugin` **1.18.21**. npm latest observed **1.18.31**. Local `opencode --version` **1.18.23** (`~/.bun/bin/opencode`). No bump this pass (no OpenCode session certification).

LAN `/hiai-opencode/` Caddy browse returned **HTTP 502** (`curl -sI http://127.0.0.1/hiai-opencode/`). Shared Caddy was not mutated. This plugin is not a VPS/website product.

## After

- Doctor healthy-exit fixture uses an isolated PATH (`stub bin` + `/usr/bin:/bin`, or Windows System32) and unsets `AGENT_BROWSER_ENGINE`. Missing Lightpanda must match `/not installed/` and must not match `binary found on PATH`. A second test stubs `lightpanda` on that PATH and expects `✅ Lightpanda engine`.
- `package.json` `files` includes `ROADMAP.md`. `scripts/check-docs.ts` fails if it is missing.
- ROADMAP records the 1.18.21 pin vs 1.18.31 latest. No dependency bump, no version bump, no publish.

## Exact changes

| Path | Change |
|------|--------|
| `assets/cli/hiai-opencode.test.ts` | Isolated-PATH doctor helper; missing and present Lightpanda cases |
| `package.json` | Add `ROADMAP.md` to `files` |
| `scripts/check-docs.ts` | Gate `files` includes `ROADMAP.md` |
| `CHANGELOG.md` | Unreleased notes |
| `ROADMAP.md` | HEAD/CI/drift reconciliation |
| `TEAM_BACKLOG.md` | HIAI-OPENCODE-T04 review |
| `docs/acceptance/NEXT-NIGHT-20260915.md` | This report |
| `docs/acceptance/evidence-20260915/` | Snapshots, click log, LAN HTTP, Lightpanda screenshot placeholders |

## Commands

Heavy commands used `flock /tmp/portfolio-next-night-heavy.lock` and released after each command. Bun 1.4.0 (`/home/vlgalib/.bun/bin/bun`).

| Command | Exit | Summary |
|---------|------|---------|
| Isolated vs inherited doctor repro (Python/Bun, before edit) | 0 | Inherited: Lightpanda found. Isolated: `not installed`, info, exit 0 |
| `bun test assets/cli/hiai-opencode.test.ts` (RED, isolatePath unused) | 1 | 8 pass / 1 fail: expected `/not installed/`, got host Lightpanda found |
| `bun test assets/cli/hiai-opencode.test.ts` (GREEN) | 0 | **10 pass / 0 fail** |
| `bun run check:docs` | 0 | `check:docs PASSED` |
| `bun run typecheck` | 0 | `tsc --noEmit` clean |
| `bun run ci` | 0 | Biome `Checked 183 files`. No fixes applied |
| `bun test` | 0 | **1103 pass / 0 fail**, 2116 expects, 81 files, 8.25s |
| `bun run build` | 0 | 276 modules bundled |
| `bun run check:bundle-size` | 0 | 897.3 KB (limit 1 MB) |
| `npm pack --dry-run --ignore-scripts --cache .npm-cache` | 0 | 222 files, 451.1 kB package / 1.8 MB unpacked; includes `ROADMAP.md` |
| `bun assets/cli/hiai-opencode.mjs doctor` (real workspace) | 0 | Core models ok; Lightpanda found on host PATH; `.mcp.json` missing is warn; Context7 CLI warn. Not a hard fail. Not a full OpenCode session. |

GitHub CI on parent `6b493cc`: run [34766718339](https://github.com/HiAi-gg/hiai-opencode/actions/runs/34766718339) success (ubuntu/windows/macos + static checks). This commit’s CI is recorded after push.

## Graphical / interaction

Named session `AGENT_BROWSER_SESSION=hiai-opencode-next-night-20260915`, `AGENT_BROWSER_ENGINE=lightpanda`. Chrome was not installed.

| Surface | Result |
|---------|--------|
| GitHub README `https://github.com/HiAi-gg/hiai-opencode` | Accessibility snapshot shows README, CI badge, Install, ROADMAP.md link, latest commit `6b493cc` |
| Click README `ROADMAP.md` (`@e333`) | Navigated to `https://github.com/HiAi-gg/hiai-opencode/blob/main/ROADMAP.md` |
| Keyboard Tab | Sent; no pixel proof (see screenshots) |
| GitHub Actions CI workflow page | Opened |
| npm `https://www.npmjs.com/package/@hiai-gg/hiai-opencode` | Cloudflare “Just a moment…” interstitial; not a rendered package page |
| Mobile viewport | Opened GitHub again; Lightpanda still no pixels |
| LAN `http://127.0.0.1/hiai-opencode/` | HTTP 502 from Caddy; empty body. Not mutated |

Lightpanda screenshots are the engine placeholder (“No screenshot available, Lightpanda has no graphical rendering engine.”). That matches AGENTS.md: screenshot pixel fidelity is not visual proof. Interaction evidence is the accessibility tree plus the ROADMAP URL after click.

## SHA / URL

- Pre-edit HEAD: `6b493cc4e4fb36e4edd59a48efbf282a67303a09` (origin/main)
- This pass: `fceb25e9c7fb5b826381d107b45f26dd41a15d22`
- npm published: `@hiai-gg/hiai-opencode@0.6.6` (tag `v0.6.6`, 2026-08-26) — **not** this HEAD
- Canonical source: `https://github.com/HiAi-gg/hiai-opencode`
- Domain: none. Not a website. Do not provision `portfolio@hiai-opencode`.

## Remaining blockers

- Coordinator review; do not mark accepted-live.
- Do not tag or `npm publish` without a user-facing release.
- No OpenCode interactive session certification (`opencode` CLI 1.18.23 vs plugin pin 1.18.21).
- Lightpanda cannot produce pixel screenshots or headed/theme/touch visual proof.
- LAN Caddy file_server for `/hiai-opencode/` is 502; shared Caddy was not changed.
- Optional later: bump `@opencode-ai/plugin` 1.18.21 → 1.18.31 after a dedicated typecheck/test pass.
- GitHub issue #5 (awesome-ai-plugins listing) is unrelated marketing; not done here.

## Rollback

`git revert` of this commit on `main`. No schema, no data, no DNS. npm `latest` stays 0.6.6 until a real release.

## Old-host disposition

Not applicable. This is an npm plugin, not an old VPS site. LAN browse is source `file_server` only.

## Deploy candidate

Hand to controller: `fceb25e9c7fb5b826381d107b45f26dd41a15d22` on `main` after push + CI. **Not** a Coolify/VPS deploy. **Not** an npm publish. `deploy_candidate` is source-only.
