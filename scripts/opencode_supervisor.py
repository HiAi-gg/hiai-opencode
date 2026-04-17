#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import time
from datetime import datetime
from pathlib import Path


ROOT = Path("/mnt/ai_data")
DB_PATH = os.path.expanduser("~/.local/share/opencode/opencode.db")


def run(cmd: list[str], timeout: int | None = None, env: dict | None = None) -> subprocess.CompletedProcess[str]:
    run_env = {**os.environ, **(env or {})}
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, check=False, env=run_env)


def latest_session_id() -> str:
    try:
        import sqlite3
        con = sqlite3.connect(DB_PATH)
        cur = con.cursor()
        row = cur.execute(
            "SELECT id FROM session WHERE directory=? ORDER BY time_updated DESC LIMIT 1",
            ("/mnt/ai_data",),
        ).fetchone()
        return row[0] if row else ""
    except Exception:
        return ""


def export_session(session_id: str, dest: Path) -> None:
    env = {"OPENCODE_CONFIG": os.path.expanduser("~/.config/opencode/opencode.json")}
    proc = run(
        ["opencode", "export", session_id],
        timeout=60,
        env=env,
    )
    if proc.returncode == 0:
        dest.write_text(proc.stdout or "", encoding="utf-8")
    else:
        dest.write_text("", encoding="utf-8")


def extract_status(text: str) -> str | None:
    m = re.search(r"TASK_STATUS:\s*(DONE|BLOCKED|CONTINUE)", text, re.IGNORECASE)
    return m.group(1).upper() if m else None


def heuristic_status(text: str) -> str:
    status = extract_status(text)
    if status:
        return status
    lowered = text.lower()
    if any(p in lowered for p in ["task_status: done", "logical completion reached", "work is complete"]):
        return "DONE"
    if any(p in lowered for p in ["task_status: blocked", "blocked on", "need user input"]):
        return "BLOCKED"
    return "CONTINUE"


def maybe_judge_with_command(judge_command: str | None, goal: str, latest_output: str) -> str | None:
    if not judge_command:
        return None
    prompt = (
        "Return exactly one word: DONE, BLOCKED, or CONTINUE.\n"
        "Judge whether the task reached logical completion.\n\n"
        f"Goal:\n{goal[:6000]}\n\n"
        f"Latest output:\n{latest_output[:12000]}\n"
    )
    proc = run(["bash", "-lc", judge_command], timeout=60)
    if proc.returncode != 0:
        return None
    out = (proc.stdout or proc.stderr or "").strip().upper()
    if out in {"DONE", "BLOCKED", "CONTINUE"}:
        return out
    return None


