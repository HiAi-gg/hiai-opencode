#!/usr/bin/env bash
set -euo pipefail

# Load dynamic environment
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
if [[ -f "$SCRIPT_DIR/opencode_env.sh" ]]; then
  source "$SCRIPT_DIR/opencode_env.sh"
elif [[ -f "$SCRIPT_DIR/scripts/opencode_env.sh" ]]; then
  source "$SCRIPT_DIR/scripts/opencode_env.sh"
else
  export ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
fi

LOCK_DIR="$ROOT/logs/opencode/locks"
LOCK_FILE="$LOCK_DIR/session.lock"
LOCK_INFO="$LOCK_DIR/session.lock.info"
OPENCODE_BIN="$(which opencode)"

mkdir -p "$LOCK_DIR"

if [[ "${OPENCODE_ALLOW_PARALLEL:-0}" != "1" ]]; then
  stale_pid=""
  if [[ -f "$LOCK_INFO" ]]; then
    stale_pid="$(sed -n 's/^pid=//p' "$LOCK_INFO" | head -n 1 || true)"
  fi
  if [[ -n "$stale_pid" ]] && ! kill -0 "$stale_pid" 2>/dev/null; then
    rm -f "$LOCK_INFO"
  fi
  exec 9>"$LOCK_FILE"
  if ! flock -n 9; then
    echo "Another OpenCode session is already active." >&2
    if [[ -f "$LOCK_INFO" ]]; then
      echo "Lock info:" >&2
      cat "$LOCK_INFO" >&2
    fi
    echo "If you really need parallel launch, set OPENCODE_ALLOW_PARALLEL=1." >&2
    exit 73
  fi
  {
    echo "pid=$$"
    echo "mode=${OPENCODE_SESSION_MODE:-interactive}"
    echo "started_at=$(date -Iseconds)"
    echo "cwd=$(pwd)"
    echo "args=$*"
  } >"$LOCK_INFO"
  cleanup_lock() {
    rm -f "$LOCK_INFO"
  }
  trap cleanup_lock EXIT
fi

# If the wrapper lock is free, normalize the runtime back to a single fresh client.
# This avoids the common failure mode where a stale opencode client survives after
# the previous wrapper exits, and a new launch creates a second session/client.
bash "$ROOT/scripts/opencode_cleanup_stale.sh" --apply --keep-none >/dev/null 2>&1 || true



# Load API keys from infra .env (FIRECRAWL_API_KEY, STITCH_AI_API_KEY, etc.)
if [[ -f "$ROOT/infra/docker/.env" ]]; then
  set +u
  # shellcheck disable=SC2163
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "$line" ]] && continue
    key="${line%%=*}"
    val="${line#*=}"
    [[ -z "${!key:-}" ]] && export "$key"="$val"
  done < "$INFRA/docker/.env"
  set -u
fi

cd "$ROOT"
OPENCODE_CONFIG="${OPENCODE_CONFIG:-$HOME/.config/opencode/opencode.json}" \
OPENCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS="${OPENCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS:-3600000}" \
exec "$OPENCODE_BIN" "$@"
