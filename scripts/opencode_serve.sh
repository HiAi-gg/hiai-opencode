#!/usr/bin/env bash
# Launch opencode serve on port 4096 with all API keys loaded from infra .env
# Used by ai-opencode-serve.service — called directly, bypasses wrapper/start scripts
set -euo pipefail

ROOT="/mnt/ai_data"
OPENCODE_BIN="$(find "$HOME/.nvm/versions/node" -name ".opencode" -type f 2>/dev/null | sort | tail -1)"

if [[ -z "$OPENCODE_BIN" ]]; then
  echo "opencode binary not found under ~/.nvm" >&2
  exit 1
fi

# Load API keys from infra .env (skips comments, empty lines, placeholders)
if [[ -f "$ROOT/infra/docker/.env" ]]; then
  set +u
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "$line" ]] && continue
    [[ "$line" == *'<FILL_IN>'* ]] && continue
    key="${line%%=*}"
    val="${line#*=}"
    [[ -z "${!key:-}" ]] && export "$key"="$val"
  done < "$ROOT/infra/docker/.env"
  set -u
fi

export OPENCODE_CONFIG="${OPENCODE_CONFIG:-$HOME/.config/opencode/opencode.json}"
export OPENCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS="${OPENCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS:-3600000}"

# Apply agent name patches and model config from infra/opencode/agents.json
bash "$ROOT/scripts/opencode_patch_agents.sh" 2>&1 | sed 's/^/[serve] /' || true

exec "$OPENCODE_BIN" serve --port 4096 --hostname 0.0.0.0
