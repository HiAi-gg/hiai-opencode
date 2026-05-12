export const WORKTREE_BLOCK_MESSAGE = `
Worktree isolation active for parallel plan.

Working in: {worktreePath}
Registry: .bob/boulder-registry/{planName}.json

Active plan registry stays in the root project .bob/boulder-registry/.
The worktree is only the execution directory referenced by worktree_path.
`

export function createWorktreeActiveBlock(worktreePath: string, planName?: string): string {
  const registryPath = planName
    ? `.bob/boulder-registry/${planName}.json`
    : `.bob/boulder-registry/<plan-name>.json`

  return `
## Worktree Active

**Worktree**: \`${worktreePath}\`
**Registry**: \`${registryPath}\`

**CRITICAL - DO NOT FORGET**: You are working inside a git worktree. ALL operations MUST be performed exclusively within this worktree directory.
- Every file read, write, edit, and git operation MUST target paths under: \`${worktreePath}\`
- When delegating tasks to subagents, you MUST include the worktree path in your delegation prompt so they also operate exclusively within the worktree
- NEVER operate on the main repository directory - always use the worktree path above
- Plan registry remains in the root project at \`${registryPath}\`; the worktree only supplies \`worktree_path\`
- On completion, state syncs back to root and worktree is removed via \`git worktree remove\`
`
}
