#!/usr/bin/env bash
set -euo pipefail

LOCAL_STITCH="/mnt/ai_data/.opencode/node_modules/stitch-mcp-auto/index.js"

if [[ -f "$LOCAL_STITCH" ]]; then
  exec node "$LOCAL_STITCH"
fi

CACHED_STITCH="$(find "${HOME}/.npm/_npx" -path '*/node_modules/stitch-mcp-auto/index.js' 2>/dev/null | sort | tail -n 1)"
if [[ -n "$CACHED_STITCH" && -f "$CACHED_STITCH" ]]; then
  exec node "$CACHED_STITCH"
fi

exec npx -y stitch-mcp-auto
