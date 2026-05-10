/**
 * Integration Mental Map — shared source of truth for agent/MCP/LSP integration knowledge.
 *
 * Provides a concise reference of which agents use which MCP integrations,
 * what LSP languages are available, and how the system is wired together.
 *
 * Used by Bob (orchestrator) and injected into the hiai-opencode integration primer.
 */

export function buildIntegrationMentalMap(): string {
  return `<integration-mental-map>
## Integration Mental Map

### AGENTS:
- bob (you)        — orchestrator
- coder            — implementation (deep)
- sub              — implementation (cheap, bounded)
- strategist       — planning (read-only, no code)
- critic           — review gate (APPROVED/REJECTED)
- researcher       — discovery: local grep + Context7/Firecrawl/grep_app/firecrawl-cli/MemPalace
- designer         — UI via Stitch MCP
- writer           — copy/positioning/SEO/articles/content (write to copy files only)
- vision           — PDF/image extraction + browser UI verification (agent-browser primary user)
- quality-guardian — post-impl review + bug investigation
- manager          — orchestration, TODO tracking, session handoffs, memory steward

### MCP INTEGRATIONS (who uses what):
- Stitch              -> designer (UI generation) → vision (browser verification) → designer (self-refinement loop)
- Firecrawl           -> researcher (web scrape/search/extract)
- Context7            -> researcher, coder (lib docs)
- grep_app            -> researcher (OSS code patterns)
- firecrawl-cli    -> researcher (web scrape/search/extract)
- MemPalace           -> all agents (search before answer)
- Sequential-Thinking -> strategist, critic (deep reasoning)

### LSP:
- typescript, svelte, eslint, bash, pyright
- -> coder MUST run lsp_diagnostics after every edit
</integration-mental-map>`
}
