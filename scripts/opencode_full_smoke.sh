#!/usr/bin/env bash
# Full OpenCode integration smoke test
# Covers: binary, config, skills, LSP, plugins, MCP (all 8), e2e calls, stitch token, serve API
set -euo pipefail

ROOT="/mnt/ai_data"
OPENCODE_BIN="$(command -v opencode 2>/dev/null || echo '')"
PASS=0; FAIL=0; WARN=0
LOG_DIR="$ROOT/logs/opencode/smoke"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/$(date +%Y%m%d_%H%M%S)_full.log"
exec > >(tee "$LOG_FILE") 2>&1

# ── helpers ────────────────────────────────────────────────────────────────────
ok()   { echo "  ✓  $*"; PASS=$((PASS+1)); }
fail() { echo "  ✗  $*" >&2; FAIL=$((FAIL+1)); }
warn() { echo "  ⚠  $*"; WARN=$((WARN+1)); }
section() { echo; echo "══ $* ══"; }

# Load API keys from infra .env
if [[ -f "$ROOT/infra/docker/.env" ]]; then
  set +u
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "$line" ]] && continue
    [[ "$line" == *'<FILL_IN>'* ]] && continue
    key="${line%%=*}"; val="${line#*=}"
    [[ -z "${!key:-}" ]] && export "$key"="$val"
  done < "$ROOT/infra/docker/.env"
  set -u
fi

echo "# OpenCode Full Smoke Test"
echo "- started_at: $(date -Iseconds)"
echo "- log_file:   $LOG_FILE"

# ── 1. BINARY ──────────────────────────────────────────────────────────────────
section "1/9  BINARY"
if [[ -z "$OPENCODE_BIN" ]]; then
  fail "opencode binary not found in PATH"
else
  VER="$(opencode --version 2>/dev/null || echo 'unknown')"
  ok "opencode at $OPENCODE_BIN  version=$VER"
fi

# ── 2. CONFIG JSON ─────────────────────────────────────────────────────────────
section "2/9  CONFIG"
GLOBAL_CFG="$HOME/.config/opencode/opencode.json"
PROJECT_CFG="$ROOT/.opencode/opencode.json"

if python3 -m json.tool "$GLOBAL_CFG" >/dev/null 2>&1; then
  ok "global config valid: $GLOBAL_CFG"
else
  fail "global config invalid JSON: $GLOBAL_CFG"
fi

if python3 -m json.tool "$PROJECT_CFG" >/dev/null 2>&1; then
  ok "project config valid: $PROJECT_CFG"
else
  fail "project config invalid JSON: $PROJECT_CFG"
fi

# ── 3. SKILLS ──────────────────────────────────────────────────────────────────
section "3/9  SKILLS"
bash "$ROOT/scripts/opencode_sync_skills.sh" >/dev/null 2>&1

ROOT_SKILLS="$(find "$ROOT/skills" -name SKILL.md | wc -l)"
UI_SKILLS="$(find "$ROOT/.opencode/skills" -name SKILL.md 2>/dev/null | wc -l)"

if [[ "$ROOT_SKILLS" -gt 0 && "$ROOT_SKILLS" -eq "$UI_SKILLS" ]]; then
  ok "skills mirror in sync: $ROOT_SKILLS skills"
else
  fail "skills mirror mismatch: root=$ROOT_SKILLS ui=$UI_SKILLS"
fi

REQUIRED_SKILLS=(
  "debugging-and-error-recovery"
  "test-driven-development"
  "api-and-interface-design"
  "docker_a2a"
  "mcp_rag"
)
for s in "${REQUIRED_SKILLS[@]}"; do
  if [[ -d "$ROOT/skills/$s" ]]; then
    ok "skill present: $s"
  else
    warn "skill missing: $s"
  fi
done

# ── 4. LSP SERVERS ─────────────────────────────────────────────────────────────
section "4/9  LSP SERVERS"
declare -A LSP_BINS=(
  [typescript]="typescript-language-server"
  [svelte]="svelteserver"
  [eslint]="vscode-eslint-language-server"
  [bash]="bash-language-server"
  [pyright]="pyright-langserver"
)

for name in "${!LSP_BINS[@]}"; do
  bin="${LSP_BINS[$name]}"
  if path="$(command -v "$bin" 2>/dev/null)"; then
    ok "LSP $name: $path"
  else
    fail "LSP $name binary not found: $bin"
  fi
done

