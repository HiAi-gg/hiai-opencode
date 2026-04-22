#!/usr/bin/env bash
set -euo pipefail

# Load dynamic environment
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
if [[ -f "$SCRIPT_DIR/scripts/opencode_env.sh" ]]; then
  source "$SCRIPT_DIR/scripts/opencode_env.sh"
elif [[ -f "$SCRIPT_DIR/opencode_env.sh" ]]; then
  source "$SCRIPT_DIR/opencode_env.sh"
else
  # Fallback to hardcoded if env script not found
  export ROOT="/mnt/ai_data"
  export SCRIPTS="$ROOT/scripts"
  export INFRA="$ROOT/infra"
fi

LOG_ROOT="$ROOT/logs/opencode"
APPROVAL_DIR="$LOG_ROOT/approval"
WATCHDOG_DIR="$LOG_ROOT/watchdog"
SMOKE_DIR="$LOG_ROOT/smoke"
DOCTOR_DIR="$LOG_ROOT/doctor"
SESSIONS_DIR="$LOG_ROOT/sessions"
EXPORTS_DIR="$SESSIONS_DIR/exports"
NOTES_DIR="$LOG_ROOT/notes"
BACKUP_ROOT="$ROOT/backup/prework"

PROJECTS_CSV=""
SESSION_NOTE="manual session start"
GOAL_FILE=""
SUPERVISE=0
JUDGE_COMMAND=""
FAST_START="${OPENCODE_FAST_START:-0}"
declare -a OPENCODE_ARGS=()
declare -a SUPERVISOR_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --projects)
      PROJECTS_CSV="${2:-}"
      shift 2
      ;;
    --note)
      SESSION_NOTE="${2:-manual session start}"
      shift 2
      ;;
    --goal-file)
      GOAL_FILE="${2:-}"
      shift 2
      ;;
    --supervise)
      SUPERVISE=1
      shift
      ;;
    --judge-command)
      JUDGE_COMMAND="${2:-}"
      shift 2
      ;;
    --fast)
      FAST_START=1
      shift
      ;;
    --full)
      FAST_START=0
      shift
      ;;
    --)
      shift
      OPENCODE_ARGS+=("$@")
      break
      ;;
    *)
      OPENCODE_ARGS+=("$1")
      shift
      ;;
  esac
done

STAMP="$(date +%Y%m%d_%H%M%S)"
DATE_ISO="$(date -Iseconds)"
START_MS="$(date +%s%3N)"

mkdir -p "$APPROVAL_DIR" "$WATCHDOG_DIR" "$SMOKE_DIR" "$DOCTOR_DIR" "$SESSIONS_DIR" "$EXPORTS_DIR" "$NOTES_DIR" "$BACKUP_ROOT"

bash "$SCRIPTS/opencode_lock_recover.sh" >/dev/null 2>&1 || true

SESSION_MD="$SESSIONS_DIR/${STAMP}.md"
APPROVAL_LOG="$APPROVAL_DIR/${STAMP}.md"
WATCHDOG_LOG="$WATCHDOG_DIR/${STAMP}.log"
WATCHDOG_STATE="$WATCHDOG_DIR/${STAMP}.state.json"
SMOKE_LOG="$SMOKE_DIR/${STAMP}.log"
DOCTOR_LOG="$DOCTOR_DIR/${STAMP}.log"
BACKUP_LINES=""
DOCTOR_STATUS=""
APPROVAL_STATUS=""
WATCHDOG_PID=""

cleanup_background() {
  if [[ -n "$WATCHDOG_PID" ]] && kill -0 "$WATCHDOG_PID" 2>/dev/null; then
    kill "$WATCHDOG_PID" 2>/dev/null || true
    wait "$WATCHDOG_PID" 2>/dev/null || true
  fi
}

systemd_watchdog_active() {
  systemctl --user is-active --quiet ai-opencode-watchdog.service 2>/dev/null
}

trap cleanup_background EXIT INT TERM

backup_context_bundle() {
  local dest="$BACKUP_ROOT/context_${STAMP}.tar.gz"
  tar -C "$ROOT" -czf "$dest" \
    AGENTS.md \
    docs/runbooks/opencode_autonomy.md \
    infra/opencode \
    scripts/opencode_smoke.sh \
    scripts/opencode_wrapper.sh \
    scripts/opencode_note.sh \
    scripts/opencode_permission_dog.py \
    scripts/opencode_rag_mcp.mjs \
    scripts/opencode_watchdog.py \
    opencode_start.sh
  BACKUP_LINES+="- backup_context: $dest"$'\n'
}

