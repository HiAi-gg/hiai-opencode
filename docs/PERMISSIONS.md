# Permissions Reference

**Generated:** 2026-04-26

## Overview

hiai-opencode uses OpenCode's permission system to control agent access to filesystem, shell commands, and tool operations.

## Default Permissions Matrix

| Agent | Read | Write | Bash | Notes |
|-------|-------|-------|------|-------|
| `researcher` | `*` (all) | deny `*.env*`, `*.pem`, `credentials*` | `ask` | Read-only by default |
| `coder` | `*` | `*` (all) | `ask` | Full edit + bash |
| `sub` | `*` | deny `**/.git/**`, `**/node_modules/**` | `ask` | Bounded write |
| `strategist` | `*` | deny `**/.git/**`, `**/node_modules/**` | `ask` | Architecture/planning |
| `critic` | `*` | deny `**/.git/**`, `**/node_modules/**` | `ask` | Read-only review |
| `designer` | `*` | `*` | `ask` | UI/visual work |
| `brainstormer` | `*` | `*` | `ask` | Writing/copy |
| `platform-manager` | `*` | `*` | `*` | Full access for ops |
| `multimodal` | `*` | deny `**/.git/**`, `**/node_modules/**` | `ask` | Vision capabilities |
| `bob` | `*` | `*` | `*` | Orchestrator |
| `guard` | `*` | deny `**/.git/**`, `**/node_modules/**` | `ask` | Verification |
| `quality-guardian` | `*` | deny `**/.git/**`, `**/node_modules/**` | `ask` | Quality checks |

## Permission Levels

### Read Permissions
- `*` - Allow all read operations
- `*.ts`, `*.md` - Allow specific file patterns
- deny patterns take precedence

### Write Permissions
- `*` - Allow all write operations
- deny patterns block specific paths:
  - `**/.git/**` - Never write to .git directory
  - `**/node_modules/**` - Never write to node_modules
  - `**/*.env*` - Never write to environment files
  - `**/*.pem`, `**/credentials*` - Never write to secrets

### Bash Permissions
- `*` - Allow all bash commands
- `ask` - Prompt user for approval before execution (default for most agents)
- deny patterns block dangerous commands:
  - `rm -rf /**` - Never execute recursive delete on root
  - `git push --force to main/master` - Never force push to main branches

## Configuration

Override permissions in `hiai-opencode.json`:

```json
{
  "permissions": {
    "read": { "*": "allow", "**/*.secret": "deny" },
    "edit": { "*": "allow", "**/.git/**": "deny" },
    "bash": { "*": "ask", "**/safe-scripts/**": "allow" }
  }
}
```

## Security Best Practices

1. **Bash always ask** - Even trusted agents should ask for bash approval
2. **Deny secrets by default** - Protect `.env`, `.pem`, `credentials*` files
3. **Git guard** - Never allow writes to `.git` directory
4. **Use `sub` for bounded tasks** - Sub agent has restricted write permissions
5. **Platform-manager for ops** - Use platform-manager for system-level operations

## Runtime Checks

hiai-opencode performs runtime validation:
- Blocked commands logged with `logWarn()`
- Failed permission checks logged to `OPENCODE_LOG`
- User prompted for `ask` permissions at first use

## Agent Capability Matrix

| Capability | researcher | coder | sub | strategist | critic |
|------------|-------------|-------|-----|------------|--------|
| Read files | ✓ | ✓ | ✓ | ✓ | ✓ |
| Write files | ✗ | ✓ | Limited | ✗ | ✗ |
| Execute bash | ask | ask | ask | ask | ask |
| Run tools | ✓ | ✓ | ✓ | ✓ | ✓ |
| Delegate tasks | ✓ | ✓ | ✓ | ✓ | ✓ |