# LSP protocol handshake for typescript-language-server
TS_BIN="$(command -v typescript-language-server 2>/dev/null || echo '')"
if [[ -n "$TS_BIN" ]]; then
  TS_INIT='{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"processId":null,"rootUri":null,"capabilities":{}}}'
  TS_LEN="${#TS_INIT}"
  TS_OUT="$(printf 'Content-Length: %s\r\n\r\n%s' "$TS_LEN" "$TS_INIT" \
    | timeout 5 "$TS_BIN" --stdio 2>/dev/null | head -c 500 || true)"
  if echo "$TS_OUT" | grep -q '"result"'; then
    ok "LSP typescript protocol handshake ok"
  else
    warn "LSP typescript protocol handshake no response (may need project tsconfig)"
  fi
fi

# ── 5. PLUGINS ─────────────────────────────────────────────────────────────────
section "5/9  PLUGINS"
EXPECTED_PLUGINS=(
  micode
  "@openspoon/subtask2"
  "oh-my-opencode"
  "@tarquinen/opencode-dcp"
  "opencode-fast-apply"
  "opencode-pty"
  "@zenobius/opencode-skillful"
  "opencode-websearch-cited"
)

# Check plugin array in project config
PROJECT_PLUGINS="$(python3 -c "
import json
d = json.load(open('$PROJECT_CFG'))
print(' '.join(d.get('plugin', [])))
" 2>/dev/null)"

for p in "${EXPECTED_PLUGINS[@]}"; do
  if echo "$PROJECT_PLUGINS" | grep -qF "$p"; then
    ok "plugin in config: $p"
  else
    warn "plugin not in project config: $p (may be in global config)"
  fi
done

# Verify packages exist on npm registry (quick check with cached metadata)
for p in micode "oh-my-opencode" "opencode-pty" "opencode-worktree"; do
  if npm view "$p" version >/dev/null 2>&1; then
    ok "npm registry: $p available"
  else
    warn "npm registry: $p not found (check package name)"
  fi
done

# ── 6. MCP CONNECTIVITY ────────────────────────────────────────────────────────
section "6/9  MCP SERVERS"
EXPECTED_MCP=(
  playwright
  stitch
  rag
  mempalace
  context7
  docker
  sequential-thinking
  firecrawl
)

MCP_LOG="$(mktemp)"
if ! OPENCODE_CONFIG="$GLOBAL_CFG" opencode mcp list --print-logs --log-level INFO >"$MCP_LOG" 2>&1; then
  fail "opencode mcp list command failed"
  cat "$MCP_LOG"
  rm -f "$MCP_LOG"
else
  for key in "${EXPECTED_MCP[@]}"; do
    if grep -q "service=mcp key=${key} .*create() successfully created client" "$MCP_LOG"; then
      ok "MCP $key: connected"
    else
      fail "MCP $key: NOT connected"
    fi
  done
  rm -f "$MCP_LOG"
fi

# ── 7. MCP E2E CALLS ───────────────────────────────────────────────────────────
section "7/9  MCP E2E CALLS"

# RAG e2e
python3 - <<'PY'
import json, subprocess, sys
msgs = [
    {'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2024-11-05','capabilities':{},'clientInfo':{'name':'smoke','version':'1.0'}}},
    {'jsonrpc':'2.0','method':'notifications/initialized','params':{}},
    {'jsonrpc':'2.0','id':2,'method':'tools/call','params':{'name':'search_rag','arguments':{'query':'opencode host-native','limit':2}}},
]
wire = b''
for m in msgs:
    body = json.dumps(m).encode()
    wire += b'Content-Length: ' + str(len(body)).encode() + b'\r\n\r\n' + body

p = subprocess.Popen(['node','/mnt/ai_data/scripts/opencode_rag_mcp.mjs'],
    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
out, _ = p.communicate(wire, timeout=20)
txt = out.decode(errors='ignore')
if '"id":2' in txt or '"id": 2' in txt:
    print('  ✓  RAG e2e: tools/call search_rag ok')
else:
    print('  ✗  RAG e2e: no response to tools/call', file=sys.stderr)
    sys.exit(1)
PY

# Mempalace e2e  (uses newline-delimited JSON, not Content-Length framing)
python3 - <<'PY'
import json, subprocess, sys, os
msgs = [
    {'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2024-11-05','capabilities':{},'clientInfo':{'name':'smoke','version':'1.0'}}},
    {'jsonrpc':'2.0','method':'notifications/initialized','params':{}},
    {'jsonrpc':'2.0','id':2,'method':'tools/list','params':{}},
    {'jsonrpc':'2.0','id':3,'method':'tools/call','params':{'name':'mempalace_status','arguments':{}}},
]
wire = b''
for m in msgs:
    wire += json.dumps(m).encode() + b'\n'

env = {**os.environ, 'MEMPALACE_PALACE_PATH': '/mnt/ai_data/cache/mempalace/opencode'}
p = subprocess.Popen(
    ['bash', '/mnt/ai_data/scripts/opencode_mempalace_mcp.sh'],
    stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)
