#!/usr/bin/env bash
set -euo pipefail

ROOT="/mnt/ai_data"
PROJECTS_DIR="$ROOT/projects"
BACKUP_DIR="$ROOT/backup/prework"
MODE="${PREWORK_BACKUP_MODE:-smart}"

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <project_name>" >&2
  exit 1
fi

PROJECT_NAME="$1"
SRC="$PROJECTS_DIR/$PROJECT_NAME"

if [[ ! -d "$SRC" ]]; then
  echo "Project not found: $SRC" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
DEST="$BACKUP_DIR/${PROJECT_NAME}_${STAMP}.tar.gz"

TAR_ARGS=(
  -C "$PROJECTS_DIR"
  -czf "$DEST"
  --warning=no-file-changed
  --ignore-failed-read
)

if [[ "$MODE" == "smart" ]]; then
  TAR_ARGS+=(
    --exclude="$PROJECT_NAME/node_modules"
    --exclude="$PROJECT_NAME/**/node_modules"
    --exclude="$PROJECT_NAME/.git"
    --exclude="$PROJECT_NAME/**/.git"
    --exclude="$PROJECT_NAME/.next"
    --exclude="$PROJECT_NAME/**/.next"
    --exclude="$PROJECT_NAME/.svelte-kit"
    --exclude="$PROJECT_NAME/**/.svelte-kit"
    --exclude="$PROJECT_NAME/build"
    --exclude="$PROJECT_NAME/**/build"
    --exclude="$PROJECT_NAME/dist"
    --exclude="$PROJECT_NAME/**/dist"
    --exclude="$PROJECT_NAME/.turbo"
    --exclude="$PROJECT_NAME/**/.turbo"
    --exclude="$PROJECT_NAME/coverage"
    --exclude="$PROJECT_NAME/**/coverage"
    --exclude="$PROJECT_NAME/.cache"
    --exclude="$PROJECT_NAME/**/.cache"
    --exclude="$PROJECT_NAME/tmp"
    --exclude="$PROJECT_NAME/**/tmp"
    --exclude="$PROJECT_NAME/.DS_Store"
    --exclude="$PROJECT_NAME/**/.DS_Store"
    --exclude="$PROJECT_NAME/*.log"
    --exclude="$PROJECT_NAME/**/*.log"
    --exclude="$PROJECT_NAME/data/ollama/id_ed25519"
    --exclude="$PROJECT_NAME/**/id_ed25519"
  )
fi

TAR_ARGS+=("$PROJECT_NAME")

timeout "${PREWORK_BACKUP_TIMEOUT_SECONDS:-180}" tar "${TAR_ARGS[@]}"
echo "Backup created: $DEST"
