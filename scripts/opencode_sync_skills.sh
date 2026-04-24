#!/usr/bin/env bash
# opencode_sync_skills.sh - Mirror skills with SKILL.md to .opencode/skills/

set -euo pipefail

# Load dynamic environment
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
if [[ -f "$SCRIPT_DIR/opencode_env.sh" ]]; then
    source "$SCRIPT_DIR/opencode_env.sh"
else
    ROOT="/mnt/ai_data"
fi

SOURCE_DIR="$ROOT/hiai-opencode/skills"
TARGET_DIR="$ROOT/.opencode/skills"

mkdir -p "$TARGET_DIR"

if [[ ! -d "$SOURCE_DIR" ]]; then
    echo "Warning: Source skills directory $SOURCE_DIR not found."
    exit 0
fi

echo "Syncing skills from $SOURCE_DIR to $TARGET_DIR..."

# Copy only directories that contain SKILL.md
find "$SOURCE_DIR" -name "SKILL.md" | while read -r skill_file; do
    skill_dir="$(dirname "$skill_file")"
    skill_name="$(basename "$skill_dir")"
    
    echo "  - $skill_name"
    mkdir -p "$TARGET_DIR/$skill_name"
    cp "$skill_file" "$TARGET_DIR/$skill_name/SKILL.md"
done

echo "Sync complete."
