#!/usr/bin/env bash
# onboard.sh - Seamless onboarding for hiai-opencode
# Installs dependencies, sets up environments, and fixes paths for portability.

set -euo pipefail

# Find root
ROOT="$(dirname "$(readlink -f "$0")")/.."
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

# 2. Python 3.12 + Venv
if ! command -v python3 &> /dev/null; then
    echo "==> [onboard] Error: python3 not found. Please install Python 3.12+."
    exit 1
fi

if [[ ! -d "$VENV" ]]; then
    echo "==> [onboard] Creating Python virtual environment in $VENV..."
    python3 -m venv "$VENV"
fi

echo "==> [onboard] Installing Python dependencies (mempalace)..."
"$VENV/bin/pip" install --upgrade pip
"$VENV/bin/pip" install mempalace mcp-server-git # Adding some useful ones

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
cd "$ROOT/hiai-opencode"
bun install
bun run build
cd "$ROOT"

# 6. Path Dynamicization (Fix hardcoded /mnt/ai_data)
if [[ "$ROOT" != "/mnt/ai_data" ]]; then
    echo "==> [onboard] Fixing hardcoded paths from /mnt/ai_data to $ROOT..."
    # Find all files with /mnt/ai_data and replace them, excluding node_modules and .git
    grep -rIl "/mnt/ai_data" . --exclude-dir={node_modules,.git,dist} | while read -r file; do
        echo "    Updating $file"
        sed -i "s|/mnt/ai_data|$ROOT|g" "$file"
    done
fi

echo "==> [onboard] Syncing skills..."
bash scripts/opencode_sync_skills.sh || true

echo "==> [onboard] Success! Your OpenCode environment is ready."
echo "    You can now start a session with: bash opencode_start.sh"
