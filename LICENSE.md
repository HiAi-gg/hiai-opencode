# Licensing And Attribution

This repository combines original plugin code with integrations and ideas from third-party projects.

## Project License

The original `hiai-opencode` code in this repository is released under the MIT License unless a subcomponent states otherwise.

## Important Attribution Notes

This plugin integrates with or draws from external projects. That does not mean all of those projects are bundled directly into the npm package.

Some are:

- linked as runtime integrations
- referenced as optional external tools
- used as inspiration or source material for specific subsystems

## Core Components And Upstream Projects

| Component | Upstream | Notes |
|---|---|---|
| Core orchestration influences | [code-yeongyu/oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) | important architectural influence |
| Planning / workflow influences | [obra/superpowers](https://github.com/obra/superpowers) | planning, review, and debugging ideas |
| Specialist / platform influences | [vtemian/micode](https://github.com/vtemian/micode) | platform-style specialist behavior |
| Agent skill ecosystem | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | tactical workflow skill ideas |
| Optional external plugin | [Opencode-DCP/opencode-dynamic-context-pruning](https://github.com/Opencode-DCP/opencode-dynamic-context-pruning) | not bundled |
| MemPalace | [MemPalace/mempalace](https://github.com/MemPalace/mempalace) | external upstream MCP/runtime |
| Playwright MCP | [microsoft/playwright-mcp](https://github.com/microsoft/playwright-mcp) | external MCP |
| Sequential Thinking | [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) | external MCP |
| Firecrawl MCP | [firecrawl-ai/firecrawl-mcp-server](https://github.com/firecrawl-ai/firecrawl-mcp-server) | external MCP |
| Context7 MCP | [upstash/context7-mcp](https://github.com/upstash/context7-mcp) | external MCP |
| Websearch cited | [ghoulr/opencode-websearch-cited](https://github.com/ghoulr/opencode-websearch-cited) | search integration influence |
| bun-pty / PTY ecosystem | [shekohex/opencode-pty](https://github.com/shekohex/opencode-pty) | PTY/runtime integration influence |

## What Is Bundled vs External

Bundled in this package:

- plugin runtime code under `src/`
- packaged skills under `skills/`
- packaged runtime assets under `assets/`

Not bundled and expected to be installed or reachable separately when used:

- `opencode-dcp`
- MemPalace upstream runtime
- Firecrawl upstream runtime
- Sequential Thinking upstream runtime
- your own RAG backend

## Open Source Distribution Rule

If you publish this package publicly:

- keep this attribution file
- keep upstream links accurate
- do not imply ownership of upstream MCP servers or external plugins
- document clearly when a dependency is external rather than bundled
