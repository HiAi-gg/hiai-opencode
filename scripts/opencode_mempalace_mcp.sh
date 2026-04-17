#!/usr/bin/env bash
# Launch mempalace MCP server for OpenCode sessions palace
# Separate from amigo project palace (different MEMPALACE_PALACE_PATH)
set -euo pipefail

# Load dynamic environment
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
if [[ -f "$SCRIPT_DIR/opencode_env.sh" ]]; then
  source "$SCRIPT_DIR/opencode_env.sh"
fi

PALACE_PATH="${CACHE:-/mnt/ai_data/cache}/mempalace/opencode"

exec env MEMPALACE_PALACE_PATH="$PALACE_PATH" \
  python3 -m mempalace.mcp_server
