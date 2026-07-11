/**
 * Create the `hiai_memory_search` tool — a SQLite FTS5 BM25 search over the
 * plugin-managed memory index.
 *
 * DISTINCTION FROM NATIVE `memory` TOOL:
 *
 * | Aspect | `memory` (native, OpenCode) | `hiai_memory_search` (plugin) |
 * |--------|----------------------------|-------------------------------|
 * | Backend | Full-text indexed MD files | SQLite FTS5 BM25 |
 * | Scope  | MEMORY.md, checkpoints, notes.md, task progress | Raw session transcripts + agent trajectories + tool outputs |
 * | Latency | Low | Low |
 * | Use    | Curated durable facts | Forensic search across raw history |
 *
 * The native `memory` tool is the primary recall mechanism for curated
 * knowledge (decisions, patterns, architecture). This tool complements it
 * by indexing raw session transcripts that the native memory system does
 * not index — use this when you need to search across agent trajectories,
 * tool outputs, or session history not captured in curated MD files.
 *
 * Both tools use BM25 ranking. Results include scope, type, path, score,
 * and a text snippet.
 */
import { type ToolContext, tool } from "@opencode-ai/plugin";
import type { createMemoryService } from "../memory/service";

export function createMemoryTool(
  memoryService: ReturnType<typeof createMemoryService>,
) {
  return tool({
    description:
      "Search project memory using BM25 full-text search. Covers MEMORY.md, checkpoint.md, notes.md, and task progress files. Use for recalling durable facts, decisions, patterns, and past context.",
    args: {
      query: tool.schema
        .string()
        .describe("Search query — use 1-3 distinctive terms"),
      scope: tool.schema
        .string()
        .optional()
        .describe(
          'Scope filter: "global", "projects", "sessions", or leave empty for all',
        ),
      scope_id: tool.schema
        .string()
        .optional()
        .describe("Scope ID (project hash or session ID)"),
      type: tool.schema
        .string()
        .optional()
        .describe(
          'Type filter: "memory", "checkpoint", "progress", "notes", "free"',
        ),
    },
    async execute(input, context?: ToolContext) {
      const start = performance.now();
      try {
        const results = await memoryService.search({
          query: input.query,
          scope: input.scope,
          scope_id: input.scope_id,
          type: input.type,
          limit: 10,
        });

        const duration_ms = Math.round(performance.now() - start);
        const result_count = results.length;
        context?.metadata({
          metadata: {
            tool: "memory",
            query: input.query,
            result_count,
            duration_ms,
          },
        });

        if (results.length === 0) {
          return {
            title: "No memory matches",
            output:
              "No results found. Try:\n" +
              "- Fewer or different search terms\n" +
              "- Broader scope (omit scope/type filters)\n" +
              "- Grep the memory directory directly\n" +
              "- Use the history tool to find sessions by topic",
          };
        }

        const lines = results.map(
          (r) =>
            `[${r.scope}/${r.type}] score=${r.score.toFixed(1)}\n` +
            `  path: ${r.path}\n` +
            `  snippet: ${r.snippet}`,
        );

        return {
          title: `${results.length} memory result(s)`,
          output: lines.join("\n\n"),
        };
      } catch (err) {
        const duration_ms = Math.round(performance.now() - start);
        context?.metadata({
          metadata: {
            tool: "memory",
            query: input.query,
            result_count: 0,
            duration_ms,
          },
        });
        return {
          title: "Memory search failed",
          output: `Error: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  });
}
