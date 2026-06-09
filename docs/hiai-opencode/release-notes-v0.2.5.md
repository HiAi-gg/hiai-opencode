# v0.2.5 — MemPalace canonical taxonomy, Manager complexity routing, mandatory Critic gate

> **14-agent OpenCode plugin · 9 visible + 5 hidden · MIT License · @hiai-gg/hiai-opencode**

## Highlights

- **MemPalace canonical taxonomy** — 14 structured rooms as single source of truth (`src/agents/prompt-library/mempalace-taxonomy.ts`) plus critical `mempalace-auto-save` hook fix
- **Manager complexity routing** — `task()` with 5+ todos or 3+ parallel units now MUST delegate to Manager (no more direct Coder dispatch for large plans)
- **Critic mandatory completion gate** — `<CLOSURE>` block enforcement injected into both inline and shared-execution copies of Bob and Manager
- **Postgres content-update rules** — `scripts/db-content-update.sh` wrapper for `psql` on `landing_pages` and other textual content; no new migration files for content drift
- **Biome lint+format** — wired into Coder and Critic prompts; CI lint job is fatal
- **agent-tool-permission hook** — runtime enforcement of `CANONICAL_AGENT_RESTRICTIONS` (read-only agents cannot delegate, write-capable agents have explicit file-scope limits)
- **Session work accumulation** across agent sessions via Manager
- **All 6 snapshot test failures resolved**; `tests/prompts/baseline.txt` updated to match new prompt sizes
- **All 8 lint errors + 1095 format issues auto-fixed** via `biome check --write`
- **@opencode-ai/* dependencies** updated 1.4.6 → 1.16.2 (12 minor versions)
- **Critical-path unit tests** added: agent-tool-permission (7 cases), mempalace-auto-save (6 cases), buildSaveChecklist (3 cases)
- **CI release workflow** — new `.github/workflows/release.yml` triggers on `v*.*.*` tag push (lint, test, typecheck, build, npm publish with provenance, GitHub Release)
- **Commitlint + husky** — conventional commits enforced via `commitlint.config.js` + `.husky/commit-msg`
- **CODEOWNERS** — PR routing set up for the plugin's source areas

## Stats since v0.2.4

- **16 atomic commits** on `release/0.2.5`
- **1137 files changed**, +50,703 / −35,793 lines
- **1990 tests**, 0 fail, 3708 expect() calls
- **TypeScript**: 0 errors
- **Bundle**: 2.81 MB (under 3 MB budget)
- **Tarball**: 12.8 MB, 2234 files, includes skills, design-systems, docs

## Install / Upgrade

```bash
# Fresh install
opencode plugin @hiai-gg/hiai-opencode@latest --global

# Or upgrade from v0.2.4
opencode plugin update @hiai-gg/hiai-opencode
```

After upgrading, see the [post-install setup prompt](https://github.com/HiAi-gg/hiai-opencode#post-install-bootstrap-prompt) and the [release process](https://github.com/HiAi-gg/hiai-opencode/blob/main/docs/hiai-opencode/release-process.md) for first-time GitHub `npm` environment + `NPM_TOKEN` configuration.

## Breaking Changes

None. v0.2.5 is a feature and quality release. All agent names and prompt formats are backwards-compatible; `bob` / `coder` / etc. still resolve to PascalCase display names via `AGENT_NAME_MAP` and `LEGACY_DISPLAY_NAMES`.

## Full Changelog

**16 commits since v0.2.4:**

```
docs(release): final verification report for 0.2.5
chore(release): bump to 0.2.5 with full changelog
ci: add release workflow + make lint check fatal
ci: add CODEOWNERS, commitlint, husky for conventional commits
docs(readme): add 0.2.5 features (agent-browser, postgres, biome, critic-gate)
docs(architecture): update flow diagram with Manager routing tier
docs(src/AGENTS): fix hook counts to match actual (52→51)
test(hooks): add tests for agent-tool-permission hook (7 cases)
test(hooks): add tests for mempalace-auto-save handler (6 cases)
test(prompts): add unit tests for buildSaveChecklist (3 cases)
fix(ci): make lint check fatal in CI
chore(deps): update @opencode-ai/plugin and @opencode-ai/sdk to 1.16.2
style: apply biome lint:fix and format (8 errors + 1095 format issues)
style(agent-config): apply biome formatting
fix(scripts): update e2e-smoke-test.sh prompt size thresholds
```

[View full diff](https://github.com/HiAi-gg/hiai-opencode/compare/v0.2.4...v0.2.5) · [Plan](https://github.com/HiAi-gg/hiai-opencode/blob/main/.bob/plans/release-0.2.5.md) · [Critic review](https://github.com/HiAi-gg/hiai-opencode/blob/main/.bob/drafts/release-0.2.5-readiness-audit.md)

## License

MIT © [HiAi](https://github.com/HiAi-gg)
