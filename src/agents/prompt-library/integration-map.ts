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
AGENTS: bob (you, orchestrator) | coder (deep impl) | sub (bounded) | strategist (plan) | critic (review) | researcher (grep+docs) | designer (UI/Stitch) | writer (copy) | vision (PDF/browser) | manager (memory) | quality-guardian (post-impl)
MCP: Stitch→designer, Firecrawl→researcher, Context7→researcher/coder, grep_app→researcher, MemPalace→all, Sequential-Thinking→strategist/critic
LSP: typescript/svelte/eslint/bash/pyright — coder runs lsp_diagnostics after edits
</integration-mental-map>`
}
