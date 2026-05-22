# Contributing to hiai-opencode

Thank you for your interest in contributing. This guide covers the development workflow and the patterns for extending the plugin.

## Development Setup

```bash
git clone https://github.com/HiAi-gg/hiai-opencode.git
cd hiai-opencode
bun install
bun run build
```

### Common Commands

| Task | Command |
|------|---------|
| Build | `bun run build` |
| Typecheck | `bun run typecheck` |
| Test | `bun test` |
| Prompt snapshots | `bun run prompts:measure` |
| Lint | `bun run lint` |

## PR Guidelines

1. Run `bun run typecheck` and `bun test` before submitting.
2. If you changed agent prompts, run `bun run prompts:measure` and commit the updated snapshot.
3. Keep PRs focused — one logical change per PR.
4. Follow existing naming conventions in the directory you are editing.
5. Do not add Node.js-specific dependencies — this is a Bun-first project.

## Adding a New Agent

Agents touch multiple files. Here is the checklist:

1. **Agent factory** — Create `src/agents/<name>.ts` (or a directory `src/agents/<name>/` for multi-file agents).
2. **Prompt library** — Add shared policy blocks in `src/agents/prompt-library/` if the agent has reusable prompt sections.
3. **Dynamic prompt builder** — Update `src/agents/dynamic-agent-prompt-builder.ts` if the agent needs context-driven prompt assembly.
4. **Agent display names** — Add the agent to `src/shared/agent-display-names.ts`.
5. **Default config** — Add the model slot to `src/config/defaults.ts` (if it is a visible primary agent).
6. **Agent config handler** — Register the agent in `src/plugin-handlers/agent-config-handler.ts` for runtime normalization.
7. **Migration** — If replacing a deprecated agent, add a migration entry in `src/shared/migration/agent-names.ts`.
8. **hiai-opencode.json** — Add the model slot to the bundled canonical config.
9. **README.md** — Update the agent table in the Agents section.
10. **Tests** — Add prompt snapshot tests in `tests/`.

## Adding a New Tool

Tools require four files:

1. **Tool factory** — Create the tool implementation in `src/tools/<name>.ts`.
2. **Tool registration** — Register the tool in `src/tools/index.ts` (the tool registry).
3. **Type declaration** — Add the tool name to the `ToolsRecord` type in `src/plugin/types.ts`.
4. **Tests** — Add unit tests in `tests/`.

## Adding a New Hook

Hooks are organized in three tiers. Pick the tier that matches your hook's purpose:

- **Core** (`src/plugin/hooks/create-session-hooks.ts`, `create-tool-guard-hooks.ts`, or `create-transform-hooks.ts`) — Session lifecycle, tool guards, message transforms.
- **Continuation** (`src/plugin/hooks/create-continuation-hooks.ts`) — Todo enforcement, compaction, session recovery.
- **Skill** (`src/plugin/hooks/create-skill-hooks.ts`) — Skill-related hooks.

Steps:

1. **Create the hook factory** in `src/hooks/<hook-name>.ts`.
2. **Add the hook name** to the `HookName` union in `src/config/index.ts`.
3. **Register the hook** in the appropriate tier's `create*Hooks()` function.
4. **Add the hook to the return type** of that function.
5. **Write tests** in `tests/`.

Use the `safeCreateHook()` wrapper to isolate failures. See existing hooks in `src/hooks/` for patterns.

## Code Style

- **TypeScript strict mode** — no `any` unless unavoidable.
- **ESM-only** — use `import`/`export`, no `require()`.
- **Zod** for runtime validation of config and user inputs.
- **Descriptive variable names** — prefer clarity over brevity.
- **Small, focused functions** — if a function exceeds ~80 lines, consider splitting it.