out, _ = p.communicate(wire, timeout=15)
txt = out.decode(errors='ignore')

# parse lines as JSON objects
found_tools = False
found_status = False
for line in txt.splitlines():
    try:
        d = json.loads(line)
        if d.get('id') == 2 and 'result' in d:
            tools = [t['name'] for t in d['result'].get('tools', [])]
            if tools:
                print(f'  ✓  mempalace tools/list: {len(tools)} tools')
                found_tools = True
        if d.get('id') == 3 and 'result' in d:
            print('  ✓  mempalace_status call ok')
            found_status = True
    except Exception:
        pass

if not found_tools:
    print('  ✗  mempalace tools/list: no tools returned', file=sys.stderr)
    sys.exit(1)
if not found_status:
    print('  ⚠  mempalace_status: no response (palace may be empty)')
PY

# ── 8. STITCH TOKEN ────────────────────────────────────────────────────────────
section "8/9  STITCH TOKEN"
python3 - <<'PY'
import json, time, sys
tokens_path = '/home/vlgalib/.stitch-mcp-auto/tokens.json'
try:
    with open(tokens_path) as f:
        d = json.load(f)
    expiry = d.get('expiry_date', d.get('expiry_time_ms', 0))
    managed = d.get('managed_by', 'oauth')
    remaining = (expiry - time.time() * 1000) / 60000
    if remaining > 5:
        print(f'  ✓  stitch token valid: expires in {remaining:.0f} min  managed_by={managed}')
    elif remaining > 0:
        print(f'  ⚠  stitch token expires in {remaining:.1f} min — refresh timer should fire soon')
    else:
        print(f'  ✗  stitch token EXPIRED {abs(remaining):.0f} min ago', file=sys.stderr)
        sys.exit(1)
except FileNotFoundError:
    print(f'  ✗  stitch tokens.json not found at {tokens_path}', file=sys.stderr)
    sys.exit(1)
PY

# Check timer status
TIMER_STATUS="$(systemctl --user is-active ai-stitch-token-refresh.timer 2>/dev/null || echo 'inactive')"
if [[ "$TIMER_STATUS" == "active" ]]; then
  ok "stitch refresh timer: active"
  NEXT="$(systemctl --user list-timers ai-stitch-token-refresh.timer --no-pager 2>/dev/null | grep 'ai-stitch' | awk '{print $1, $2, $3, $4}' || echo '?')"
  ok "stitch timer next fire: $NEXT"
else
  warn "stitch refresh timer not active (run: systemctl --user start ai-stitch-token-refresh.timer)"
fi

# ── 9. SERVE API + PARALLEL SESSIONS ──────────────────────────────────────────
section "9/9  SERVE API + PARALLEL SESSIONS"

SERVE_PID="$(pgrep -f 'opencode serve --port 4096' 2>/dev/null | head -1 || true)"
if [[ -n "$SERVE_PID" ]]; then
  ok "opencode serve running: pid=$SERVE_PID port=4096"
else
  warn "opencode serve not running (start: systemctl --user start ai-opencode-serve.service)"
fi

HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:4096/ 2>/dev/null || echo '000')"
if [[ "$HTTP_CODE" == "200" ]]; then
  ok "serve HTTP: 200 OK at http://localhost:4096/"
else
  warn "serve HTTP: got $HTTP_CODE (expected 200)"
fi

echo
echo "  ── Parallel Sessions ──────────────────────────────────────────────────"
echo "  Model selection is PER-SESSION, not per-process."
echo "  One 'opencode serve' handles all sessions with different models."
echo
echo "  To open a 2nd TUI with a different model:"
echo "    opencode attach http://localhost:4096"
echo "  Then select model inside the TUI (default key: m)."
echo
echo "  To run headless with a specific model:"
echo "    opencode run --model anthropic/claude-opus-4-5 -c 'your prompt'"
echo "    opencode run --model openai/gpt-4o -c 'your prompt'"
echo "    opencode run --model google/gemini-2.5-pro -c 'your prompt'"
echo
echo "  Wrapper lock (flock) blocks parallel TUI *launches via wrapper*."
echo "  Bypass: OPENCODE_ALLOW_PARALLEL=1 opencode_start.sh ..."
echo "  Or: opencode attach http://localhost:4096 (bypasses wrapper entirely)"
echo "  ───────────────────────────────────────────────────────────────────────"

# ── SUMMARY ────────────────────────────────────────────────────────────────────
echo
echo "══════════════════════════════════════════════════════════"
echo "  RESULT:  PASS=$PASS  FAIL=$FAIL  WARN=$WARN"
echo "  log: $LOG_FILE"
echo "══════════════════════════════════════════════════════════"

if [[ "$FAIL" -gt 0 ]]; then
  exit 1
fi
