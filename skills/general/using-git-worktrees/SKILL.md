---
name: using-git-worktrees
short_name: worktree-management
context: "git"
description: Create, use, and clean up isolated git worktrees for parallel agent work. Use when you need an isolated workspace that won't interfere with other tasks.
---

# Using Git Worktrees

## Overview

Git worktrees provide isolated working directories that share the same repository history. Each worktree has its own branch and working copy, allowing you to work on multiple tasks simultaneously without conflicts. Worktrees are automatically cleaned up when tasks complete.

**Key benefit:** Changes in one worktree don't affect other worktrees. Each worktree is a completely isolated environment.

## When to Use

Use this skill when:

- You need to work on multiple independent tasks simultaneously
- You want to avoid merge conflicts between parallel changes
- You need a clean workspace for testing or experimentation
- You're debugging a complex issue that requires isolation
- You want to parallelize agent work without interference

**Do NOT use for:**

- Simple one-off changes (just commit directly)
- Tasks that can be completed in the main checkout
- Changes that require cross-worktree coordination

## Safety Verification

**Before creating a worktree, the system automatically verifies:**

1. ✅ Current directory is a git repository
2. ✅ No uncommitted changes in the main checkout
3. ✅ Worktree manager is initialized

**Safety check failure handling:**

- If not a git repo → Error with clear message
- If uncommitted changes exist → Stash or commit them first
- If worktree manager unavailable → Install required dependencies

## The Four-Step Workflow

### Step 0: Check Current State

Before creating a worktree, verify the current state:

```bash
# Check worktree status
hiai_worktree_status
```

**Output includes:**

- Current directory path
- Current branch
- Whether you're inside a worktree
- Whether the checkout is pristine (no uncommitted changes)

**Interpretation:**

- `pristine: true` → Safe to create worktree
- `pristine: false` → Commit or stash changes first
- `inside_worktree: true` → Already in a worktree

### Step 1: Create Isolated Workspace

Create a new worktree with a dedicated branch:

```bash
# Create worktree with automatic name
hiai_worktree_create

# Create worktree with custom name
hiai_worktree_create --name="feature-auth"

# Create worktree tied to a plan
hiai_worktree_create --plan="T5.3-fix-login-bug"
```

**What happens:**

1. Worktree directory created at `.hiai-bob/worktrees/<name>/`
2. New branch created: `hiai-bob/<slug>` (e.g., `hiai-bob/t5-3-fix-logi`)
3. Worktree is checked out to that branch
4. Returns: worktree path, branch name, and name

**Output example:**

```
Created worktree "t5-3-fix-logi" at /path/to/.hiai-bob/worktrees/t5-3-fix-logi on branch hiai-bob/t5-3-fix-logi
```

### Step 2: Work Inside the Worktree

Change to the worktree directory and work normally:

```bash
# Switch to the worktree
cd /path/to/.hiai-bob/worktrees/<name>

# Or use the returned path from Step 1
hiai_worktree_status --path="/path/to/.hiai-bob/worktrees/<name>"
```

**Key characteristics:**

- ✅ All changes are local to this worktree only
- ✅ Worktree branch is isolated from main checkout
- ✅ No interference with other worktrees
- ✅ Safe to experiment and make mistakes

**Typical workflow:**

```bash
cd /path/to/.hiai-bob/worktrees/<name>
# Make changes, run tests, iterate
# Changes won't affect main checkout or other worktrees
```

### Step 3: Completion - Verify and Prepare Merge

When work is complete, verify the worktree state:

```bash
# Check worktree status
hiai_worktree_status --path="/path/to/.hiai-bob/worktrees/<name>"
```

**Pristine check:**

- `pristine: true` → Safe to merge
- `pristine: false` → Commit changes first

**Branch tracking:**

- Worktree uses branch `hiai-bob/<slug>`
- Compare against main: `git diff main`
- Verify no conflicts: `git status`

**Pre-merge checklist:**

1. ✅ All changes committed
2. ✅ Tests pass
3. ✅ No merge conflicts
4. ✅ Worktree is pristine

### Step 4: Cleanup

Remove the worktree when done:

```bash
# Remove by path
hiai_worktree_remove --path="/path/to/.hiai-bob/worktrees/<name>"
```

**What happens:**

- Git worktree is removed
- Directory is deleted
- Branch is cleaned up
- All resources are freed

**Output:**

```
Removed worktree at /path/to/.hiai-bob/worktrees/<name>
```

## Integration with Git Workflow

