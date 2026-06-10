#!/usr/bin/env bash
set -euo pipefail

# db-content-update.sh
# Idempotent Postgres content update helper for agent plans.
# Reads SQL from stdin or a file and executes against the configured PG database.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Defaults — override via env
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5433}"
PGUSER="${PGUSER:-aiuser}"
PGDATABASE="${PGDATABASE:-ai_orchestration}"
PGPASSWORD="${PGPASSWORD:-}"

# Do NOT export PGPASSWORD — pass directly to psql to avoid leaking to child processes

usage() {
  cat <<EOF
Usage: $0 [OPTIONS] [SQL_FILE]

Options:
  -h, --help       Show this help
  -d, --dry-run    Print the SQL instead of executing
  -y, --yes        Skip confirmation prompt

If SQL_FILE is omitted, reads SQL from stdin.
EOF
  exit 1
}

DRY_RUN=false
CONFIRM=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage ;;
    -d|--dry-run) DRY_RUN=true; shift ;;
    -y|--yes) CONFIRM=false; shift ;;
    -*) echo "Unknown option: $1" >&2; usage ;;
    *) break ;;
  esac
done

SQL_INPUT=""
if [[ $# -gt 0 ]]; then
  SQL_FILE="$1"
  [[ -f "$SQL_FILE" ]] || { echo "File not found: $SQL_FILE" >&2; exit 2; }
  SQL_INPUT="$(cat "$SQL_FILE")"
else
  SQL_INPUT="$(cat)"
fi

[[ -z "$SQL_INPUT" ]] && { echo "No SQL provided." >&2; exit 3; }

if [[ "$DRY_RUN" == true ]]; then
  echo "-- DRY RUN --"
  echo "$SQL_INPUT"
  exit 0
fi

if [[ "$CONFIRM" == true ]]; then
  echo "About to execute SQL against ${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}"
  echo "SQL preview (first 500 chars):"
  echo "${SQL_INPUT:0:500}"
  echo
  read -r -p "Proceed? [y/N] " REPLY
  [[ "$REPLY" =~ ^[Yy]$ ]] || { echo "Aborted."; exit 0; }
fi

PGPASSWORD="${PGPASSWORD:-}" psql \
  --no-psqlrc \
  -v ON_ERROR_STOP=1 \
  --set VERBOSITY=verbose \
  -c "$SQL_INPUT"
echo "Done."
