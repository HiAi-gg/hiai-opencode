---
name: supabase-postgres
description: Postgres performance optimization and best practices from Supabase. Use this skill when writing, reviewing, or optimizing Postgres queries, schema designs, or database configurations.
---

# Supabase Postgres Best Practices

Use this skill when working with PostgreSQL databases — writing queries, designing schemas, optimizing performance, or debugging database issues.

## When to Use

- Writing or reviewing SQL queries
- Designing or modifying database schemas
- Optimizing query performance (EXPLAIN ANALYZE, indexes, etc.)
- Debugging connection issues, timeouts, or lock contention
- Working with pgvector extensions for embeddings
- Configuring connection pooling (PgBouncer, Supabase Pooler)

## Key Patterns

### Query Optimization
- Always use `EXPLAIN (ANALYZE, BUFFERS)` for slow queries
- Prefer `EXISTS` over `IN` for subqueries
- Use partial indexes for filtered queries
- Avoid `SELECT *` — specify columns explicitly

### Schema Design
- Use `timestamptz` (not `timestamp`) for all datetime columns
- Prefer `uuid` with `gen_random_uuid()` over serial IDs
- Use `jsonb` (not `json`) for document columns
- Add `ON DELETE CASCADE` or `ON DELETE SET NULL` explicitly

### Connection Management
- Use connection pooling for production workloads
- Set `statement_timeout` and `lock_timeout` per-query when needed
- Monitor `pg_stat_activity` for long-running queries

### pgvector
- Use `vector(1536)` or `vector(768)` for embedding columns
- Create HNSW indexes for approximate nearest neighbor search
- Use `ivfflat` for smaller datasets (<1M rows)

## Integration with hiai-bob

When the Researcher or Writer agents need database context:
1. Use `docker exec ai-core-postgres psql -U aiuser -d ai_orchestration -c "..."` (port 5433) for ai-core database
2. Use `docker exec webs-postgres psql -U admin -d webs -c "..."` (port 5432) for webs database
3. Always check table structures, foreign keys, and metadata BEFORE code changes

## References

- [Supabase Postgres Docs](https://supabase.com/docs/guides/database)
- [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