if [[ -n "$PROJECTS_CSV" ]]; then
  IFS=',' read -r -a PROJECTS <<<"$PROJECTS_CSV"
  for project in "${PROJECTS[@]}"; do
    project="$(echo "$project" | xargs)"
    if [[ -z "$project" ]]; then
      continue
    fi
    echo "==> [backup] $project"
    backup_output="$("$SCRIPTS/prework_backup.sh" "$project")"
    backup_path="${backup_output#Backup created: }"
    echo "$backup_output"
    BACKUP_LINES+="- backup_project_${project}: $backup_path"$'\n'
  done
else
  if [[ "$FAST_START" != "1" ]]; then
    echo "==> [backup] context bundle (no --projects provided)"
    backup_context_bundle
    echo "Context backup created."
  else
    echo "==> [backup] skipped (fast start)"
  fi
fi

echo "==> [approval-dog] policy"
if python3 "$SCRIPTS/opencode_permission_dog.py" \
  --config "$ROOT/.opencode/opencode.json" \
  --log "$APPROVAL_LOG"; then
  APPROVAL_STATUS="pass"
else
  APPROVAL_STATUS="fail"
fi
echo "Approval dog status: $APPROVAL_STATUS"
echo "Approval dog log: $APPROVAL_LOG"

if [[ "$FAST_START" != "1" ]]; then
  echo "==> [doctor] opencode runtime"
  if OPENCODE_DOCTOR_LOG="$DOCTOR_LOG" bash "$SCRIPTS/opencode_doctor.sh"; then
    DOCTOR_STATUS="pass"
  else
    DOCTOR_STATUS="fail"
  fi
  echo "Doctor status: $DOCTOR_STATUS"
  echo "Doctor log: $DOCTOR_LOG"
else
  DOCTOR_STATUS="skipped_fast_start"
  echo "==> [doctor] skipped (fast start)"
fi

if [[ "$FAST_START" != "1" ]]; then
  echo "==> [smoke] opencode runtime"
  if bash "$SCRIPTS/opencode_smoke.sh" >"$SMOKE_LOG" 2>&1; then
    SMOKE_STATUS="pass"
  else
    SMOKE_STATUS="fail"
  fi
  echo "Smoke status: $SMOKE_STATUS"
  echo "Smoke log: $SMOKE_LOG"
else
  SMOKE_STATUS="skipped_fast_start"
  echo "==> [smoke] skipped (fast start)"
fi

{
  echo "# OpenCode Session"
  echo
  echo "- started_at: $DATE_ISO"
  if [[ -n "$PROJECTS_CSV" ]]; then
    echo "- projects: $PROJECTS_CSV"
  else
    echo "- projects: not_specified"
  fi
  if [[ -n "$GOAL_FILE" ]]; then
    echo "- goal_file: $GOAL_FILE"
  else
    echo "- goal_file: not_specified"
  fi
  echo "- supervise: $SUPERVISE"
  echo "- fast_start: $FAST_START"
  echo "- approval_status: $APPROVAL_STATUS"
  echo "- approval_log: $APPROVAL_LOG"
  echo "- doctor_status: $DOCTOR_STATUS"
  echo "- doctor_log: $DOCTOR_LOG"
  echo "- smoke_status: $SMOKE_STATUS"
  echo "- smoke_log: $SMOKE_LOG"
  echo "- watchdog_log: $WATCHDOG_LOG"
  echo "- note: $SESSION_NOTE"
  if [[ -n "$BACKUP_LINES" ]]; then
    echo "$BACKUP_LINES"
  fi
  echo "## Next Actions"
  echo
  echo "- Run OpenCode via \`bash $SCRIPTS/opencode_wrapper.sh\`"
  echo "- Append decisions to \`$NOTES_DIR/\`"
} >"$SESSION_MD"

echo "Session note saved: $SESSION_MD"

if [[ "$APPROVAL_STATUS" != "pass" ]]; then
  echo "Approval dog failed. Fix permission policy first." >&2
  echo "Approval: $APPROVAL_LOG" >&2
  exit 2
