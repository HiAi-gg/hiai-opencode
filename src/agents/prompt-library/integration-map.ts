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
- researcher       — discovery: local grep + Context7/Firecrawl/grep_app/websearch/RAG/MemPalace
- designer         — UI via Stitch MCP
- brainstormer     — copy/positioning/SEO (write to copy files only)
- vision           — PDF/image extraction
- manager          — MemPalace/RAG memory steward
- quality-guardian — post-impl review + bug investigation
- guard            — sandboxed bash executor

### MCP INTEGRATIONS (who uses what):
- Stitch              -> designer (UI generation)
- Firecrawl           -> researcher (web scrape/search/extract)
- Context7            -> researcher, coder (lib docs)
- grep_app            -> researcher (OSS code patterns)
- websearch           -> researcher (general web)
- RAG                 -> researcher, brainstormer, manager (project knowledge)
- MemPalace           -> manager (primary), all agents (search before answer)
- Sequential-Thinking -> strategist, critic (deep reasoning)
- Playwright          -> coder (only for tests/automation)

### LSP:
- typescript, svelte, eslint, bash, pyright
- -> coder MUST run lsp_diagnostics after every edit
</integration-mental-map>`
}
