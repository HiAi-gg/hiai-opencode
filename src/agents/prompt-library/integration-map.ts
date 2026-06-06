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
AGENTS: bob (you) | coder (deep) | sub (bounded) | strategist | critic | researcher | designer | writer | vision | manager | quality-guardian
MCP: Stitch→designer, Firecrawl→researcher, Context7→coder, grep_app→researcher, MemPalace→all, Sequential-Thinking→critic
LSP: ts/svelte/eslint/bash/pyright — coder: lsp_diagnostics after edits
</integration-mental-map>`
}
