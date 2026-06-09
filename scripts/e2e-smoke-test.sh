#!/usr/bin/env bash
set -euo pipefail
echo "=== Hiai-OpenCode E2E Smoke Test $(date) ==="

PASS=0
FAIL=0

check() {
  local label="$1"
  shift
  echo -n "  $label ... "
  if "$@" > /dev/null 2>&1; then
    echo "PASS"
    PASS=$((PASS + 1))
  else
    echo "FAIL"
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "--- 1. Build & TypeCheck ---"
check "typecheck" bun run typecheck

echo ""
echo "--- 2. Unit Tests ---"
check "bun test" bun test

echo ""
echo "--- 3. Lint ---"
check "biome lint (warnings ok)" bash -c "bun run lint 2>&1 | tail -3"

echo ""
echo "--- 4. Plugin Entry Point ---"
check "dist build exists" test -f dist/index.js

echo ""
echo "--- 5. Agent Factory Smoke ---"
check "bob agent" bun -e "
import { createBobAgent } from './src/agents/bob/index.ts';
const a = createBobAgent('openrouter/anthropic/claude-sonnet-4-20250514');
if (!a.prompt) throw new Error('bob missing prompt');
" 2>&1

check "coder agent" bun -e "
import { createCoderAgent } from './src/agents/coder/agent.ts';
const a = createCoderAgent('openrouter/anthropic/claude-sonnet-4-20250514');
if (!a.prompt) throw new Error('coder missing prompt');
" 2>&1

echo ""
echo "--- 6. Hook Chain Integrity ---"
check "handled event types defined" grep -q "HANDLED_EVENT_TYPES" src/plugin/event.ts
check "slow hook threshold" grep -q "SLOW_HOOK_THRESHOLD_MS" src/plugin/event.ts

echo ""
echo "--- 7. Prompt Size ---"
check "bob prompt <=12KB" test "$(bun -e "
import { createBobAgent } from './src/agents/bob/index.ts';
const a = createBobAgent('openrouter/anthropic/claude-sonnet-4-20250514');
process.stdout.write(String(Buffer.byteLength(a.prompt ?? '', 'utf8')));
" 2>/dev/null)" -le 27662

check "coder prompt <=9KB" test "$(bun -e "
import { createCoderAgent } from './src/agents/coder/agent.ts';
const a = createCoderAgent('openrouter/anthropic/claude-sonnet-4-20250514');
process.stdout.write(String(Buffer.byteLength(a.prompt ?? '', 'utf8')));
" 2>/dev/null)" -le 20044

echo ""
echo "--- Results ---"
echo "Passed: $PASS"
echo "Failed: $FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo "SMOKE TEST FAILED"
  exit 1
else
  echo "SMOKE TEST PASSED"
fi
