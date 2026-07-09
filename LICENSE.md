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
| OpenCode host/runtime | [anomalyco/opencode](https://github.com/anomalyco/opencode) | plugin host and runtime target |
| Core orchestration influences | [code-yeongyu/oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) | important architectural influence |
| Planning / workflow influences | [obra/superpowers](https://github.com/obra/superpowers) | planning, review, and debugging ideas |
| Specialist / platform influences | [vtemian/micode](https://github.com/vtemian/micode) | platform-style specialist behavior |
| Agent skill ecosystem | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) | tactical workflow skill ideas |
| Supabase Postgres skill | [supabase/agent-skills](https://github.com/supabase/agent-skills/blob/main/skills/supabase-postgres-best-practices/SKILL.md) | Postgres best practices skill |
| Browser automation | [vercel-labs/agent-browser](https://github.com/vercel-labs/agent-browser) | CLI-based browser automation via CDP |
| Optional external plugin | [Opencode-DCP/opencode-dynamic-context-pruning](https://github.com/Opencode-DCP/opencode-dynamic-context-pruning) | not bundled |
| MemPalace | [MemPalace/mempalace](https://github.com/MemPalace/mempalace) | external upstream MCP/runtime |
| Sequential Thinking | [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) | external MCP |
| Firecrawl CLI skill | [firecrawl/firecrawl](https://github.com/firecrawl/firecrawl) | CLI-based web scraping, crawl, extract, search |
| Context7 MCP | [upstash/context7](https://github.com/upstash/context7) | external MCP |
| bun-pty / PTY ecosystem | [shekohex/opencode-pty](https://github.com/shekohex/opencode-pty) | PTY/runtime integration influence |
| Design skills, design systems, craft guidelines, prompt templates | [nexu-io/open-design](https://github.com/nexu-io/open-design) | Apache 2.0 — bundled skill definitions, 150+ brand DESIGN.md files, craft typography/color/UX guidelines, image/video prompt templates |

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

## Third-party: open-design

This project includes content from [nexu-io/open-design](https://github.com/nexu-io/open-design).
Copyright (c) nexu-io.
Licensed under the Apache License, Version 2.0.
Full license: https://github.com/nexu-io/open-design/blob/main/LICENSE

Included content:
- `skills/` — 130+ skill definitions with SKILL.md prompts and checklists

**Note**: `design-systems/`, `prompt-templates/`, and `craft/` directories were removed in v0.3.0. These assets remain available from the upstream [nexu-io/open-design](https://github.com/nexu-io/open-design) repository (Apache 2.0).
