# HiaiOpenCode Agent Registry & Analysis

This document describes the current canonical 12-agent model first. Legacy aliases are kept only as migration notes so the active system is clear at a glance.

---

## Canonical 12-Agent Model

| Agent | Role | Current implementation files |
|---|---|---|
| `bob` | Orchestrator and delegation hub | `src/agents/bob.ts`, `src/agents/bob/default.ts`, `src/agents/bob/gemini.ts`, `src/agents/bob/gpt-pro.ts` |
| `guard` | Workflow enforcer and closure validator | `src/agents/guard/agent.ts`, `src/agents/guard/default.ts`, `src/agents/guard/gemini.ts`, `src/agents/guard/gpt.ts` |
| `strategist` | Planning, architecture, and scope control | `src/agents/strategist/system-prompt.ts`, `src/agents/strategist/gemini.ts`, `src/agents/strategist/gpt.ts`, `src/agents/strategist/high-accuracy-mode.ts` |
| `critic` | High-risk review gate | Config and routing are wired through `src/config/defaults.ts`, `src/shared/agent-tool-restrictions.ts`, `src/agents/strategist/high-accuracy-mode.ts`, and `src/agents/coder/gpt-pro.ts` |
| `coder` | Implementation and deep work | `src/agents/coder/agent.ts`, `src/agents/coder/gpt.ts`, `src/agents/coder/gpt-codex.ts`, `src/agents/coder/gpt-pro.ts` |
| `sub` | Bounded delegated executor | `src/agents/sub/agent.ts`, `src/agents/sub/default.ts`, `src/agents/sub/gemini.ts`, `src/agents/sub/gpt.ts`, `src/agents/sub/gpt-codex.ts`, `src/agents/sub/gpt-pro.ts` |
| `researcher` | Repo and external research | `src/agents/researcher.ts` |
| `multimodal` | Image, PDF, and layout analysis | `src/agents/ui.ts` |
| `quality-guardian` | Review and structured debugging | `src/agents/quality-guardian.ts` |
| `platform-manager` | Continuity, bootstrap, and mindmodel orchestration | `src/agents/platform-manager.ts` |
| `brainstormer` | Early ideation and concept shaping | Registered through `src/config/defaults.ts` and `src/agents/builtin-agents.ts` |
| `agent-skills` | Skill discovery and routing | Registered through `src/config/defaults.ts` and `src/agents/builtin-agents.ts` |

### Current Model-Specific Prompting

- Gemini overlays live in `src/agents/bob/gemini.ts`, `src/agents/strategist/gemini.ts`, and `src/agents/sub/gemini.ts`.
- GPT and Codex prompting now uses `src/agents/bob/gpt-pro.ts`, `src/agents/strategist/gpt.ts`, `src/agents/coder/gpt-pro.ts`, `src/agents/coder/gpt-codex.ts`, `src/agents/sub/gpt.ts`, `src/agents/sub/gpt-codex.ts`, and `src/agents/sub/gpt-pro.ts`.
- `src/agents/gpt-apply-patch-guard.ts` remains the patch guard for GPT-family prompting.
- Legacy model-specific files are archived and are not part of the live runtime inventory.

---

## Legacy Alias Notes

Legacy names are accepted at config boundaries only:

- `general`, `zoe`, `build` -> `bob`
- `pre-plan`, `logician`, `plan-consultant` -> `strategist`
- `librarian`, `explore` -> `researcher`
- `ui` -> `multimodal`
- `code-reviewer`, `systematic-debugger` -> `quality-guardian`
- `mindmodel`, `ledger-creator`, `bootstrapper`, `project-initializer` -> `platform-manager`

---

## Prompting Overview

### Gemini Optimizations

Gemini models use the current overlays above to keep tool use explicit and avoid premature completion.

### GPT & Codex Optimizations

GPT and Codex models use the current `gpt-pro.ts` / `gpt-codex.ts` files, plus the patch guard, to keep the prompt structure compact and direct.

---

## Source Files

- `src/config/schema/agent-names.ts` defines the canonical 12-agent names and compatibility aliases.
- `src/config/types.ts` documents the canonical list and alias mapping target.
- `src/config/defaults.ts` provides the current default model assignments for the canonical agents.
- `src/agents/builtin-agents.ts` wires the canonical runtime agents.
