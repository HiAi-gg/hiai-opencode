# Release Process

This repo auto-publishes to npm when a `v*.*.*` tag is pushed. The workflow lives at `.github/workflows/release.yml`.

## One-time setup: GitHub `npm` environment + `NPM_TOKEN` secret

The release workflow uses GitHub's `npm` environment protection. You must configure the `NPM_TOKEN` secret **once per repo** before the first tag can publish.

### 1. Get an npm automation token

1. Go to <https://www.npmjs.com/settings/~/tokens>
2. Click **Generate New Token** → **Classic Token**
3. Type: **Automation** (NOT "Publish" — Automation bypasses 2FA)
4. Copy the token value (`npm_...`)

> **CRITICAL:** Use **Automation** type. "Publish" type requires 2FA OTP (`npm error EOTP`) and the CI workflow will fail every time. Automation tokens publish without interactive prompts.

### 2. Add it to the GitHub `npm` environment

**Option A — Web UI** (recommended for first-time setup):

1. Go to <https://github.com/HiAi-gg/hiai-opencode/settings/environments>
2. Click **New environment** (or open existing `npm` if present)
3. Name: `npm`
4. Under **Environment secrets**, click **Add secret**:
   - Name: `NPM_TOKEN`
   - Value: paste the token from step 1
5. Click **Add secret**

**Option B — gh CLI** (faster for repeat use, requires `gh auth` with `repo` + `admin:org` scopes):

```bash
# Get the public key for the env
KEY_ID=$(gh api /repos/HiAi-gg/hiai-opencode/environments/npm/secrets/public-key --jq .key_id)
PUBKEY=$(gh api /repos/HiAi-gg/hiai-opencode/environments/npm/secrets/public-key --jq .key)

# Encrypt the token with the public key (libsodium sealed box)
ENCRYPTED=$(echo -n "$NPM_TOKEN" | openssl pkeyutl -encrypt -pubin -inkey <(echo "$PUBKEY" | base64 -d) 2>/dev/null | base64 -w0)

# Write to the env
gh api -X PUT /repos/HiAi-gg/hiai-opencode/environments/npm/secrets/NPM_TOKEN \
  -f encrypted_value="$ENCRYPTED" \
  -f key_id="$KEY_ID"
```

> **Note:** Option B requires the `pkeyutl` openssl feature (libsodium-compatible). If unavailable, use Option A. The unencrypted value of `$NPM_TOKEN` is sensitive — never log it or pass it via shell history (`export HISTCONTROL=ignorespace` and prefix with space, or use a `.env` file).

Optional but recommended — add a protection rule:

- **Required reviewers**: 0 (or 1 if you want approval gating)
- **Deployment branches**: `main` only

### 3. Re-trigger the release

After adding `NPM_TOKEN`, re-trigger the failed workflow in one of two ways:

**Option A** — re-run from the Actions UI:

1. Go to <https://github.com/HiAi-gg/hiai-opencode/actions/workflows/release.yml>
2. Click the failed `v0.2.5 release` run
3. Click **Re-run jobs** → **Re-run failed jobs**

**Option B** — re-push the tag locally:

```bash
git tag -d v0.2.5
git push origin :refs/tags/v0.2.5
git tag v0.2.5           # at the same commit: c2a6e61
git push origin v0.2.5
```

## How the workflow works

`.github/workflows/release.yml` runs on every `v*.*.*` tag push. The `publish` job:

1. Checks out the repo
2. Sets up Bun (1.3.x) and Node.js (20)
3. Runs `bun install --frozen-lockfile`
4. Runs `bun run typecheck` (must pass)
5. Runs `bun test` (must pass, 1990 tests, 0 fail)
6. Runs `bun run build` (produces `dist/index.js`)
7. Runs `npm pack --dry-run` (verifies tarball integrity)
8. Runs `npm run check:bundle-size` (enforces size budget)
9. `npm publish --access public --provenance` — uses `NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` from the `npm` environment
10. `softprops/action-gh-release@v2` creates a GitHub Release with `generate_release_notes: true` and uploads the `.tgz`

## Local dry-run

To verify the publish payload without actually publishing:

```bash
bun install
bun run build
npm pack --dry-run
```

## Known warnings (non-blocking)

- `actions/setup-node@v4` runs on Node 20, deprecated by GitHub on **Sept 16, 2026**. Will need to bump to `@v5` before then.
- GitHub will force Node 24 on the runner starting **June 16, 2026**. Set `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` to opt in early.

## Pre-release checklist (per release)

- [ ] `bun run typecheck` — 0 errors
- [ ] `bun test` — 0 fail
- [ ] `bun run lint` — 0 errors
- [ ] `bun run build` — exit 0
- [ ] `bun run prompts:measure` — within ±20% of `tests/prompts/baseline.txt`
- [ ] `CHANGELOG.md` has the new version entry
- [ ] `package.json` version is bumped
- [ ] Commit history since last tag is conventional (`feat:` / `fix:` / `chore:` etc.) — enforced by commitlint
- [ ] `NPM_TOKEN` secret still present in GitHub `npm` environment
- [ ] No `package-lock.json` left behind (Bun-only project)
- [ ] Annotated tag (not lightweight) with release notes summary