### Worktree ↔ Git Workflow Coordination

This skill integrates seamlessly with the `git-workflow-and-versioning` skill:

**Recommended workflow:**

```bash
# Step 1: Create worktree for task
skill(name="using-git-worktrees", prompt="Create worktree for T5.3")

# Step 2: Work in isolation
cd /path/to/worktree
# Make changes, commit locally

# Step 3: Return to main, complete workflow
git checkout main
hiai_worktree_remove --path="/path/to/worktree"
```

**Branch naming convention:**

- Worktree branches: `hiai-bob/<slug>`
- Main branch: `main`
- Feature branches: `feature/<name>`

### Atomic Commits in Worktrees

Apply git workflow principles to worktrees:

```bash
# In worktree:
# 1. Make small, focused changes
# 2. Test each increment
# 3. Commit early and often
# 4. Write descriptive messages

cd /path/to/worktree
git add .
git commit -m "feat: add email validation to user registration"
```

## Integration with Development Branch Completion

### Worktree Cleanup Before Branch Finish

Before completing a development branch, ensure worktrees are cleaned up:

```bash
# List all worktrees
hiai_worktree_list

# Remove completed worktrees
hiai_worktree_remove --path="/path/to/worktree"

# Verify main is pristine
hiai_worktree_status
```

**Best practice:** Clean up worktrees when tasks complete to avoid clutter.

### Integration with finishing-a-development-branch Skill

This skill works seamlessly with the `finishing-a-development-branch` skill:

```bash
# Step 1: Create worktree for feature
skill(name="using-git-worktrees", prompt="Create worktree for T12.5-add-user-profile")

# Step 2: Implement feature in isolation
cd /path/to/.hiai-bob/worktrees/t12-5-add-user-prof
# Make changes, commit locally

# Step 3: Return to main and finish branch
cd /path/to/repo
git checkout main
skill(name="finishing-a-development-branch", prompt="Finish development branch after worktree cleanup")
```

**Recommended sequence:**

1. Complete work in worktree
2. Verify worktree is pristine
3. Clean up worktree
4. Use `finishing-a-development-branch` to finalize branch

## Command Reference

| Command                | Description          | Example                                           |
| ---------------------- | -------------------- | ------------------------------------------------- |
| `hiai_worktree_status` | Check worktree state | `hiai_worktree_status`                            |
| `hiai_worktree_create` | Create new worktree  | `hiai_worktree_create --name="feature-x"`         |
| `hiai_worktree_list`   | List all worktrees   | `hiai_worktree_list`                              |
| `hiai_worktree_remove` | Remove worktree      | `hiai_worktree_remove --path="/path/to/worktree"` |

## Worktree Lifecycle

```
Main Checkout
    │
    ├── [Create Worktree] → Worktree A (hiai-bob/task-1)
    │       │
    │       ├── Make changes
    │       ├── Commit locally
    │       └── Test
    │
    ├── [Create Worktree] → Worktree B (hiai-bob/task-2)
    │       │
    │       ├── Make changes
    │       ├── Commit locally
    │       └── Test
    │
    └── [Remove Worktree] ← Both worktrees cleaned up
```

## Best Practices

### 1. Worktree Naming

Use descriptive names:

```bash
hiai_worktree_create --name="fix-login-validation"
hiai_worktree_create --name="refactor-user-service"
```

### 2. Plan-Based Worktrees

Link worktrees to plans for traceability:

```bash
hiai_worktree_create --plan="T5.3-fix-login-bug"
```

### 3. Regular Status Checks

Verify worktree state periodically:

```bash
hiai_worktree_status
```

### 4. Cleanup After Completion

Remove worktrees when done:

```bash
hiai_worktree_remove --path="/path/to/worktree"
```

### 5. Avoid Main Checkout Changes

Worktrees are for isolation. Keep main checkout clean.

## Error Handling

### Common Errors and Solutions

| Error                     | Cause                 | Solution                              |
| ------------------------- | --------------------- | ------------------------------------- |
| "Not a git repository"    | Wrong directory       | `cd /correct/repo`                    |
| "Uncommitted changes"     | Main checkout dirty   | Commit or stash changes               |
| "Worktree already exists" | Duplicate creation    | Use different name or remove existing |
| "Could not acquire lock"  | Concurrent operations | Wait and retry                        |

### Recovery Patterns

**If worktree creation fails:**

1. Check error message
2. Verify git repository
3. Ensure no uncommitted changes
4. Retry with different name

