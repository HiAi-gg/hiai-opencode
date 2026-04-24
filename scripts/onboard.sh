#!/usr/bin/env bash
# onboard.sh - Seamless onboarding for hiai-opencode
# Installs dependencies, sets up environments, and fixes paths for portability.

set -euo pipefail

# Find root (directory containing AGENTS.md)
ROOT="$(dirname "$(dirname "$(readlink -f "$0")")")"
cd "$ROOT"

source scripts/opencode_env.sh

echo "==> [onboard] Starting OpenCode onboarding in $ROOT"

# 1. Bun
if ! command -v bun &> /dev/null; then
    echo "==> [onboard] Installing Bun..."
    curl -fsSL https://bun.sh/install | bash
    export PATH="$HOME/.bun/bin:$PATH"
fi
echo "==> [onboard] Bun version: $(bun --version)"

# 2. Optional Python / uv for MemPalace
if command -v uv &> /dev/null; then
    echo "==> [onboard] Found uv for upstream MemPalace support."
elif command -v python3 &> /dev/null; then
    echo "==> [onboard] Python detected. Install MemPalace separately if you want MCP memory support:"
    echo "    python3 -m pip install mempalace"
else
    echo "==> [onboard] Python/uv not found. MemPalace MCP will stay unavailable until one is installed."
fi

# 3. Node.js (for LSPs)
if ! command -v node &> /dev/null; then
    echo "==> [onboard] Error: node not found. Please install Node.js."
    exit 1
fi

# 4. LSP Servers
echo "==> [onboard] Installing LSP servers..."
LSP_SERVERS=(
    "typescript-language-server"
    "typescript"
    "pyright"
    "svelte-language-server"
    "bash-language-server"
    "vscode-langservers-extracted"
)

# Detect npm or bun for global install
INSTALL_CMD="npm install -g"
if command -v sudo &> /dev/null; then
    INSTALL_CMD="sudo $INSTALL_CMD"
fi

for server in "${LSP_SERVERS[@]}"; do
    echo "    - $server"
    $INSTALL_CMD "$server" || echo "    [!] Failed to install $server (skipping)"
done

# 5. Build hiai-opencode
echo "==> [onboard] Installing hiai-opencode dependencies..."
# We are already in ROOT from line 9
bun install
bun run build

echo "==> [onboard] Syncing skills..."
bash scripts/opencode_sync_skills.sh || true

echo "==> [onboard] Success! Your OpenCode environment is ready."
echo "    You can now start a session with: bash opencode_start.sh"
