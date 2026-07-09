import { tool } from "@opencode-ai/plugin";
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
    async execute(input) {
      try {
        const results = await memoryService.search({
          query: input.query,
          scope: input.scope,
          scope_id: input.scope_id,
          type: input.type,
          limit: 10,
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
        return {
          title: "Memory search failed",
          output: `Error: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  });
}
