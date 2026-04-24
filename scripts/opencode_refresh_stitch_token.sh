#!/usr/bin/env bash
# Refresh stitch-mcp-auto OAuth token via gcloud
# Sources: host gcloud → running gcloud container → stitch OAuth refresh
# Run every 30min via ai-stitch-token-refresh.timer
set -euo pipefail

TOKENS_PATH="$HOME/.stitch-mcp-auto/tokens.json"
GCLOUD_CONTAINERS=(ai-core-mcp-opencode ai-gcloud-auth)

if [[ ! -f "$TOKENS_PATH" ]]; then
  echo "No tokens.json found at $TOKENS_PATH" >&2
  exit 1
fi

FRESH_TOKEN=""

# 1. Try host gcloud first
if command -v gcloud >/dev/null 2>&1; then
  FRESH_TOKEN="$(gcloud auth print-access-token 2>/dev/null || true)"
  [[ -n "$FRESH_TOKEN" ]] && echo "gcloud source: host"
fi

# 2. Try gcloud from known containers
if [[ -z "$FRESH_TOKEN" ]]; then
  for container in "${GCLOUD_CONTAINERS[@]}"; do
    if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${container}$"; then
      FRESH_TOKEN="$(docker exec "$container" sh -lc 'gcloud auth print-access-token 2>/dev/null' 2>/dev/null || true)"
      if [[ -n "$FRESH_TOKEN" ]]; then
        echo "gcloud source: container $container"
        break
      fi
    fi
  done
fi

if [[ -z "$FRESH_TOKEN" ]]; then
  echo "Failed to get token: no gcloud on host and no gcloud container running" >&2
  echo "Containers tried: ${GCLOUD_CONTAINERS[*]}" >&2
  exit 1
fi

EXPIRY="$(python3 -c "import time; print(int((time.time() + 3500) * 1000))")"

python3 - "$TOKENS_PATH" "$FRESH_TOKEN" "$EXPIRY" << 'PY'
import json, sys
path, token, expiry = sys.argv[1], sys.argv[2], int(sys.argv[3])
with open(path) as f:
    tokens = json.load(f)
tokens['access_token'] = token
tokens['expiry_date'] = expiry
with open(path, 'w') as f:
    json.dump(tokens, f, indent=2)
print(f"stitch token refreshed, expires in ~58min")
PY
