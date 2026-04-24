#!/usr/bin/env bash
set -euo pipefail

ROOT="/mnt/ai_data"
NOTES_DIR="$ROOT/logs/opencode/notes"

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <project_name> <title> [details...]" >&2
  exit 1
fi

PROJECT="$1"
TITLE="$2"
DETAILS="${3:-}"

mkdir -p "$NOTES_DIR"
MONTH_FILE="$NOTES_DIR/$(date +%Y-%m).md"
TS="$(date -Iseconds)"

if [[ ! -f "$MONTH_FILE" ]]; then
  cat >"$MONTH_FILE" <<EOF
# OpenCode Notes $(date +%Y-%m)

EOF
fi

{
  echo "## $TS | $PROJECT | $TITLE"
  if [[ -n "$DETAILS" ]]; then
    echo
    echo "$DETAILS"
  fi
  echo
  echo "- source: opencode/manual"
  echo
} >>"$MONTH_FILE"

echo "Note appended: $MONTH_FILE"
