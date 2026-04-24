#!/usr/bin/env bash
set -euo pipefail

ROOT="/mnt/ai_data"
UNIT_SRC="$ROOT/infra/systemd"
UNIT_DST="$HOME/.config/systemd/user"

mkdir -p "$UNIT_DST"

for unit in \
  ai-opencode-watchdog.service \
  ai-opencode-healthcheck.service \
  ai-opencode-healthcheck.timer
do
  ln -sf "$UNIT_SRC/$unit" "$UNIT_DST/$unit"
done

systemctl --user daemon-reload
systemctl --user enable --now ai-opencode-watchdog.service
systemctl --user enable --now ai-opencode-healthcheck.timer

echo "Installed user units into $UNIT_DST"
systemctl --user --no-pager --full status ai-opencode-watchdog.service ai-opencode-healthcheck.timer || true
