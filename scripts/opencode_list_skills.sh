#!/usr/bin/env bash
set -euo pipefail

ROOT="/mnt/ai_data"
SKILLS_DIR="$ROOT/skills"

if [[ ! -d "$SKILLS_DIR" ]]; then
  echo "Skills directory not found: $SKILLS_DIR" >&2
  exit 1
fi

echo "Skills in $SKILLS_DIR:"
find "$SKILLS_DIR" -mindepth 2 -maxdepth 2 -name SKILL.md -print \
  | sed "s|$SKILLS_DIR/||; s|/SKILL.md||" \
  | sort

if [[ -d "$ROOT/.opencode/skills" ]]; then
  echo
  echo "UI skills mirror in $ROOT/.opencode/skills:"
  find "$ROOT/.opencode/skills" -mindepth 2 -maxdepth 2 -name SKILL.md -print \
    | sed "s|$ROOT/.opencode/skills/||; s|/SKILL.md||" \
    | sort
fi
