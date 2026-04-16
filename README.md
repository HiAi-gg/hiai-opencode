# hiai-opencode 🤖

The unified, 22-agent power-pack for the OpenCode platform. 

`hiai-opencode` isn't just a plugin—it's a massive consolidation of the best agentic technologies, unified into a single, high-performance distribution. We've stripped out legacy naming, removed redundancies, and bundled everything you need to go from idea to production in one tool.

---

## 🍲 The Ingredients

We've brought together the best of multiple worlds:

1.  **oh-my-openagent (Core Engine)**: A powerful orchestration core, hook system, and 10 base agents. The foundation of all logic.
2.  **superpowers (obra/superpowers)**: Advanced planning skills, Systematic Debugging, and TDD.
3.  **micode (vtemian/micode)**: Specialist agents for deep repository pattern analysis and rapid project initialization.
4.  **agent-skills (addyosmani/agent-skills)**: Tactical development patterns (Performance, Security, CI/CD) turned into automated skills.
5.  **DCP (Opencode-DCP)**: Intelligent context pruning to keep sessions from bloating and consuming unnecessary tokens.

---

## 🏗 Key Features

*   **22 Specialist Agents**: From the orchestrator **Bob** to the bug-hunter **Systematic-Debugger**. Each has a defined place in the chain.
*   **32+ Built-in Skills**: Full software lifecycle support, from `idea-refine` to `shipping-and-launch`.
*   **11 MCP Integrations**: Playwright (browser), Stitch (design), MemPalace (semantic memory), RAG, and more.
*   **5 LSP Servers**: Deep understanding of TS, Svelte, Python, Bash, and ESLint right out of the box.

---

## 🚀 Quick Start & Installation

We have prepared an **onboarding** script that handles all dependency installation, virtual environment setup, and LSP server configuration.

### 1. Install all dependencies
Run the script from the project root:
```bash
bash scripts/onboard.sh
```
*What it does: installs Bun, Python 3.12+, Node.js, all LSP servers, builds the project, and configures paths.*

### 2. Manual Build (if needed)
```bash
cd hiai-opencode
bun install
bun run build
```

### 3. Start Session
```bash
bash opencode_start.sh
```

---

## 📖 Documentation Navigation

-   **[REGISTRY.md](REGISTRY.md)**: Master reference for all agents, skills, and technologies with their authors and repositories.
-   **[ARCHITECTURE.md](ARCHITECTURE.md)**: Detailed breakdown of the 24 build phases and core architecture.
-   **[hiai-opencode.json](hiai-opencode.json)**: Single configuration file for model assignment and MCP toggles.
-   **[LICENSE.md](LICENSE.md)**: Legal information (MIT, SUL-1.0, Apache-2.0, AGPL-3.0).

---

## 📜 Acknowledgments

This project would not be possible without the work of individuals and teams like **Yeongyu Kim**, **Microsoft**, **Google**, **Anthropic**, **Addy Osmani**, **vtemian**, **obra**, and the **OpenCode** community.
