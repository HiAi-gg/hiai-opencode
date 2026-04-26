import type { BuiltinCategoryDefinition } from "./builtin-category-definition"

const GIT_CATEGORY_PROMPT_APPEND = `<Category_Context>
You are working on GIT / VERSION CONTROL tasks.

<Routing_Policy>
Executor contour: platform-manager (git operations specialist).
</Routing_Policy>

Git operations mindset:
- Atomic commits with clear messages
- Clean history: rebase/squash before push
- Safe operations: never force-push to main/master
- Clear handoff notes for session continuity

Approach:
- Understand the current branch state
- Plan atomic commit strategy
- Execute with minimal noise
- Verify state after operation
</Category_Context>`

export const GIT_CATEGORIES: BuiltinCategoryDefinition[] = [
  {
    name: "git",
    config: {},
    description: "Git operations: commits, branching, history, rebasing. Uses platform-manager execution contour.",
    promptAppend: GIT_CATEGORY_PROMPT_APPEND,
  },
]