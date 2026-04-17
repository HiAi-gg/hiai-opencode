#!/usr/bin/env bash
set -euo pipefail

API_URL="${OPENCODE_JUDGE_OLLAMA_URL:-http://127.0.0.1:11436/api/chat}"
MODEL="${OPENCODE_JUDGE_MODEL:-functiongemma:latest}"

PROMPT="$(cat)"

payload="$(python3 - <<'PY' "$MODEL" "$PROMPT"
import json, sys
model = sys.argv[1]
prompt = sys.argv[2]
print(json.dumps({
    "model": model,
    "stream": False,
    "messages": [
        {
            "role": "system",
            "content": (
                "You are a strict task-completion classifier. "
                "Return exactly one word: DONE, BLOCKED, or CONTINUE. "
                "Do not refuse. Do not explain."
            ),
        },
        {"role": "user", "content": prompt},
    ],
    "options": {"temperature": 0},
}))
PY
)"

resp="$(curl -fsS "$API_URL" -d "$payload")"
label="$(python3 - <<'PY' "$resp"
import json, re, sys
raw = json.loads(sys.argv[1])
text = ""
if isinstance(raw.get("message"), dict):
    text = raw["message"].get("content", "") or ""
text = text.strip().upper()
m = re.search(r"\b(DONE|BLOCKED|CONTINUE)\b", text)
if m:
    print(m.group(1))
    raise SystemExit(0)
raise SystemExit(2)
PY
)" || exit 2

printf '%s\n' "$label"
