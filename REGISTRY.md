# HiaiOpenCode Registry

This document provides a single reference for all capabilities enabled by the `hiai-opencode` platform.

## 🧬 Platform Ancestry & Sources

The `hiai-opencode` platform is a unified consolidation of several industry-leading AI tools and frameworks.

| Component | Source Repository | Principal Author / Org | Role in Platform |
|-----------|------------------|------------------------|------------------|
| **oh-my-openagent** | [code-yeongyu/oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) | code-yeongyu | Core Orchestration & 10 Agents |
| **superpowers** | [obra/superpowers](https://github.com/obra/superpowers) | obra | Systematic Debugging & Planning |
| **micode** | [vtemian/micode](https://github.com/vtemian/micode) | vtemian | Specialist Agents & Bootstrapping |
| **agent-skills** | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | addyosmani | Tactical Workflow Patterns |
| **dcp** | [Opencode-DCP/opencode-dynamic-context-pruning](https://github.com/Opencode-DCP/opencode-dynamic-context-pruning) | Opencode-DCP | Context Optimization |
| **mempalace** | [MemPalace/mempalace](https://github.com/MemPalace/mempalace) | MemPalace | Semantic Memory Graph |
| **websearch-cited** | [ghoulr/opencode-websearch-cited](https://github.com/ghoulr/opencode-websearch-cited) | ghoulr | Grounded Search w/ Citations |
| **playwright-mcp** | [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) | microsoft | Browser Automation |
| **stitch-mcp** | [Kargatharaakash/stitch-mcp](https://github.com/Kargatharaakash/stitch-mcp) | Kargatharaakash | Design Systems & Tokens |
| **firecrawl-mcp** | [firecrawl-ai/firecrawl-mcp-server](https://github.com/firecrawl-ai/firecrawl-mcp-server) | firecrawl-ai | Clean Web Scraping |
| **sequential** | [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking) | Anthropic | Chain-of-Thought Reasoning |
| **pty** | [shekohex/opencode-pty](https://github.com/shekohex/opencode-pty) | shekohex | Terminal Multiplexing |

---

## 🤖 Agents (The Expert Team)

| Agent Name | Role / Specialization | Source Repository |
|------------|-----------------------|-------------------|
| **Bob** | Primary Orchestrator - Research & Delegation | code-yeongyu/oh-my-openagent |
| **Strategist** | Deep Researcher - Multi-signal analysis | code-yeongyu/oh-my-openagent |
| **Coder** | Builder - Code Implementation | code-yeongyu/oh-my-openagent |
| **Guard** | Architect - System Boundaries & Integration | code-yeongyu/oh-my-openagent |
| **General** | General-purpose - Multi-step tasks | code-yeongyu/oh-my-openagent |
| **Zoe** | Interactive Feedback - Real-time UI input | code-yeongyu/oh-my-openagent |
| **Sub** | Lightweight Parallel Sub-tasks | code-yeongyu/oh-my-openagent |
| **Logician** | High-IQ Consultant - Complexity Analysis | code-yeongyu/oh-my-openagent |
| **Explore** | Contextual Codebase Grep & Navigation | code-yeongyu/oh-my-openagent |
| **Librarian** | External Knowledge / Documentation Search | code-yeongyu/oh-my-openagent |
| **Pre-Plan** | Pre-planning & Intent Discovery | code-yeongyu/oh-my-openagent |
| **Critic** | Plan Critic & Sanity Checker | code-yeongyu/oh-my-openagent |
| **UI** | Analyze Images, UI, and Diagrams | code-yeongyu/oh-my-openagent |
| **Mindmodel** | Pattern Catalog - Finding repo conventions | vtemian/micode |
| **Ledger-Creator** | Continuity Ledgers - Session state management | vtemian/micode |
| **Bootstrapper** | Exploration Branches - Early brainstorming | vtemian/micode |
| **Project-Initializer** | Project Scaffolding & Setup | vtemian/micode |
| **Build** | Default Executor - Tool orchestration | code-yeongyu/oh-my-openagent |
| **Code-Reviewer** | Post-implementation Quality & Peer Review | obra/superpowers |
| **Systematic-Debugger** | Structured Bug Investigation | obra/superpowers |
| **Brainstormer** | Creative Exploration & Ideation | addyosmani/agent-skills |
| **Agent-Skills** | Skill Management & Discovery | addyosmani/agent-skills |

---

## 📚 Skills Catalog (32+ Workflows)

### Development Lifecycle (Micode/OMO)
- `spec-driven-development`, `planning-and-task-breakdown`, `incremental-implementation`
- `test-driven-development`, `debugging-and-error-recovery`, `code-review-and-quality`
- `shipping-and-launch`, `context-engineering`, `source-driven-development`

### Superpowers Workflows (obra/superpowers)
- `writing-plans`, `executing-plans`, `systematic-debugging`
- `requesting-code-review`, `receiving-code-review`
- `using-git-worktrees`, `finishing-a-development-branch`
- `dispatching-parallel-agents`, `subagent-driven-development`

### Tactical Specializations (addyosmani/agent-skills)
- `brainstorming`, `api-and-interface-design`, `frontend-ui-engineering`
- `performance-optimization`, `security-and-hardening`, `ci-cd-and-automation`
- `documentation-and-adrs`, `deprecation-and-migration`

---

## 🔌 Integrations (MCP & LSP)

### MCP Servers (11 active)

| Server | Purpose | Source Repository | License |
|--------|---------|-------------------|---------|
| **context7** | Library Documentation | github.com/upstash/context7-mcp | MIT |
| **mempalace** | Semantic Memory | github.com/MemPalace/mempalace | MIT |
| **rag** | Architecture RAG | github.com/HiAi-gg/opencode-rag-mcp | MIT |
| **playwright** | Browser Automation | github.com/microsoft/playwright-mcp | Apache-2.0 |
| **stitch** | Design Systems | github.com/Kargatharaakash/stitch-mcp | Apache-2.0 |
| **sequential** | Reasoning Logic | github.com/modelcontextprotocol/servers | MIT |
| **firecrawl** | Web Scraping | github.com/firecrawl-ai/firecrawl-mcp-server | MIT |
| **websearch** | Cited Web Search | github.com/ghoulr/opencode-websearch-cited | Apache-2.0 |
| **docker** | Database/CLI Access | github.com/alpaca-hq/docker-mcp-registry | MIT |

---

## 📜 Legal & Compliance

Full details on all recursive licenses are available in [LICENSE.md](LICENSE.md).
