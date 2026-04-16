#!/usr/bin/env bash
# mempalace MCP server — zero-config launcher
# Strategy:
#   1. MEMPALACE_PYTHON env var (user override)
#   2. System python3 with mempalace installed
#   3. Managed ~/.cache/hiai-opencode/mempalace-venv (auto-created)
#   4. Graceful exit if no Python available
set -uo pipefail

PALACE_PATH="${MEMPALACE_PALACE_PATH:-${XDG_CACHE_HOME:-$HOME/.cache}/hiai-opencode/mempalace-palace}"
MANAGED_VENV="${MEMPALACE_VENV:-${XDG_CACHE_HOME:-$HOME/.cache}/hiai-opencode/mempalace-venv}"

find_python() {
  # 1. Explicit override
  if [[ -n "${MEMPALACE_PYTHON:-}" ]]; then
    if [[ -x "$MEMPALACE_PYTHON" ]]; then
      echo "$MEMPALACE_PYTHON"
      return 0
    fi
  fi

  # 2. System python3 with mempalace
  if command -v python3 &>/dev/null; then
    if python3 -m mempalace.mcp_server --help &>/dev/null 2>&1; then
      echo "$(command -v python3)"
      return 0
    fi
  fi

  # 3. Managed venv
  local venv_python="$MANAGED_VENV/bin/python3"
  if [[ -x "$venv_python" ]]; then
    if "$venv_python" -m mempalace.mcp_server --help &>/dev/null 2>&1; then
      echo "$venv_python"
      return 0
    fi
  fi

  # 4. Auto-install into managed venv
  if command -v python3 &>/dev/null; then
    mkdir -p "$MANAGED_VENV" 2>/dev/null || true
    if python3 -m venv "$MANAGED_VENV" 2>/dev/null; then
      "$venv_python" -m pip install -q "mempalace>=3.3.0" chromadb pyyaml 2>/dev/null || true
      if "$venv_python" -m mempalace.mcp_server --help &>/dev/null 2>&1; then
        echo "$venv_python"
        return 0
      fi
    fi
  fi

  return 1
}

PYTHON=$(find_python) || {
  # No Python available — MCP tools won't register
  # Exit 0 so the MCP framework doesn't mark this as a crash
  echo '{"jsonrpc":"2.0","method":"server/status","params":{"status":"skipped","reason":"no-python"}}' 2>/dev/null || true
  sleep 1
  exit 0
}

# Ensure palace directory exists
mkdir -p "$PALACE_PATH" 2>/dev/null || true

exec env MEMPALACE_PALACE_PATH="$PALACE_PATH" "$PYTHON" -m mempalace.mcp_server
