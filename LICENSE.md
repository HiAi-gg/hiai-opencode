# License

The `hiai-opencode` platform is a unified distribution of original and third-party software. Licensing is handled in a modular fashion based on the component's origin.

## 1. hiai-opencode (Original Logic)
**License: MIT**

Copyright (c) 2026 HiAi Team.

Standard MIT terms apply to all orchestration logic, adapters, and configuration schemas created specifically for this platform.

---

## 2. oh-my-openagent (Core Engine)
**License: Sustainable Use License v1.0 (SUL-1.0)**

Significant portions of the core agent orchestration, hook system, and tool registry are derived from **[code-yeongyu/oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent)** by Yeongyu Kim.

**Affected Directories:**
- `src/shared/`, `src/hooks/`, `src/tools/`, `src/agents/` (core personas), `src/features/`.

---

## 3. Integrated Components (MIT License)

The following components are integrated under the **MIT License**:

- **superpowers** ([obra/superpowers](https://github.com/obra/superpowers)): Systematic debugging and planning skills by obra.
- **micode** ([vtemian/micode](https://github.com/vtemian/micode)): Specialist agents and project bootstrapping by vtemian.
- **agent-skills** ([addyosmani/agent-skills](https://github.com/addyosmani/agent-skills)): Tactical AI workflow specializations by addyosmani.
- **mempalace** ([MemPalace/mempalace](https://github.com/MemPalace/mempalace)): Semantic Memory Graph.
- **context7** ([upstash/context7-mcp](https://github.com/upstash/context7-mcp)): Documentation MCP.
- **sequential-thinking** ([modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers)): Reasoning logic.
- **subtask2** ([openspoon/subtask2](https://github.com/openspoon/subtask2)): Recursive orchestration.
- **pty** ([shekohex/opencode-pty](https://github.com/shekohex/opencode-pty)): Terminal multiplexing.
- **docker-mcp** ([alpacahq/docker-mcp-registry](https://github.com/alpacahq/docker-mcp-registry)): Container access.

---

## 4. Integrated Components (Apache License 2.0)

The following components are used under the **Apache License 2.0**:

- **playwright-mcp** ([microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp)): Browser automation.
- **stitch-mcp** ([Kargatharaakash/stitch-mcp](https://github.com/Kargatharaakash/stitch-mcp)): Design tokens & UI extraction.
- **websearch-cited** ([ghoulr/opencode-websearch-cited](https://github.com/ghoulr/opencode-websearch-cited)): Grounded search engine.

---

## 5. opencode-dcp (AGPL-3.0)
**License: GNU Affero General Public License v3.0 (AGPL-3.0)**

The Dynamic Context Pruning plugin is licensed under AGPL-3.0.
- Repository: [Opencode-DCP/opencode-dynamic-context-pruning](https://github.com/Opencode-DCP/opencode-dynamic-context-pruning)

---

## 📜 Full Attribution Grid

| Component | Repository Link | License |
|-----------|-----------------|---------|
| Core Engine | [code-yeongyu/oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) | SUL-1.0 |
| Planning | [obra/superpowers](https://github.com/obra/superpowers) | MIT |
| Specialist Agents | [vtemian/micode](https://github.com/vtemian/micode) | MIT |
| Workflow Skills | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | MIT |
| Context Engine | [Opencode-DCP/opencode-dynamic-context-pruning](https://github.com/Opencode-DCP/opencode-dynamic-context-pruning) | AGPL-3.0 |
| Memory Graph | [MemPalace/mempalace](https://github.com/MemPalace/mempalace) | MIT |
| Search Engine | [ghoulr/opencode-websearch-cited](https://github.com/ghoulr/opencode-websearch-cited) | Apache-2.0 |
| Browser MCP | [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) | Apache-2.0 |
| Design MCP | [Kargatharaakash/stitch-mcp](https://github.com/Kargatharaakash/stitch-mcp) | Apache-2.0 |
