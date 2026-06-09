#!/usr/bin/env bash
# scripts/db-content-update.sh
#
# Direct psql wrapper for TEXTUAL content updates to Postgres.
# Per user rule (2026-06-08): NO new .sql migration files for content edits.
# Always use this wrapper for landing_pages.content (slug, content jsonb) updates.
#
# Usage:
#   scripts/db-content-update.sh "SELECT slug FROM landing_pages WHERE slug = 'home'"
#   scripts/db-content-update.sh "UPDATE landing_pages SET content = '{\"hero\":\"x\"}'::jsonb WHERE slug = 'home' RETURNING slug, content"
#
# Connection: localhost:5433, user=aiuser, db=ai_orchestration
# (Override with PGHOST, PGPORT, PGUSER, PGDATABASE env vars)

set -euo pipefail

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5433}"
PGUSER="${PGUSER:-aiuser}"
PGDATABASE="${PGDATABASE:-ai_orchestration}"
PSQL="${PSQL:-psql}"

if [ $# -lt 1 ]; then
  echo "Usage: $0 '<SQL-STATEMENT>'" >&2
  echo "Example: $0 \"SELECT slug, jsonb_pretty(content) FROM landing_pages WHERE slug = 'home'\"" >&2
  exit 2
fi

SQL="$1"

# Run the query, always return the result (no -q, no -t).
# Use --csv for machine-readable output, or omit for human-readable.
exec "$PSQL" \
  --host="$PGHOST" \
  --port="$PGPORT" \
  --username="$PGUSER" \
  --dbname="$PGDATABASE" \
  --no-psqlrc \
  --set ON_ERROR_STOP=1 \
  --set VERBOSITY=verbose \
  -c "$SQL"
