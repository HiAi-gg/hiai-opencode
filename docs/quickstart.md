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

Required for MCP services you want to enable:

| Key | Service | Get it at |
|-----|---------|-----------|
| `STITCH_AI_API_KEY` | Stitch (UI generation) | https://stitch.ai |
| `FIRECRAWL_API_KEY` | Firecrawl (web scraping) | https://firecrawl.ai |
| `CONTEXT7_API_KEY` | Context7 (library docs) | https://context7.com |
| `EXA_API_KEY` | Exa web search | https://exa.ai |
| `TAVILY_API_KEY` | Tavily web search | https://tavily.com |

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

When Bob or Guard delegates to sub-agents, check the system reminders for `<system-reminder>` notifications showing agent results.

## Next steps

- Read [AGENTS.md](AGENTS.md) to understand each agent's role
- Read [ARCHITECTURE.md](ARCHITECTURE.md) to understand the plugin internals
- Edit `hiai-opencode.json` (or `.opencode/hiai-opencode.json`) to customize model slots and MCP enable/disable flags
- Run `hiai-opencode export-mcp .mcp.json` if you need `opencode mcp list` to show hiai MCP servers
