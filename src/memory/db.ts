import { Database as BunDatabase } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { getToolSetting } from "../config";

let _db: BunSQLiteDatabase | null = null;
let _dbPath: string | null = null;
let _initialized = false;

function ensureSchema(sqlite: BunDatabase) {
  if (_initialized && _dbPath) return;
  sqlite.run("PRAGMA journal_mode = WAL");
  sqlite.run(
    `PRAGMA busy_timeout = ${getToolSetting("sqlite_busy_timeout_ms", 5000)}`,
  );

  // Create main table
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS memory_fts (
      id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      scope TEXT NOT NULL,
      scope_id TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL,
      body TEXT NOT NULL,
      fingerprint TEXT NOT NULL,
      last_indexed_at INTEGER NOT NULL
    )
  `);

  // Create FTS5 virtual table (external content)
  sqlite.run(`
    CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts_idx USING fts5(
      body, content='memory_fts', content_rowid='id',
      tokenize='unicode61 remove_diacritics 1'
    )
  `);

  // Create triggers — drop first for idempotency, then recreate
  sqlite.run("DROP TRIGGER IF EXISTS memory_fts_ai");
  sqlite.run("DROP TRIGGER IF EXISTS memory_fts_ad");
  sqlite.run("DROP TRIGGER IF EXISTS memory_fts_au");

  sqlite.run(`
    CREATE TRIGGER memory_fts_ai AFTER INSERT ON memory_fts BEGIN
      INSERT INTO memory_fts_idx(rowid, body) VALUES (NEW.id, NEW.body);
    END
  `);
  sqlite.run(`
    CREATE TRIGGER memory_fts_ad AFTER DELETE ON memory_fts BEGIN
      INSERT INTO memory_fts_idx(memory_fts_idx, rowid, body) VALUES('delete', OLD.id, OLD.body);
    END
  `);
  sqlite.run(`
    CREATE TRIGGER memory_fts_au AFTER UPDATE ON memory_fts BEGIN
      INSERT INTO memory_fts_idx(memory_fts_idx, rowid, body) VALUES('delete', OLD.id, OLD.body);
      INSERT INTO memory_fts_idx(rowid, body) VALUES (NEW.id, NEW.body);
    END
  `);

  // Create indexes
  sqlite.run(
    "CREATE INDEX IF NOT EXISTS memory_fts_scope_idx ON memory_fts(scope, scope_id)",
  );
  sqlite.run(
    "CREATE INDEX IF NOT EXISTS memory_fts_type_idx ON memory_fts(type)",
  );

  _initialized = true;
}

export function getDb(dbPath: string): BunSQLiteDatabase {
  if (_db && _dbPath === dbPath) return _db;
  mkdirSync(dirname(dbPath), { recursive: true });
  const sqlite = new BunDatabase(dbPath);
  ensureSchema(sqlite);
  _db = drizzle(sqlite);
  _dbPath = dbPath;
  return _db;
}

export function resetDb(): void {
  _db = null;
  _dbPath = null;
  _initialized = false;
}
