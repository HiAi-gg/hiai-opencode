#!/usr/bin/env bash
set -euo pipefail

LOCK_INFO="/mnt/ai_data/logs/opencode/locks/session.lock.info"
LOCK_FILE="/mnt/ai_data/logs/opencode/locks/session.lock"
APPLY=0
KEEP_MODE="auto"
KEEP_PORT_OVERRIDE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply)
      APPLY=1
      shift
      ;;
    --keep-none)
      KEEP_MODE="none"
      shift
      ;;
    --keep-port)
      KEEP_MODE="port"
      KEEP_PORT_OVERRIDE="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

KEEP_PORT=""
if [[ "$KEEP_MODE" == "port" ]]; then
  KEEP_PORT="$KEEP_PORT_OVERRIDE"
elif [[ "$KEEP_MODE" == "auto" && -f "$LOCK_INFO" ]]; then
  KEEP_PORT="$(sed -n 's/^args=--port //p' "$LOCK_INFO" | head -n 1 || true)"
fi

mapfile -t LINES < <(ps -eo pid,etimes,cmd | rg '/usr/local/lib/node_modules/opencode-ai/bin/.opencode --port' || true)

if [[ ${#LINES[@]} -eq 0 ]]; then
  echo "No local opencode port processes found."
  exit 0
fi

declare -a CANDIDATES=()
LATEST_PID=""
LATEST_PORT=""
LATEST_ETIME=""

for line in "${LINES[@]}"; do
  pid="$(awk '{print $1}' <<<"$line")"
  etime="$(awk '{print $2}' <<<"$line")"
  port="$(sed -n 's/.*--port \([0-9][0-9]*\).*/\1/p' <<<"$line")"
  [[ -n "$port" ]] || continue
  CANDIDATES+=("$pid:$etime:$port:$line")
  if [[ -z "$LATEST_PID" || "$etime" -lt "$LATEST_ETIME" ]]; then
    LATEST_PID="$pid"
    LATEST_PORT="$port"
    LATEST_ETIME="$etime"
  fi
done

if [[ "$KEEP_MODE" == "auto" && -z "$KEEP_PORT" ]]; then
  KEEP_PORT="$LATEST_PORT"
fi

echo "Detected local opencode processes:"
for item in "${CANDIDATES[@]}"; do
  IFS=: read -r pid etime port full <<<"$item"
  mark="drop"
  if [[ -n "$KEEP_PORT" && "$port" == "$KEEP_PORT" ]]; then
    mark="keep"
  fi
  echo "[$mark] pid=$pid etimes=$etime port=$port | $full"
done

if [[ "$APPLY" != "1" ]]; then
  echo
  echo "Dry run only. Re-run with:"
  echo "bash /mnt/ai_data/scripts/opencode_cleanup_stale.sh --apply"
  exit 0
fi

echo
if [[ -n "$KEEP_PORT" ]]; then
  echo "Killing stale opencode processes except port $KEEP_PORT"
else
  echo "Killing all local opencode processes"
fi
for item in "${CANDIDATES[@]}"; do
  IFS=: read -r pid etime port full <<<"$item"
  if [[ -n "$KEEP_PORT" && "$port" == "$KEEP_PORT" ]]; then
    continue
  fi
  kill "$pid" 2>/dev/null || true
done

sleep 2

for item in "${CANDIDATES[@]}"; do
  IFS=: read -r pid etime port full <<<"$item"
  if [[ -n "$KEEP_PORT" && "$port" == "$KEEP_PORT" ]]; then
    continue
  fi
  if ps -p "$pid" >/dev/null 2>&1; then
    kill -9 "$pid" 2>/dev/null || true
  fi
done

echo "Cleanup complete."
ps -eo pid,etimes,cmd | rg '/usr/local/lib/node_modules/opencode-ai/bin/.opencode --port' || true
if [[ "$KEEP_MODE" == "none" ]]; then
  rm -f "$LOCK_INFO" "$LOCK_FILE"
else
  bash /mnt/ai_data/scripts/opencode_lock_recover.sh || true
fi
