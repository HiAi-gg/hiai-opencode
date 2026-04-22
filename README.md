# hiai-opencode

`hiai-opencode` is the unified OpenCode plugin for the current canonical 12-agent model, bundled skills, MCP integrations, and migration-aware config wiring.

It consolidates the current runtime model into one package so the default path is clear: canonical agent names first, compatibility aliases only at boundaries, and current file names in the docs instead of legacy model-specific stubs.

---

## What It Includes

1. The canonical 12 agents: `bob`, `guard`, `strategist`, `critic`, `coder`, `sub`, `researcher`, `multimodal`, `quality-guardian`, `platform-manager`, `brainstormer`, and `agent-skills`.
2. Current GPT/Gemini/Codex prompt files such as `src/agents/bob/gpt-pro.ts`, `src/agents/coder/gpt-codex.ts`, and `src/agents/sub/gpt-codex.ts`.
3. Built-in skills, MCP integrations, LSP servers, and migration helpers for legacy names.

---

## Quick Start

```bash
bash scripts/onboard.sh
```

If you are already set up:

```bash
bun install
bun run build
```

Then start a session with:

```bash
bash opencode_start.sh
```

---

## Prompt Measurement

Prompt snapshots are stored in `dist/prompt-snapshots/` and serve as the baseline for token-diet regression testing.

To regenerate baselines after prompt refactors:

```bash
bun run prompts:measure
```

Commit the updated snapshots alongside any prompt changes. Re-running the script yields byte-identical output (deterministic).

---

## Documentation

- [AGENTS_INFO.md](AGENTS_INFO.md) covers the canonical 12-agent model and current file paths.
- [ARCHITECTURE.md](ARCHITECTURE.md) covers the package layout, runtime wiring, and configuration shape.
- [REGISTRY.md](REGISTRY.md) gives the concise capability registry and legacy alias notes.
- [hiai-opencode.json](hiai-opencode.json) is the current top-level config file.
- [LICENSE.md](LICENSE.md) contains the project licenses.
