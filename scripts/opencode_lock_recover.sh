#!/usr/bin/env bash
set -euo pipefail

ROOT="/mnt/ai_data"
LOCK_DIR="$ROOT/logs/opencode/locks"
LOCK_FILE="$LOCK_DIR/session.lock"
LOCK_INFO="$LOCK_DIR/session.lock.info"

mkdir -p "$LOCK_DIR"

if [[ -f "$LOCK_INFO" ]]; then
  pid="$(sed -n 's/^pid=//p' "$LOCK_INFO" | head -n 1 || true)"
  if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
    echo "lock_ok pid=$pid"
    exit 0
  fi
fi

mapfile -t LINES < <(ps -eo pid,etimes,cmd | rg '/usr/local/lib/node_modules/opencode-ai/bin/.opencode --port' || true)

declare -a CANDIDATES=()
for line in "${LINES[@]}"; do
  pid="$(awk '{print $1}' <<<"$line")"
  etime="$(awk '{print $2}' <<<"$line")"
  port="$(sed -n 's/.*--port \([0-9][0-9]*\).*/\1/p' <<<"$line")"
  [[ -n "$pid" && -n "$port" ]] || continue
  CANDIDATES+=("$pid:$etime:$port")
done

if [[ ${#CANDIDATES[@]} -eq 0 ]]; then
  rm -f "$LOCK_INFO"
  echo "no_local_opencode_processes"
  exit 0
fi

if [[ ${#CANDIDATES[@]} -gt 1 ]]; then
  echo "ambiguous_local_opencode_processes=${#CANDIDATES[@]}"
  exit 2
fi

IFS=: read -r pid etime port <<<"${CANDIDATES[0]}"
touch "$LOCK_FILE"
{
  echo "pid=$pid"
  echo "mode=interactive"
  echo "started_at=$(date -Iseconds --date=@$(( $(date +%s) - etime )) 2>/dev/null || date -Iseconds)"
  echo "recovered_at=$(date -Iseconds)"
  echo "cwd=$ROOT"
  echo "args=--port $port"
} >"$LOCK_INFO"

echo "lock_recovered pid=$pid port=$port"
