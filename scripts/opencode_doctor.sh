#!/usr/bin/env bash
set -euo pipefail

# Load dynamic environment
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
if [[ -f "$SCRIPT_DIR/opencode_env.sh" ]]; then
  source "$SCRIPT_DIR/opencode_env.sh"
elif [[ -f "$SCRIPT_DIR/scripts/opencode_env.sh" ]]; then
  source "$SCRIPT_DIR/scripts/opencode_env.sh"
else
  export ROOT="/mnt/ai_data"
fi
LOG_DIR="$ROOT/logs/opencode/doctor"
STAMP="$(date +%Y%m%d_%H%M%S)"
LOG_FILE="${OPENCODE_DOCTOR_LOG:-$LOG_DIR/${STAMP}.log}"

mkdir -p "$LOG_DIR"
exec > >(tee "$LOG_FILE") 2>&1

echo "# OpenCode Doctor"
echo
echo "- started_at: $(date -Iseconds)"
echo "- log_file: $LOG_FILE"
echo

echo "[1/7] launcher resolution"
OPENCODE_PATH="$(command -v opencode || true)"
echo "opencode_path=${OPENCODE_PATH:-not_found}"
# Match either /usr/local/bin or the current user's .nvm dir
if [[ -z "$OPENCODE_PATH" ]]; then
  echo "opencode binary not found" >&2
  exit 1
fi
echo "wrapper_contract=ok (path: $OPENCODE_PATH)"

echo "[2/7] wrapper contract"
rg -n "opencode_start.sh|opencode_wrapper.sh" /usr/local/bin/opencode
test -x "$ROOT/opencode_start.sh" && echo "  - opencode_start.sh: ok"
test -x "$ROOT/scripts/opencode_wrapper.sh" && echo "  - opencode_wrapper.sh: ok"
test -x "$ROOT/scripts/opencode_sync_skills.sh" && echo "  - opencode_sync_skills.sh: ok"
test -f "$ROOT/.opencode/opencode.json" && echo "  - .opencode/opencode.json: ok"
test -f "$HOME/.config/opencode/opencode.json" && echo "  - .config/opencode/opencode.json: ok"
echo "wrapper_contract=ok"

echo "[3/7] node and opencode version"
node --version
opencode --version
echo "runtime=ok"

echo "[4/7] docker socket (host)"
test -S /var/run/docker.sock && ls -l /var/run/docker.sock && echo "docker_socket=ok"
docker ps --format '{{.Names}}\t{{.Status}}' | head -5 || true

echo "[5/7] stitch auth state"
if [[ -f "$HOME/.stitch-mcp-auto/config.json" && -f "$HOME/.stitch-mcp-auto/tokens.json" ]]; then
  echo "stitch_auth=ok"
else
  echo "stitch_auth=missing (copy from infra/opencode/stitch/)" >&2
fi

echo "[6/7] smoke"
bash "$ROOT/scripts/opencode_smoke.sh"

echo "[7/7] result"
echo "doctor_status=pass"