fi

if [[ "$FAST_START" != "1" && ( "$DOCTOR_STATUS" != "pass" || "$SMOKE_STATUS" != "pass" ) ]]; then
  echo "Approval dog, doctor, or smoke failed. Fix runtime first." >&2
  echo "Doctor: $DOCTOR_LOG" >&2
  echo "Smoke:  $SMOKE_LOG" >&2
  exit 2
fi

if [[ "$SUPERVISE" == "1" ]]; then
  if [[ -z "$GOAL_FILE" ]]; then
    echo "--supervise requires --goal-file" >&2
    exit 2
  fi
  echo "==> [supervisor] autonomous loop"
  SUPERVISOR_ARGS=(
    --goal-file "$GOAL_FILE"
    --note "$SESSION_NOTE"
    --projects "${PROJECTS_CSV:-not_specified}"
  )
  if [[ -n "$JUDGE_COMMAND" ]]; then
    SUPERVISOR_ARGS+=(--judge-command "$JUDGE_COMMAND")
  fi
  python3 "$SCRIPTS/opencode_supervisor.py" "${SUPERVISOR_ARGS[@]}"
  exit $?
fi

if systemd_watchdog_active; then
  echo "==> [watchdog] using active systemd user service"
  echo "Watchdog service: ai-opencode-watchdog.service"
  echo "Watchdog log: $WATCHDOG_DIR/systemd.log"
else
  echo "==> [watchdog] start background monitor"
  python3 "$SCRIPTS/opencode_watchdog.py" \
    --lock-file "$ROOT/logs/opencode/locks/session.lock" \
    --lock-info "$ROOT/logs/opencode/locks/session.lock.info" \
    --log-file "$WATCHDOG_LOG" \
    --state-file "$WATCHDOG_STATE" \
    >/dev/null 2>&1 &
  WATCHDOG_PID=$!
  echo "Watchdog pid: $WATCHDOG_PID"
  echo "Watchdog log: $WATCHDOG_LOG"
fi

echo "==> [run] opencode"
bash "$SCRIPTS/opencode_wrapper.sh" "${OPENCODE_ARGS[@]}"
RUN_EXIT_CODE=$?
END_ISO="$(date -Iseconds)"

LATEST_SESSION_ID="$(python3 - <<'PY'
import sqlite3, os
db = os.path.expanduser("~/.local/share/opencode/opencode.db")
try:
  con = sqlite3.connect(db)
  cur = con.cursor()
  row = cur.execute(
      "SELECT id FROM session WHERE directory = ? AND time_updated >= ? ORDER BY time_updated DESC LIMIT 1",
      ('${ROOT}', ${START_MS},),
  ).fetchone()
  print(row[0] if row else '')
except Exception:
  print('')
PY
)"

EXPORT_FILE=""
if [[ -n "$LATEST_SESSION_ID" ]]; then
  EXPORT_FILE="$EXPORTS_DIR/${STAMP}_${LATEST_SESSION_ID}.json"
  OPENCODE_CONFIG="${HOME}/.config/opencode/opencode.json" opencode export "$LATEST_SESSION_ID" >"$EXPORT_FILE" || true
fi

{
  echo
  echo "## Session Result"
  echo
  echo "- ended_at: $END_ISO"
  echo "- exit_code: $RUN_EXIT_CODE"
  if [[ -n "$LATEST_SESSION_ID" ]]; then
    echo "- session_id: $LATEST_SESSION_ID"
    echo "- export_json: $EXPORT_FILE"
  else
    echo "- session_id: not_found"
    echo "- export_json: not_created"
  fi
} >>"$SESSION_MD"

if [[ -n "$LATEST_SESSION_ID" ]]; then
  echo "Session exported: $EXPORT_FILE"
else
  echo "Session export skipped: no session created after start timestamp."
fi

MONTH_FILE="$NOTES_DIR/$(date +%Y-%m).md"
python3 "$SCRIPTS/opencode_knowledge_loop.py" \
  --session-md "$SESSION_MD" \
  --export-json "$EXPORT_FILE" \
  --month-file "$MONTH_FILE" \
  --projects "${PROJECTS_CSV:-not_specified}" \
  --session-note "$SESSION_NOTE" || true

exit "$RUN_EXIT_CODE"
