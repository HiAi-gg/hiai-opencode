#!/usr/bin/env bash

# opencode_env.sh - Robust environment discovery for OpenCode
# Source this script to get reliable $ROOT and path variables.

find_opencode_root() {
    # Start from the directory of the script that is being executed
    local current_dir
    current_dir="$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")"
    
    while [[ "$current_dir" != "/" ]]; do
        if [[ -f "$current_dir/AGENTS.md" ]]; then
            echo "$current_dir"
            return 0
        fi
        current_dir="$(dirname "$current_dir")"
    done
    # Fallback to /mnt/ai_data if nothing found (backwards compatibility)
    echo "/mnt/ai_data"
}

# Core Path Constants
export ROOT="$(find_opencode_root)"
export BIN="$ROOT/bin"
export SCRIPTS="$ROOT/scripts"
export INFRA="$ROOT/infra"
export LOGS="$ROOT/logs"
export CACHE="$ROOT/cache"
export VENV="$ROOT/.venv"

# Config Paths
export OPENCODE_CONFIG_DIR="$ROOT/.opencode"
export OPENCODE_CONFIG="$OPENCODE_CONFIG_DIR/opencode.json"
export HIAI_CONFIG="$OPENCODE_CONFIG_DIR/hiai-opencode.json"

# Python/Environment Setup
if [[ -d "$VENV" ]]; then
    export PATH="$VENV/bin:$PATH"
fi

# Bun/Node Helpers
export PATH="$ROOT/node_modules/.bin:$PATH"

# Ensure directories exist
mkdir -p "$LOGS" "$CACHE" "$OPENCODE_CONFIG_DIR"
