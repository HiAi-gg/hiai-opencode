# HiaiOpenCode Agent Registry & Analysis

This document provides a comprehensive analysis of the 22 expert agents within the HiaiOpenCode platform. It details their roles, sources, model optimizations, and includes direct links to their prompt definitions.

---

## 🧬 Agent Source Distribution

| Source | Role | Count |
| :--- | :--- | :--- |
| **OH-MY-OPENAGENT** | Core Orchestration & Specialists | 14 |
| **MICODE** | Platform & Continuity Specialists | 4 |
| **SUPERPOWERS** | Quality Control & Debugging | 2 |
| **AGENT-SKILLS** | Tactical & Skill Management | 2 |

---

## 🚀 Model-Specific Prompting (Hardcoded Logic)

The system dynamically selects or overlays prompt instructions based on the target model to mitigate specific model weaknesses (hallucination, premature completion, or "AI slop").

### ♊ Gemini Optimizations
Gemini models are treated with "Aggressive Optimism" countermeasures.
- **Tool-Call Mandates**: Explicit blocks (e.g., `<TOOL_CALL_MANDATE>`) force the model to acknowledge that its internal reasoning is unreliable.
- **Thinking Checkpoints**: Mandatory output blocks like `🔍 Thinking Checkpoint` force the model to synthesize findings before moving to the next phase.
- **Anti-Optimism Checkpoints**: Forces the model to verify tasks (LSP diagnostics, tests) before claiming completion.
- **Sources**:
  - [Bob Gemini Overlay](file:///mnt/ai_data/hiai-opencode/src/agents/bob/gemini.ts)
  - [Strategist Gemini Variant](file:///mnt/ai_data/hiai-opencode/src/agents/strategist/gemini.ts)
  - [SubAgent Gemini Variant](file:///mnt/ai_data/hiai-opencode/src/agents/sub/gemini.ts)

### 🤖 GPT & Codex Optimizations
GPT models focus on structural clarity and "Senior Engineer" identity.
- **8-Block Architecture**: Prompts are structured into 8 specific XML-tagged blocks (`<identity>`, `<intent>`, `<explore>`, etc.) to guide GPT's attention.
- **Patch Guard**: Denies usage of `apply_patch` for GPT models as it is deemed unreliable.
- **Preamble Suppression**: Suppresses "AI slop" (e.g., "Certainly!", "I can help with that") in favor of immediate action.
- **Sources**:
  - [Bob GPT-5.4 Variant](file:///mnt/ai_data/hiai-opencode/src/agents/bob/gpt-5-4.ts)
  - [Strategist GPT Variant](file:///mnt/ai_data/hiai-opencode/src/agents/strategist/gpt.ts)
  - [SubAgent Codex Variant](file:///mnt/ai_data/hiai-opencode/src/agents/sub/gpt-5-3-codex.ts)
  - [GPT Patch Guard](file:///mnt/ai_data/hiai-opencode/src/agents/gpt-apply-patch-guard.ts)

---

## 🤖 Core Agents (Orchestration Layer)

### 1. Bob (The Orchestrator)
- **Source**: [bob.ts](file:///mnt/ai_data/hiai-opencode/src/agents/bob.ts)
- **Role**: Primary stakeholder. Handles high-level intent, research, and delegation.
- **Prompting**: Dynamic construction based on available tools/agents.
- **Model Logic**: Uses specific overlays for Gemini (`src/agents/bob/gemini.ts`) and a native rewrite for GPT-5.4 (`src/agents/bob/gpt-5-4.ts`).

### 2. Strategist (The Planning Consultant)
- **Source**: [system-prompt.ts](file:///mnt/ai_data/hiai-opencode/src/agents/strategist/system-prompt.ts)
- **Role**: Plan generation and requirements gathering.
- **Prompting**: Assembled from modular components: [identity-constraints.ts](file:///mnt/ai_data/hiai-opencode/src/agents/strategist/identity-constraints.ts), [interview-mode.ts](file:///mnt/ai_data/hiai-opencode/src/agents/strategist/interview-mode.ts), [plan-generation.ts](file:///mnt/ai_data/hiai-opencode/src/agents/strategist/plan-generation.ts).
- **Model Logic**: Redirects to [gpt.ts](file:///mnt/ai_data/hiai-opencode/src/agents/strategist/gpt.ts) or [gemini.ts](file:///mnt/ai_data/hiai-opencode/src/agents/strategist/gemini.ts) depending on the target model.

### 3. Coder (The Builder)
- **Source**: [agent.ts](file:///mnt/ai_data/hiai-opencode/src/agents/coder/agent.ts)
- **Role**: Goal-oriented implementation. Matches existing naming and architecture patterns.
- **Key Files**: Includes autonomous deep-work logic and `lsp_diagnostics` mandates.

### 4. Guard (The Conductor)
- **Source**: [agent.ts](file:///mnt/ai_data/hiai-opencode/src/agents/guard/agent.ts)
- **Role**: Master orchestrator for todo-list execution. Ensures delegation compliance.

---

## 🛠️ Specialist Agents (Technical Support)

### 5. Logician (Complexity Advisor)
- **Source**: [logician.ts](file:///mnt/ai_data/hiai-opencode/src/agents/logician.ts)
- **Role**: Read-only strategic advisor for architecture and hard bugs. Uses "Oracle" persona.

### 6. Librarian (Reference Specialist)
- **Source**: [librarian.ts](file:///mnt/ai_data/hiai-opencode/src/agents/librarian.ts)
- **Role**: External source researcher. MUST provide GitHub permalinks as evidence.

### 7. Explore (Contextual Grep)
- **Source**: [explore.ts](file:///mnt/ai_data/hiai-opencode/src/agents/explore.ts)
- **Role**: Internal codebase navigation. Mandates structured XML output blocks.

### 8. UI Expert / Multimodal Looker
- **Source**: [ui.ts](file:///mnt/ai_data/hiai-opencode/src/agents/ui.ts)
- **Role**: Analyzes images, PDFs, and layouts. Returns extracted data directly to the orchestrator.

### 9. Pre-Plan (Plan Consultant)
- **Source**: [pre-plan.ts](file:///mnt/ai_data/hiai-opencode/src/agents/pre-plan.ts)
- **Role**: Identifies hidden intentions and scope creep before planning. Generates `MUST`/`MUST NOT` directives.

### 10. Critic (Work Plan Reviewer)
- **Source**: [critic.ts](file:///mnt/ai_data/hiai-opencode/src/agents/critic.ts)
- **Role**: Evaluates executability of plans. Focuses on blocking issues (limit: 3 issues per turn).

### 11. Sub-Agent (Focused Executor)
- **Source**: [agent.ts](file:///mnt/ai_data/hiai-opencode/src/agents/sub/agent.ts)
- **Model Variants**:
  - [Default](file:///mnt/ai_data/hiai-opencode/src/agents/sub/default.ts)
  - [Gemini](file:///mnt/ai_data/hiai-opencode/src/agents/sub/gemini.ts)
  - [Codex](file:///mnt/ai_data/hiai-opencode/src/agents/sub/gpt-5-3-codex.ts)
  - [GPT-5.4](file:///mnt/ai_data/hiai-opencode/src/agents/sub/gpt-5-4.ts)

---

## 🏗️ Platform Specialists (Micode)

### 12. Mindmodel (Pattern Catalog)
- **Source**: [platform-adapter.ts](file:///mnt/ai_data/hiai-opencode/src/agents/platform-adapter.ts)
- **Role**: Orchestrates 7 analysis agents (mm-stack-detector, etc.) to generate `.mindmodel/`.

### 13. Ledger-Creator (Continuity)
- **Source**: [platform-adapter.ts](file:///mnt/ai_data/hiai-opencode/src/agents/platform-adapter.ts)
- **Role**: Session state preservation. Writes `CONTINUITY_{session}.md`.

### 14. Bootstrapper (Branch Explorer)
- **Source**: [platform-adapter.ts](file:///mnt/ai_data/hiai-opencode/src/agents/platform-adapter.ts)
- **Role**: JSON-only JSON branch generator for brainstorming.

### 15. Project-Initializer (Scaffolding)
- **Source**: [platform-adapter.ts](file:///mnt/ai_data/hiai-opencode/src/agents/platform-adapter.ts)
- **Role**: Generates `ARCHITECTURE.md` and `CODE_STYLE.md` in parallel discover mode.

---

## ⚖️ Quality & Integration Agents (Superpowers / Skills)

### 16. Code-Reviewer
- **Source**: Integrated via Superpowers plugin. Formal post-implementation review.

### 17. Systematic-Debugger
- **Source**: Integrated via Superpowers plugin. Logical regression analysis.

### 18. Brainstormer
- **Source**: Integrated via Agent-Skills. High-level ideation.

### 19. Agent-Skills
- **Source**: Integrated via Agent-Skills. Skill management and discovery.

### 20. General
- **Source**: Core Fallback. Multi-purpose generalist.

### 21. Zoe
- **Source**: Core Fallback. Interactive feedback agent.

### 22. Build
- **Source**: Core Fallback. Basic tool/build executor.
