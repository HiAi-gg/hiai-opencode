#!/usr/bin/env bash
set -euo pipefail

ROOT="/mnt/ai_data"
WATCHDOG_DIR="$ROOT/logs/opencode/watchdog"
STAMP="$(date +%Y%m%d_%H%M%S)"
LOG_FILE="$WATCHDOG_DIR/recovery_${STAMP}.log"
SESSION_ID="${1:-}"

mkdir -p "$WATCHDOG_DIR"

read -r -d '' PROMPT <<'EOF' || true
A previous interactive OpenCode session stalled and was recovered by the watchdog.
Continue the most recent unfinished task from the latest repository state.

Required behavior:
- inspect the current repo state first
- inspect the latest OpenCode session exports and session markdown under /mnt/ai_data/logs/opencode/sessions if relevant
- continue from the latest unfinished state instead of restarting blindly
- prefer making concrete progress over describing plans
- if the task is complete, end with exactly: TASK_STATUS: DONE
- if the task is truly blocked on missing external input or a hard dependency, end with exactly: TASK_STATUS: BLOCKED
- otherwise end with exactly: TASK_STATUS: CONTINUE
EOF

if [[ -n "$SESSION_ID" ]]; then
  PROMPT+="

Recovery hint: the stalled session id was: $SESSION_ID"
fi

printf '[%s] recovery spawn start session_id=%s\n' "$(date -Iseconds)" "${SESSION_ID:-unknown}" >>"$LOG_FILE"

cd "$ROOT"
OPENCODE_CONFIG="$HOME/.config/opencode/opencode.json" \
timeout 1800 opencode run --dangerously-skip-permissions -c "$PROMPT" --format json >>"$LOG_FILE" 2>&1 &

printf '[%s] recovery spawn end log=%s\n' "$(date -Iseconds)" "$LOG_FILE" >>"$LOG_FILE"
printf '%s\n' "$LOG_FILE"
