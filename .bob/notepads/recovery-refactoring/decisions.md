# Recovery Refactoring Notepad

## 2026-05-10T21:25:00 Conflict Resolution Strategy

**19 overlapping files (stash ∩ working tree)**: All use STASH version.
Reason: Stash contains the complete refactoring (Guard→Manager, Brainstormer→Writer across entire codebase). Working tree has only a subset of the same changes.

**2 working-tree-only files (NOT in stash)**: PRESERVE AUTOMATICALLY.
- `src/internals/plugins/pty/pty/tools/list.ts` — PTY type annotation fix
- `tsconfig.json` — node_modules/effect exclude fix
These are NOT in stash, so `git stash pop` will NOT touch them. They remain as-is.

**65 untracked files**: All new, all need `git add`.

## 2026-05-10T21:25:00 Wave 1 Safety Results

- Backup branch: backup/pre-recovery-2026-05-10 ✅
- Stash integrity: 175 files, +1409/-6285 ✅
- Stash count: 1 ✅
- HEAD SHA: 7f1f06576c9f8a8113f355c29f50daf2f7049305 ✅
