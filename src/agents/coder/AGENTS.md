# src/agents/coder/ -- Autonomous Deep Worker

**Generated:** 2026-04-11

## OVERVIEW

6 files. Coder agent -- autonomous deep worker powered by `gpt-pro`, `gpt-codex`, and `gpt`. Goal-oriented: give it objectives, not step-by-step instructions. "The Legitimate Craftsman."

## FILES

| File | Purpose |
|------|---------|
| `agent.ts` | `createCoderAgent()` factory, model-variant routing |
| `gpt.ts` | Base GPT prompt: discipline rules, delegation, verification |
| `gpt-pro.ts` | `gpt-pro` prompt with XML-tagged blocks, entropy-reduced |
| `gpt-codex.ts` | `gpt-codex` variant with task discipline sections |
| `index.ts` | Barrel exports |

## KEY BEHAVIORS

- Mode: `primary` (respects UI model selection)
- Requires OpenAI-compatible provider (no fallback chain)
- NEVER trusts subagent self-reports -- always verifies
- NEVER uses `background_cancel(all=true)`
- Delegates exploration to background agents, never sequential
- Uses `run_in_background=true` for researcher

## MODEL VARIANTS

| Model | Prompt Source | Optimizations |
|-------|-------------|---------------|
| `gpt-pro` | `gpt-pro.ts` | XML-tagged blocks, 8 sections |
| `gpt-codex` | `gpt-codex.ts` | Task discipline, 549 LOC prompt |
| `gpt` | `gpt.ts` | Base prompt, 507 LOC |
