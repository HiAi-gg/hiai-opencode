/**
 * Postgres Content Update Rules
 *
 * Per user directive (2026-06-08):
 * "From now on, for ALL textual content updates in Postgres, use ONLY
 *  direct psql commands. Do NOT create new migration .sql files.
 *  Use the convenient wrapper script scripts/db-content-update.sh if needed.
 *  Table structure: landing_pages (slug, content jsonb).
 *  Always return query results."
 *
 * This section is interpolated into Bob, Coder, and Manager prompts
 * so all agents that touch landing_pages content follow the same rule.
 */

export const POSTGRES_CONTENT_RULES = `### Postgres Content Updates (LANDING_PAGES)

When you need to read or update content in the \`landing_pages\` table (or any other textual content table):

**HARD RULE: Use ONLY direct psql commands. NEVER create new .sql migration files for content edits.**

The \`landing_pages\` table has at minimum:
- \`slug\` (text, primary identifier)
- \`content\` (jsonb, the textual content to update)

**Tooling**:
- Use the wrapper script: \`./scripts/db-content-update.sh "<SQL>"\`
- Or raw psql: \`psql -h localhost -p 5433 -U aiuser -d ai_orchestration -c "<SQL>"\`
- Override with PGHOST/PGPORT/PGUSER/PGDATABASE env vars if needed

**Always**:
- Use \`scripts/db-content-update.sh\` (or raw psql) to execute queries
- Return the query result to the user (the wrapper does this by default)
- Set \`ON_ERROR_STOP=1\` for safety (the wrapper does this)
- Use \`RETURNING\` clause for UPDATE/INSERT to get the changed rows back

**Examples**:
- Read: \`scripts/db-content-update.sh "SELECT slug, jsonb_pretty(content) FROM landing_pages WHERE slug = 'home'"\`
- Update: \`scripts/db-content-update.sh "UPDATE landing_pages SET content = '{\"hero\":\"new text\"}'::jsonb WHERE slug = 'home' RETURNING slug, content"\`
- Insert: \`scripts/db-content-update.sh "INSERT INTO landing_pages (slug, content) VALUES ('new-page', '{}'::jsonb) RETURNING *"\`

**NEVER**:
- Create a new .sql migration file for content updates
- Use Drizzle/Prisma migrations for landing_pages content
- Use the codebase's schema-change workflow for content edits
- Skip returning the result — always show what the query returned

This rule applies to landing_pages and any other table that holds textual content (not schema/data-model changes — those still go through migrations).`
