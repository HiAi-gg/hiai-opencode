import { Database as BunDatabase } from "bun:sqlite";
import os from "node:os";
import path from "node:path";
import { buildFtsQuery } from "./fts-query";
import { reconcileMemory, setMemoryDbPath } from "./reconcile";

type SearchRow = {
  path: string;
  scope: string;
  scope_id: string;
  type: string;
  snippet: string;
  score: number;
};

export interface MemoryServiceConfig {
  memoryRoot: string;
  dbPath: string;
  ccIndex?: boolean;
  reconcileOnSearch?: boolean;
  searchScoreFloor?: number;
}

const ccBaseDefault = path.join(os.homedir(), ".claude", "projects");

export function createMemoryService(config: MemoryServiceConfig) {
  setMemoryDbPath(config.dbPath);
  const root = config.memoryRoot;

  function getRawDb(): BunDatabase {
    return new BunDatabase(config.dbPath);
  }

  return {
    root: () => root,

    reconcile: async () => {
      const cc = config.ccIndex ? ccBaseDefault : undefined;
      return reconcileMemory({ mimo: root, cc });
    },

    search: async (input: {
      query: string;
      scope?: string;
      scope_id?: string;
      type?: string;
      limit?: number;
    }): Promise<
      Array<{
        path: string;
        snippet: string;
        score: number;
        scope: string;
        scope_id: string;
        type: string;
      }>
    > => {
      if (config.reconcileOnSearch ?? true) {
        const cc = config.ccIndex ? ccBaseDefault : undefined;
        await reconcileMemory({ mimo: root, cc });
      }

      const limit = input.limit ?? 10;
      const ftsQuery = buildFtsQuery(input.query);
      if (!ftsQuery) return [];

      const floorRatio = config.searchScoreFloor ?? 0.15;

      const conditions: string[] = [];
      const params: string[] = [];
      if (input.scope) {
        conditions.push("memory_fts.scope = ?");
        params.push(input.scope);
      }
      if (input.scope_id) {
        conditions.push("memory_fts.scope_id = ?");
        params.push(input.scope_id);
      }
      if (input.type) {
        conditions.push("memory_fts.type = ?");
        params.push(input.type);
      }
      const whereClause =
        conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";

      const sql = `
        SELECT memory_fts.path, memory_fts.scope, memory_fts.scope_id, memory_fts.type,
               snippet(memory_fts_idx, 0, '<<', '>>', '...', 32) AS snippet,
               bm25(memory_fts_idx) AS score
        FROM memory_fts_idx
        JOIN memory_fts ON memory_fts.id = memory_fts_idx.rowid
        WHERE memory_fts_idx MATCH ?
        ${whereClause}
        ORDER BY score
        LIMIT ?
      `;

      const fetchLimit = Math.min(limit * 3, 50);
      const rawDb = getRawDb();
      const rows = rawDb
        .query(sql)
        .all(ftsQuery, ...params, fetchLimit) as SearchRow[];

      const mapped = rows.map((r) => ({
        path: r.path,
        snippet: r.snippet,
        score: -r.score,
        scope: r.scope,
        scope_id: r.scope_id,
        type: r.type,
      }));
      if (mapped.length === 0) return [];

      const topScore = mapped[0].score;
      const cutoff =
        floorRatio > 0 ? topScore * floorRatio : Number.NEGATIVE_INFINITY;
      return mapped
        .filter((r, i) => i === 0 || r.score >= cutoff)
        .slice(0, limit);
    },
  };
}
