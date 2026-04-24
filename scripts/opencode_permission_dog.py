#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path


REQUIRED_RULES = [
    ("permission.edit./mnt/ai_data/backup/*", "deny"),
    ("permission.bash.docker compose restart *", "allow"),
    ("permission.bash.docker restart *", "allow"),
    ("permission.edit./mnt/ai_data/projects/*", "allow"),
]


def get_path(data, path: str):
    cur = data
    for part in path.split("."):
        if not isinstance(cur, dict) or part not in cur:
            return None
        cur = cur[part]
    return cur


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--log", required=True)
    args = parser.parse_args()

    config_path = Path(args.config)
    log_path = Path(args.log)
    log_path.parent.mkdir(parents=True, exist_ok=True)

    config = json.loads(config_path.read_text())
    failures: list[str] = []
    for path, expected in REQUIRED_RULES:
        actual = get_path(config, path)
        if actual != expected:
            failures.append(f"{path} expected={expected!r} actual={actual!r}")

    ts = datetime.now().isoformat(timespec="seconds")
    with log_path.open("w", encoding="utf-8") as f:
        f.write("# OpenCode Permission Dog\n\n")
        f.write(f"- checked_at: {ts}\n")
        f.write(f"- config: {config_path}\n")
        f.write(f"- status: {'fail' if failures else 'pass'}\n\n")
        f.write("## Effective Summary\n\n")
        f.write("- standard file edits in `/mnt/ai_data/projects/*`: allow\n")
        f.write("- standard opencode helper scripts: allow\n")
        f.write("- common inspection commands: allow\n")
        f.write("- restarts (`docker restart`, `docker compose restart`): allow\n")
        f.write("- secrets and `.env*`: ask\n")
        f.write("- `/mnt/ai_data/backup/*`: deny\n\n")
        if failures:
            f.write("## Failures\n\n")
            for item in failures:
                f.write(f"- {item}\n")

    print(f"Permission dog log: {log_path}")
    if failures:
        for item in failures:
            print(item)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
