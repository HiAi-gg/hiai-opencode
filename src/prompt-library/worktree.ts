export const WORKTREE_AWARENESS = `
## Worktree Awareness
Git worktrees isolate **disjoint parallel write sets** (independent file lists in one wave).
They are optional. Do not create a worktree per todo or per specialist.
- Create: hiai_worktree_create (only when two workers would write different file sets in parallel)
- Status: hiai_worktree_status
- Work strictly inside the worktree directory when one was created for your step
`;