def build_prompt(goal_text: str, cycle: int, previous_session: str | None) -> str:
    preface = (
        "You are running in supervised autonomous mode.\n"
        "Work until logical completion of the goal below.\n"
        "If you complete the goal, end your final answer with exactly: TASK_STATUS: DONE\n"
        "If you are blocked by missing external input or a real hard dependency, end with exactly: TASK_STATUS: BLOCKED\n"
        "If you made progress but the task is not complete yet, end with exactly: TASK_STATUS: CONTINUE\n"
        "Prefer actually making code/config/docs changes over describing them.\n"
    )
    if cycle > 1 and previous_session:
        preface += (
            f"\nRecovery context: previous session `{previous_session}` stalled or stopped. "
            "Inspect current repo state, logs, and any existing TODOs, then continue from the latest unfinished state rather than restarting blindly.\n"
        )
    return f"{preface}\nGoal:\n{goal_text.strip()}\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--goal-file", required=True)
    parser.add_argument("--note", default="supervised run")
    parser.add_argument("--projects", default="not_specified")
    parser.add_argument("--max-cycles", type=int, default=6)
    parser.add_argument("--run-timeout-seconds", type=int, default=1500)
    parser.add_argument("--cooldown-seconds", type=int, default=10)
    parser.add_argument("--judge-command", default="")
    args = parser.parse_args()

    goal_file = Path(args.goal_file)
    if not goal_file.exists():
        raise SystemExit(f"Goal file not found: {goal_file}")

    goal_text = goal_file.read_text(encoding="utf-8", errors="ignore")
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_dir = ROOT / "logs" / "opencode" / "supervisor" / stamp
    out_dir.mkdir(parents=True, exist_ok=True)
    summary = out_dir / "summary.md"

    summary.write_text(
        "# OpenCode Supervisor Run\n\n"
        f"- started_at: {datetime.now().isoformat(timespec='seconds')}\n"
        f"- goal_file: {goal_file}\n"
        f"- note: {args.note}\n"
        f"- projects: {args.projects}\n"
        f"- max_cycles: {args.max_cycles}\n\n",
        encoding="utf-8",
    )

    previous_session = None

    for cycle in range(1, args.max_cycles + 1):
        cycle_dir = out_dir / f"cycle_{cycle:02d}"
        cycle_dir.mkdir(parents=True, exist_ok=True)

        run(["bash", str(ROOT / "scripts" / "opencode_cleanup_stale.sh"), "--apply", "--keep-none"], timeout=60)

        prompt = build_prompt(goal_text, cycle, previous_session)
        prompt_file = cycle_dir / "prompt.txt"
        prompt_file.write_text(prompt, encoding="utf-8")

        model_flag = []
        if os.environ.get("OPENCODE_MODEL"):
            model_flag = ["-m", os.environ.get("OPENCODE_MODEL", "")]

        cmd = [
            "opencode", "run",
            "--dangerously-skip-permissions",
            "-c", prompt,
            "--format", "json",
        ] + model_flag

        env = {"OPENCODE_CONFIG": os.path.expanduser("~/.config/opencode/opencode.json")}
        proc = run(
            cmd,
            timeout=args.run_timeout_seconds + 120,
            env=env,
        )

        stdout_path = cycle_dir / "stdout.log"
        stderr_path = cycle_dir / "stderr.log"
        stdout_path.write_text(proc.stdout or "", encoding="utf-8")
        stderr_path.write_text(proc.stderr or "", encoding="utf-8")

        session_id = latest_session_id()
        export_path = cycle_dir / "session_export.json"
        if session_id:
            export_session(session_id, export_path)
            previous_session = session_id

        combined = "\n".join(
            part
            for part in [
                proc.stdout or "",
                proc.stderr or "",
                export_path.read_text(encoding="utf-8", errors="ignore") if export_path.exists() else "",
            ]
            if part
        )

        judge = maybe_judge_with_command(args.judge_command or None, goal_text, combined)
        if not judge:
            judge = heuristic_status(combined)

        with summary.open("a", encoding="utf-8") as f:
            f.write(f"## Cycle {cycle}\n\n")
            f.write(f"- time: {datetime.now().isoformat(timespec='seconds')}\n")
            f.write(f"- return_code: {proc.returncode}\n")
            f.write(f"- session_id: {session_id or 'not_found'}\n")
            f.write(f"- judge: {judge}\n")
            f.write(f"- stdout: {stdout_path}\n")
            f.write(f"- stderr: {stderr_path}\n")
            if export_path.exists():
                f.write(f"- export: {export_path}\n")
            f.write("\n")

        if judge in {"DONE", "BLOCKED"}:
            with summary.open("a", encoding="utf-8") as f:
                f.write(f"## Final Status\n\n- {judge}\n")
            print(f"supervisor_status={judge.lower()}")
            print(f"summary={summary}")
            return 0 if judge == "DONE" else 3

        time.sleep(args.cooldown_seconds)

    with summary.open("a", encoding="utf-8") as f:
        f.write("## Final Status\n\n- CONTINUE (max cycles reached)\n")
    print("supervisor_status=continue")
    print(f"summary={summary}")
    return 4


if __name__ == "__main__":
    raise SystemExit(main())
