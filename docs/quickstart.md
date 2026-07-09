# Quick Start — hiai-opencode

Get running in 5 minutes.

## 1. Install the plugin

```bash
opencode plugin @hiai-gg/hiai-opencode@latest --global
```

## 2. Set API keys

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

Required for CLI skills you want to enable:

| Key | Service | Type | Get it at |
|-----|---------|------|-----------|
| `FIRECRAWL_API_KEY` | Firecrawl (web scraping) | CLI skill | https://firecrawl.ai |
| `CONTEXT7_API_KEY` | Context7 (library docs) | On-demand CLI skill | https://context7.com |

> **Note**: Stitch, Context7, and MemPalace MCP servers were removed from the default MCP registry in v0.3.0. Context7 remains available as an on-demand CLI skill via `skill("explore/context7")`.

Model keys (OpenAI-compatible providers) are configured through **OpenCode Connect**, not here.

## 3. Verify setup

```bash
opencode debug config
hiai-opencode doctor
hiai-opencode mcp-status
```

## 4. Your first request

Ask something that exercises the agent system:

```text
Explain how the hiai-opencode agents know about their MCP integrations.
```

Or try delegation:

```text
Use task(category="writing", ...) to write a one-paragraph bio for an AI coding assistant.
```

## 5. View delegation logs

When Bob or Manager delegates to sub-agents, check the system reminders for `<system-reminder>` notifications showing agent results.

## Next steps

- Read [AGENTS.md](../AGENTS.md) to understand each agent's role
- Read [ARCHITECTURE.md](../ARCHITECTURE.md) to understand the plugin internals
- Edit `hiai-opencode.json` (or `.opencode/hiai-opencode.json`) to customize model slots and MCP enable/disable flags
- Run `hiai-opencode export-mcp .opencode/.mcp.json` if you need `opencode mcp list` to show hiai MCP servers
