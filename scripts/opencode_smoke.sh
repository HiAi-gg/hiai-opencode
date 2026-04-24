#!/usr/bin/env bash
set -euo pipefail

# Load dynamic environment
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
if [[ -f "$SCRIPT_DIR/opencode_env.sh" ]]; then
  source "$SCRIPT_DIR/opencode_env.sh"
elif [[ -f "$SCRIPT_DIR/scripts/opencode_env.sh" ]]; then
  source "$SCRIPT_DIR/scripts/opencode_env.sh"
else
  export ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
  export SCRIPTS="$ROOT/scripts"
  export INFRA="$ROOT/infra"
fi
EXPECTED_MCP=(
  playwright
  stitch
  sequential-thinking
  firecrawl
  rag
  mempalace
  context7
)

bash "$ROOT/scripts/opencode_sync_skills.sh"

# Load API keys from infra .env (FIRECRAWL_API_KEY, STITCH_AI_API_KEY, etc.)
if [[ -f "$ROOT/infra/docker/.env" ]]; then
  set +u
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "$line" ]] && continue
    [[ "$line" == *'<FILL_IN>'* ]] && continue
    key="${line%%=*}"
    val="${line#*=}"
    [[ -z "${!key:-}" ]] && export "$key"="$val"
  done < "$INFRA/docker/.env"
  set -u
fi

echo "[1/5] opencode binary"
which opencode && opencode --version

echo "[2/5] config file"
test -f "$HOME/.config/opencode/opencode.json" && echo "ok"

echo "[3/5] project skill context"
SKILL_SOURCE="$ROOT/skills"
if [[ ! -d "$SKILL_SOURCE" ]]; then
    SKILL_SOURCE="$ROOT/hiai-opencode/skills"
fi

ROOT_SKILLS="$(find "$SKILL_SOURCE" -name SKILL.md 2>/dev/null | wc -l)"
UI_SKILLS="$(find "$ROOT/.opencode/skills" -name SKILL.md 2>/dev/null | wc -l)"
echo "root_skills($SKILL_SOURCE)=$ROOT_SKILLS"
echo "ui_skills=$UI_SKILLS"
if [[ "$ROOT_SKILLS" -eq 0 || "$UI_SKILLS" -eq 0 ]]; then
  echo "Skill mirror mismatch: root=$ROOT_SKILLS ui=$UI_SKILLS" >&2
  exit 1
fi

echo "[4/5] mcp boot"
MCP_LOG="$(mktemp)"
if ! OPENCODE_CONFIG="$HOME/.config/opencode/opencode.json" opencode mcp list --print-logs --log-level INFO >"$MCP_LOG" 2>&1; then
  cat "$MCP_LOG"
  rm -f "$MCP_LOG"
  echo "OpenCode MCP list failed" >&2
  exit 1
fi
cat "$MCP_LOG"
for key in "${EXPECTED_MCP[@]}"; do
  if ! rg -q "service=mcp key=${key} .*create\\(\\) successfully created client" "$MCP_LOG"; then
    echo "Missing connected MCP: $key" >&2
    rm -f "$MCP_LOG"
    exit 1
  fi
done
rm -f "$MCP_LOG"

echo "[5/5] rag e2e call"
python3 - <<'PY'
import json, subprocess, os
root = os.environ["ROOT"]
p = subprocess.Popen(
    ['node', os.path.join(root, 'scripts/opencode_rag_mcp.mjs')],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
)
msgs = [
    {'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2024-11-05','capabilities':{},'clientInfo':{'name':'smoke','version':'1.0'}}},
    {'jsonrpc':'2.0','method':'notifications/initialized','params':{}},
    {'jsonrpc':'2.0','id':2,'method':'tools/call','params':{'name':'search_rag','arguments':{'query':'system architecture','limit':2}}},
]
wire = b''
for m in msgs:
    body = json.dumps(m).encode()
    wire += b'Content-Length: ' + str(len(body)).encode() + b'\r\n\r\n' + body
out, err = p.communicate(wire, timeout=20)
txt = out.decode(errors='ignore')
if '"id":2' not in txt and '"id": 2' not in txt:
    raise SystemExit('rag MCP call failed')
print('rag MCP call ok')
if err:
    print(err.decode(errors='ignore')[:500])
PY
