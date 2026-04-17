#!/usr/bin/env bash
set -euo pipefail

ROOT="/mnt/ai_data"
LOCK_INFO="$ROOT/logs/opencode/locks/session.lock.info"
WATCHDOG_LOG="$ROOT/logs/opencode/watchdog/systemd.log"

bash "$ROOT/scripts/opencode_lock_recover.sh" >/dev/null 2>&1 || true

echo "== OpenCode Status =="
echo

echo "== lock"
if [[ -f "$LOCK_INFO" ]]; then
  cat "$LOCK_INFO"
else
  echo "no active lock info"
fi
echo

echo "== watchdog service"
systemctl --user is-active ai-opencode-watchdog.service 2>/dev/null || true
systemctl --user is-enabled ai-opencode-watchdog.service 2>/dev/null || true
echo

echo "== health timer"
systemctl --user is-active ai-opencode-healthcheck.timer 2>/dev/null || true
systemctl --user is-enabled ai-opencode-healthcheck.timer 2>/dev/null || true
echo

echo "== watchdog tail"
tail -n 40 "$WATCHDOG_LOG" 2>/dev/null || echo "no watchdog log yet"
echo

echo "== local opencode processes"
ps -eo pid,etimes,cmd | rg '/usr/local/lib/node_modules/opencode-ai/bin/.opencode --port' || echo "no local opencode port processes"
echo

echo "== latest session"
python3 - <<'PY'
import sqlite3, time, os
db = os.path.expanduser("~/.local/share/opencode/opencode.db")
try:
    con = sqlite3.connect(db)
    con.row_factory = sqlite3.Row
    cur = con.cursor()
    row = cur.execute("SELECT id,title,time_updated FROM session WHERE directory='/mnt/ai_data' ORDER BY time_updated DESC LIMIT 1").fetchone()
    print(dict(row) if row else None)
    if row:
        sid = row['id']
        m = cur.execute("SELECT MAX(time_updated) FROM message WHERE session_id=?", (sid,)).fetchone()[0]
        p = cur.execute("SELECT MAX(time_updated) FROM part WHERE session_id=?", (sid,)).fetchone()[0]
        latest = max(v for v in [row['time_updated'], m, p] if v is not None)
        print("idle_seconds", int(time.time() - latest / 1000))
        print("last_parts")
        for pr in cur.execute("SELECT time_updated, substr(data,1,240) FROM part WHERE session_id=? ORDER BY time_updated DESC LIMIT 5", (sid,)):
            print(pr[0], pr[1])
except Exception as e:
    print(f"db_error: {e}")
PY
echo

echo "== session list"
OPENCODE_CONFIG="$HOME/.config/opencode/opencode.json" timeout 10 opencode session list 2>/dev/null || echo "no sessions or opencode not running"
