# Independent review: hiai-opencode

2026-09-13. Recommendation: ACCEPT scoped source changes for HIAI-OPENCODE-T01/T02/T03; no publish or runtime certification.

Read DEV-01 canon, project AGENTS, assigned prompt, git-before/baseline, TEAM_BACKLOG, GROK_RESULT, acceptance report, actual diff and workflows. Baseline HEAD cfa8185d71fbc895b106958530b8b3c457f0a0d4 on main; only ROADMAP.md and TEAM_BACKLOG.md were pre-existing untracked entries. All 14 tracked modified paths are in reported scope; preserve and include roadmap/backlog deliberately rather than blanket staging. No project source/status edited by reviewer. Build regenerates ignored dist; pack dry-run can write ignored .npm-cache.

## Code assessment

parseConfig now propagates malformed JSONC to loadConfig's existing catch; doctor tracks the resulting fail and exits early rather than probing MCP with invalid empty config. Other parseConfig caller catches errors, so no new uncaught-error path found. Regression tests cover missing core models, malformed JSON, invalid depth, stale managed MCP and healthy config. Existing ownership/plan lifecycle implementation remains unchanged. Browser guidance separates DEV-01 from upstream Chrome options. No blocking correctness regression found in actual diff.

## Independent checks

From project cwd, with Linux Bun on PATH, executed through the required run-check.py helper:
- bun run prepublishOnly: exit 0. This script only checks/builds/dry-packs; it does not publish. Typecheck clean; 1102 tests pass / 0 fail, 2110 expectations / 81 files; Biome 183 files clean; check:docs passed; build and declaration generation succeeded; pack:check succeeded (npm pack --dry-run --ignore-scripts, 221 files, 449.1 kB package / 1.8 MB unpacked).
- bun run check:bundle-size: exit 0; 897.3 KB under 1 MB.
Full first check log: coordinator/hiai-opencode-checks.log.
The coordinator slot helper works outside Grok sandbox. Earlier helper/package blockers in Grok report are superseded by these independent results; retain historical evidence but add acceptance verification.

## Nonblocking follow-ups and limitations

- check-docs protection is deliberately narrow: it detects one combined Chrome-install command and one old test count, not every possible forbidden workstation command. Do not describe it as a complete policy validator.
- Newly referenced ROADMAP.md is not in package.json files allowlist, so the README's relative roadmap link works in GitHub source but not within unpacked npm package. Consider an absolute GitHub link or include ROADMAP when preparing the next public release.
- New healthy doctor fixture inherits PATH; it proves healthy exit on this machine, not guaranteed Lightpanda absence. Missing-Lightpanda-specific isolation could be improved separately.
- No real OpenCode runtime, browser rendering, or live GitHub Actions checked. Public browser behavior not exercised. Existing CLI Chrome fallback is retained for upstream hosts; DEV-01 guidance is policy, not a new engine-enforcement mechanism.

## GitHub/publish consequences

CI triggers pushes to main/master and PRs and now uses Bun 1.4.x across Linux/Windows/macOS. Only local Linux checked. Release workflow triggers version tags or workflow_dispatch, not plain main push; it can publish npm and create GitHub release. Version remains 0.6.6. Coordinator may selectively commit/push reviewed changes after checking remote divergence; do not tag or manually dispatch release. No git fetch, commit, push, publish, production mutation performed by this reviewer.
Coordinator remote preflight: existing origin HiAi-gg/hiai-opencode, main is 0 ahead / 0 behind after fetch. Source push only; no tag or publish.
