#!/usr/bin/env bash
set -euo pipefail

exec python3 /mnt/ai_data/scripts/opencode_watchdog.py \
  --lock-file /mnt/ai_data/logs/opencode/locks/session.lock \
  --lock-info /mnt/ai_data/logs/opencode/locks/session.lock.info \
  --log-file /mnt/ai_data/logs/opencode/watchdog/systemd.log \
  --state-file /mnt/ai_data/logs/opencode/watchdog/systemd.state.json \
  --poll-seconds "${OPENCODE_WATCHDOG_POLL_SECONDS:-20}" \
  --stale-seconds "${OPENCODE_WATCHDOG_STALE_SECONDS:-300}" \
  --cooldown-seconds "${OPENCODE_WATCHDOG_COOLDOWN_SECONDS:-180}" \
  --child-stale-seconds "${OPENCODE_WATCHDOG_CHILD_STALE_SECONDS:-360}" \
  --child-cooldown-seconds "${OPENCODE_WATCHDOG_CHILD_COOLDOWN_SECONDS:-240}"
