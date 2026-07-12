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
| Lint | `bun run lint` |
| Check docs for private paths / Cyrillic | `bun run scripts/check-docs.ts` |

## PR Guidelines

1. Run `bun run typecheck` and `bun test` before submitting.
2. Keep PRs focused — one logical change per PR.
3. Follow existing naming conventions in the directory you are editing.
4. Do not add Node.js-specific dependencies — this is a Bun-first project.

## Adding a New Agent

Agents are authored as flat files under `src/agents/`. Checklist:

1. **Agent prompt** — Create `src/agents/<name>.ts` exporting the prompt string (assembled from `src/prompt-library/*` fragments).
2. **Shared fragments** — Add reusable policy blocks in [src/prompt-library/](src/prompt-library) if the agent has shared prompt sections.
3. **Registration** — Add the agent to `createAllAgents()` in [src/agents/index.ts](src/agents/index.ts), OR native-upgrade it inline in the `hooks.config` callback in [src/index.ts](src/index.ts) (as `explore`/`plan`/`build`/`general` do).
4. **Default config** — Add the model slot to `DEFAULT_CONFIG` in [src/config.ts](src/config.ts) and to the 10-slot validation in `REQUIRED_AGENT_KEYS`.
5. **Permissions** — Add per-agent restrictions to `DEFAULT_CONFIG.agent_restrictions` in [src/config.ts](src/config.ts) (resolved by `applyAgentPermissions` in [src/permissions.ts](src/permissions.ts)).
6. **bob.json** — Add the model slot to [bob.json](bob.json) (the bundled canonical config).
7. **README.md** — Update the agent table in the Agents section.
8. **Tests** — Add a prompt snapshot test next to the source: `src/agents/<name>.test.ts`.

## Adding a New Tool

1. **Tool factory** — Create the tool implementation in `src/tools/<name>.ts` (or `src/tools/<name>/index.ts` for multi-file tools).
2. **Tool registration** — Register the tool in the `hooks.tool` object in [src/index.ts](src/index.ts).
3. **Permissions** — If the tool needs per-agent restrictions, add its key to `TOOLS_KEYS` in [src/permissions.ts](src/permissions.ts).
4. **Tests** — Add unit tests next to the source: `src/tools/<name>.test.ts`.

## Adding a New Hook

Hooks live as flat files in [src/hooks/](src/hooks). Each exports a `create<Name>Hook(config: BobConfig): HookSet` factory.

1. **Create the hook factory** in `src/hooks/<hook-name>.ts`.
2. **Register it** in `ALL_NAMED_HOOK_FACTORIES` in [src/hooks/index.ts](src/hooks/index.ts).
3. **Write tests** next to the source: `src/hooks/<hook-name>.test.ts`.

Hooks are chained via `combineHookSets`. Throw `BlockingHookError` (from `src/hooks/errors.ts`) for hard gates that must halt the pipeline; regular errors are logged and swallowed.

## Code Style

- **TypeScript strict mode** — no `any` unless unavoidable.
- **ESM-only** — use `import`/`export`, no `require()`.
- **Bun runtime** — `Bun.$`, `bun:test`, `bun build` are all available.
- **Descriptive variable names** — prefer clarity over brevity.
- **Small, focused functions** — if a function exceeds ~80 lines, consider splitting.
- **Co-locate tests** — `foo.ts` and `foo.test.ts` live side by side.