**If worktree removal fails:**

1. Try `git worktree prune`
2. Manually remove directory
3. Check for locked processes

## Monitoring and Maintenance

### List All Worktrees

```bash
hiai_worktree_list
```

**Output format:**

```
(main) main -> /path/to/repo [main]
feature-x -> /path/to/.hiai-bob/worktrees/feature-x [hiai-bob/feature-x]
```

### Cleanup Stale Worktrees

```bash
# List all worktrees
hiai_worktree_list

# Remove specific worktree
hiai_worktree_remove --path="/path/to/worktree"
```

## Performance Considerations

- Worktrees share repository data (efficient storage)
- Each worktree has its own working copy
- Branches are lightweight references
- Cleanup is automatic on removal

## Security Considerations

- Worktrees are isolated to the repository
- No cross-worktree visibility
- Changes are local until merged
- Main checkout remains pristine

## Integration Diagram

```
┌─────────────────────┐     ┌─────────────────────┐
│   Main Checkout     │     │   Worktree A        │
│   (pristine)        │────▶│   (isolated)        │
│   branch: main      │     │   branch: hiai-bob/ │
└─────────────────────┘     │   task-1            │
                            └─────────────────────┘
                                      │
                                      ▼
                            ┌─────────────────────┐
                            │   Worktree B        │
                            │   (isolated)        │
                            │   branch: hiai-bob/ │
                            │   task-2            │
                            └─────────────────────┘
```

## Related Skills

- **[git-workflow-and-versioning](git-workflow-and-versioning)** - Structured git workflow practices
- **[systematic-debugging](systematic-debugging)** - Root cause investigation workflow
- **[debugging-and-error-recovery](debugging-and-error-recovery)** - Error handling and triage

## Quick Reference

| Step | Action            | Tool                   | Verification          |
| ---- | ----------------- | ---------------------- | --------------------- |
| 0    | Check state       | `hiai_worktree_status` | `pristine: true`      |
| 1    | Create worktree   | `hiai_worktree_create` | Returns path & branch |
| 2    | Work locally      | `cd <worktree-path>`   | Isolated changes      |
| 3    | Verify completion | `hiai_worktree_status` | `pristine: true`      |
| 4    | Cleanup           | `hiai_worktree_remove` | Worktree deleted      |

## Examples

### Example 1: Simple Feature Work

```bash
# Check current state
hiai_worktree_status
# Output: pristine: true, inside_worktree: false

# Create worktree
hiai_worktree_create --name="add-dark-mode"
# Output: Created worktree "add-dark-mode" at /repo/.hiai-bob/worktrees/add-dark-mode on branch hiai-bob/add-dark

# Switch to worktree
cd /repo/.hiai-bob/worktrees/add-dark-mode

# Make changes
# ... implement dark mode ...

# Commit changes
git add .
git commit -m "feat: add dark mode toggle component"

# Verify status
hiai_worktree_status
# Output: pristine: true

# Return to main
cd /repo

# Cleanup
hiai_worktree_remove --path="/repo/.hiai-bob/worktrees/add-dark-mode"
```

### Example 2: Parallel Task Execution

```bash
# Task 1: Fix login bug
hiai_worktree_create --plan="T5.3-fix-login-bug"
cd /repo/.hiai-bob/worktrees/t5-3-fix-logi
# Fix login bug, commit

# Task 2: Refactor user service
hiai_worktree_create --name="refactor-user-service"
cd /repo/.hiai-bob/worktrees/refactor-user-service
# Refactor, commit

# Verify both worktrees
hiai_worktree_list

# Cleanup when done
hiai_worktree_remove --path="/repo/.hiai-bob/worktrees/t5-3-fix-logi"
hiai_worktree_remove --path="/repo/.hiai-bob/worktrees/refactor-user-service"
```

### Example 3: Debugging Complex Issue

```bash
# Create isolated worktree
hiai_worktree_create --name="debug-memory-leak"
cd /repo/.hiai-bob/worktrees/debug-memory-leak

# Install debug tools
git checkout debug-tools
npm install

# Run tests with memory profiler
npm run test:debug

# Analyze results
# ... debugging ...

# Commit findings
git commit -m "chore: add memory profiling configuration"

# Return to main and cleanup
cd /repo
hiai_worktree_remove --path="/repo/.hiai-bob/worktrees/debug-memory-leak"
```

---

**Skill Status:** ✅ Complete and ready for use
**Last Updated:** 2026-07-10
