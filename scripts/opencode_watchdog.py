#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import signal
import sqlite3
import subprocess
import time
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any


def log_line(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(f"[{datetime.now().isoformat(timespec='seconds')}] {text}\n")


def load_lock_pid(lock_info: Path) -> int | None:
    if not lock_info.exists():
        return None
    for line in lock_info.read_text(errors="ignore").splitlines():
        if line.startswith("pid="):
            try:
                return int(line.split("=", 1)[1].strip())
            except ValueError:
                return None
    return None


def load_lock_meta(lock_info: Path) -> dict[str, Any]:
    result: dict[str, Any] = {}
    if not lock_info.exists():
        return result
    for line in lock_info.read_text(errors="ignore").splitlines():
        if "=" not in line:
            continue
        key, value = line.split("=", 1)
        result[key.strip()] = value.strip()
    return result


def lock_min_session_ms(lock_info: Path) -> int:
    meta = load_lock_meta(lock_info)
    for key in ("recovered_at", "started_at"):
        raw = meta.get(key)
        if not raw:
            continue
        try:
            return int(datetime.fromisoformat(raw).timestamp() * 1000)
        except Exception:
            continue
    return 0


def lock_mode(lock_info: Path) -> str:
    meta = load_lock_meta(lock_info)
    mode = (meta.get("mode") or "interactive").strip().lower()
    return mode or "interactive"


def pid_alive(pid: int | None) -> bool:
    if not pid:
        return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def recover_lock_info(lock_info: Path, lock_file: Path, log_file: Path) -> None:
    proc = subprocess.run(
        ["bash", "/mnt/ai_data/scripts/opencode_lock_recover.sh"],
        capture_output=True,
        text=True,
        timeout=20,
        check=False,
    )
    output = (proc.stdout or proc.stderr or "").strip()
    if proc.returncode == 0 and output and "lock_recovered" in output:
        log_line(log_file, output)


def get_session_state(db_path: str, directory: str, min_ms: int = 0):
    db_path_expanded = os.path.expanduser(db_path)
    try:
        con = sqlite3.connect(db_path_expanded)
        con.row_factory = sqlite3.Row
        cur = con.cursor()
        row = cur.execute(
            "SELECT id, title, time_updated FROM session WHERE directory=? ORDER BY time_updated DESC LIMIT 1",
            (directory,),
        ).fetchone()
        if not row:
            return None
        sid = row["id"]
        latest_message = cur.execute("SELECT MAX(time_updated) FROM message WHERE session_id=?", (sid,)).fetchone()[0]
        latest_part = cur.execute("SELECT MAX(time_updated) FROM part WHERE session_id=?", (sid,)).fetchone()[0]
        latest = max(v for v in [row["time_updated"], latest_message, latest_part] if v is not None)
        if int(latest) < int(min_ms):
            return None
        return {
            "session_id": sid,
            "title": row["title"],
            "latest_ms": int(latest),
        }
    except Exception:
        return None


def get_top_level_session_state(db_path: str, directory: str, min_ms: int = 0):
    db_path_expanded = os.path.expanduser(db_path)
    try:
        con = sqlite3.connect(db_path_expanded)
        con.row_factory = sqlite3.Row
        cur = con.cursor()
        row = cur.execute(
            "SELECT id, title, time_updated FROM session WHERE directory=? AND parent_id IS NULL ORDER BY time_updated DESC LIMIT 1",
            (directory,),
        ).fetchone()
        if not row:
            return None
        sid = row["id"]
        latest_message = cur.execute("SELECT MAX(time_updated) FROM message WHERE session_id=?", (sid,)).fetchone()[0]
        latest_part = cur.execute("SELECT MAX(time_updated) FROM part WHERE session_id=?", (sid,)).fetchone()[0]
        latest = max(v for v in [row["time_updated"], latest_message, latest_part] if v is not None)
        if int(latest) < int(min_ms):
            return None
        return {
            "session_id": sid,
            "title": row["title"],
            "latest_ms": int(latest),
        }
    except Exception:
        return None


def get_child_sessions(db_path: str, parent_id: str):
    db_path_expanded = os.path.expanduser(db_path)
    try:
        con = sqlite3.connect(db_path_expanded)
        con.row_factory = sqlite3.Row
        cur = con.cursor()
        rows = cur.execute(
            "SELECT id, title, time_updated FROM session WHERE parent_id=? ORDER BY time_updated DESC",
            (parent_id,),
        ).fetchall()
        result = []
        for row in rows:
            sid = row["id"]
            latest_message = cur.execute("SELECT MAX(time_updated) FROM message WHERE session_id=?", (sid,)).fetchone()[0]
            latest_part = cur.execute("SELECT MAX(time_updated) FROM part WHERE session_id=?", (sid,)).fetchone()[0]
            latest = max(v for v in [row["time_updated"], latest_message, latest_part] if v is not None)
            last_part = cur.execute("SELECT data FROM part WHERE session_id=? ORDER BY time_updated DESC LIMIT 1", (sid,)).fetchone()
            result.append({
                "session_id": sid,
                "title": row["title"],
                "latest_ms": int(latest),
                "last_part": last_part[0] if last_part else "",
            })
        return result
    except Exception:
        return []


def part_text(data: Any) -> str:
    if isinstance(data, bytes):
        return data.decode("utf-8", "ignore")
    return str(data or "")


def child_terminal(last_part: Any) -> bool:
    text = part_text(last_part)
    return '"type":"step-finish"' in text and '"reason":"stop"' in text


def run_continue(log_file: Path) -> None:
    cmd = [
        "opencode", "run",
        "--dangerously-skip-permissions",
        "-c", "continue",
        "--format", "json",
        "--attach", "http://127.0.0.1:4096"
    ]
    log_line(log_file, "watchdog action=continue mode=attach start")
    env = {**os.environ, "OPENCODE_CONFIG": os.path.expanduser("~/.config/opencode/opencode.json")}
    proc = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=150,
        env=env,
        cwd="/mnt/ai_data",
    )
    with log_file.open("a", encoding="utf-8") as f:
        if proc.stdout:
            f.write(proc.stdout[-12000:])
            if not proc.stdout.endswith("\n"):
                f.write("\n")
        if proc.stderr:
            f.write(proc.stderr[-12000:])
            if not proc.stderr.endswith("\n"):
                f.write("\n")
    log_line(log_file, f"watchdog action=continue mode=attach exit_code={proc.returncode}")
    if proc.returncode == 124:
        raise TimeoutError("opencode continue timed out")


def run_continue_session(session_id: str, log_file: Path) -> None:
    cmd = [
        "opencode", "run",
        "--dangerously-skip-permissions",
        "--session", session_id,
        "-c", "continue",
        "--format", "json",
        "--attach", "http://127.0.0.1:4096"
    ]
    log_line(log_file, f"watchdog child_continue session_id={session_id} start")
    env = {**os.environ, "OPENCODE_CONFIG": os.path.expanduser("~/.config/opencode/opencode.json")}
    proc = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=150,
        env=env,
        cwd="/mnt/ai_data",
    )
    with log_file.open("a", encoding="utf-8") as f:
        if proc.stdout:
            f.write(proc.stdout[-8000:])
            if not proc.stdout.endswith("\n"):
                f.write("\n")
        if proc.stderr:
            f.write(proc.stderr[-8000:])
            if not proc.stderr.endswith("\n"):
                f.write("\n")
    log_line(log_file, f"watchdog child_continue session_id={session_id} exit_code={proc.returncode}")
    if proc.returncode == 124:
        raise TimeoutError("child continue timed out")


def abort_session_http(session_id: str, log_file: Path) -> bool:
    url = f"http://127.0.0.1:4096/session/{session_id}/abort"
    req = urllib.request.Request(url, data=b"", method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            body = r.read().decode("utf-8", "ignore").strip()
            ok = r.status == 200 and body == "true"
            log_line(log_file, f"watchdog child_abort session_id={session_id} ok={str(ok).lower()}")
            return ok
    except Exception as exc:
        log_line(log_file, f"watchdog child_abort session_id={session_id} error={exc}")
        return False


def prompt_session_async(session_id: str, text: str, log_file: Path) -> bool:
    url = f"http://127.0.0.1:4096/session/{session_id}/prompt_async"
    payload = {"parts": [{"type": "text", "text": text}]}
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"content-type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            ok = r.status == 204
            log_line(log_file, f"watchdog parent_prompt session_id={session_id} ok={str(ok).lower()}")
            return ok
    except Exception as exc:
        log_line(log_file, f"watchdog parent_prompt session_id={session_id} error={exc}")
        return False


def hard_recover(lock_file: Path, lock_info: Path, log_file: Path, session_id: str | None) -> None:
    label = session_id or "unknown"
    log_line(log_file, f"watchdog hard_recover session_id={label} start")
    subprocess.run(
        ["bash", "/mnt/ai_data/scripts/opencode_cleanup_stale.sh", "--apply", "--keep-none"],
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    try:
        lock_info.unlink(missing_ok=True)
    except Exception:
        pass
    log_line(log_file, f"watchdog hard_recover session_id={label} end")


def spawn_recovery_run(log_file: Path, session_id: str | None) -> None:
    cmd = ["bash", "/mnt/ai_data/scripts/opencode_recovery_run.sh"]
    if session_id:
        cmd.append(session_id)
    proc = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    output = (proc.stdout or proc.stderr or "").strip()
    if proc.returncode == 0:
        log_line(log_file, f"watchdog recovery_spawned session_id={session_id or 'unknown'} log={output}")
    else:
        log_line(log_file, f"watchdog recovery_spawn_failed session_id={session_id or 'unknown'} rc={proc.returncode} detail={output}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db-path", default="~/.local/share/opencode/opencode.db")
    parser.add_argument("--directory", default="/mnt/ai_data")
    parser.add_argument("--lock-file", required=True)
    parser.add_argument("--lock-info", required=True)
    parser.add_argument("--log-file", required=True)
    parser.add_argument("--state-file", required=True)
    parser.add_argument("--poll-seconds", type=int, default=20)
    parser.add_argument("--stale-seconds", type=int, default=300)
    parser.add_argument("--interactive-stale-seconds", type=int, default=900)
    parser.add_argument("--cooldown-seconds", type=int, default=180)
    parser.add_argument("--child-stale-seconds", type=int, default=360)
    parser.add_argument("--child-cooldown-seconds", type=int, default=240)
    args = parser.parse_args()

    lock_file = Path(args.lock_file)
    lock_info = Path(args.lock_info)
    log_file = Path(args.log_file)
    state_file = Path(args.state_file)

    state = {"session_id": None, "latest_ms": 0, "nudge_count": 0, "last_nudge_at": 0, "children": {}}
    if state_file.exists():
        try:
            state.update(json.loads(state_file.read_text()))
        except Exception:
            pass

    log_line(log_file, "watchdog started")
    quiet_rounds = 0

    while True:
        recover_lock_info(lock_info, lock_file, log_file)
        wrapper_pid = load_lock_pid(lock_info)
        wrapper_alive = pid_alive(wrapper_pid)
        min_session_ms = lock_min_session_ms(lock_info)
        mode = lock_mode(lock_info)
        if not lock_file.exists() and not wrapper_alive:
            quiet_rounds += 1
        else:
            quiet_rounds = 0

        try:
            session = get_session_state(args.db_path, args.directory, min_session_ms)
        except Exception as exc:
            log_line(log_file, f"watchdog db_error={exc}")
            time.sleep(args.poll_seconds)
            continue

        if session:
            if session["session_id"] != state["session_id"] or session["latest_ms"] > state["latest_ms"]:
                state["session_id"] = session["session_id"]
                state["latest_ms"] = session["latest_ms"]
                state["nudge_count"] = 0
                state["last_nudge_at"] = 0
                state_file.write_text(json.dumps(state, indent=2))

            idle_seconds = max(0, int(time.time() - session["latest_ms"] / 1000))
            stale_threshold = args.stale_seconds if mode == "supervised" else args.interactive_stale_seconds
            if (lock_file.exists() or wrapper_alive) and idle_seconds >= stale_threshold:
                now = int(time.time())
                if mode != "supervised":
                    if now - int(state.get("last_nudge_at", 0) or 0) >= args.cooldown_seconds:
                        log_line(
                            log_file,
                            f"watchdog interactive_stale session_id={session['session_id']} idle_seconds={idle_seconds} action=observe_only",
                        )
                        state["last_nudge_at"] = now
                        state["nudge_count"] = 0
                        state_file.write_text(json.dumps(state, indent=2))
                    time.sleep(args.poll_seconds)
                    continue
                if state["nudge_count"] == 0:
                    log_line(log_file, f"watchdog stale session_id={session['session_id']} idle_seconds={idle_seconds} action=nudge")
                    try:
                        run_continue(log_file)
                        state["nudge_count"] = 1
                        state["last_nudge_at"] = now
                        state_file.write_text(json.dumps(state, indent=2))
                    except TimeoutError:
                        log_line(log_file, f"watchdog stale session_id={session['session_id']} action=continue_timeout")
                        hard_recover(lock_file, lock_info, log_file, session["session_id"])
                        spawn_recovery_run(log_file, session["session_id"])
                        state["nudge_count"] = 0
                        state["last_nudge_at"] = now
                        state_file.write_text(json.dumps(state, indent=2))
                elif state["nudge_count"] == 1 and now - state["last_nudge_at"] >= args.cooldown_seconds:
                    if wrapper_alive and wrapper_pid:
                        log_line(log_file, f"watchdog stale session_id={session['session_id']} idle_seconds={idle_seconds} action=terminate_wrapper pid={wrapper_pid}")
                        try:
                            os.kill(wrapper_pid, signal.SIGTERM)
                        except OSError as exc:
                            log_line(log_file, f"watchdog terminate_wrapper error={exc}")
                    try:
                        run_continue(log_file)
                        state["nudge_count"] = 2
                        state["last_nudge_at"] = now
                        state_file.write_text(json.dumps(state, indent=2))
                    except TimeoutError:
                        log_line(log_file, f"watchdog stale session_id={session['session_id']} action=continue_timeout_after_terminate")
                        hard_recover(lock_file, lock_info, log_file, session["session_id"])
                        spawn_recovery_run(log_file, session["session_id"])
                        state["nudge_count"] = 0
                        state["last_nudge_at"] = now
                        state_file.write_text(json.dumps(state, indent=2))

            try:
                top = get_top_level_session_state(args.db_path, args.directory, min_session_ms)
                if top:
                    children = get_child_sessions(args.db_path, top["session_id"])
                    child_state = state.setdefault("children", {})
                    for child in children:
                        sid = child["session_id"]
                        if child_terminal(child.get("last_part")):
                            continue
                        idle_seconds = max(0, int(time.time() - child["latest_ms"] / 1000))
                        if idle_seconds < args.child_stale_seconds:
                            continue
                        cs = child_state.setdefault(sid, {"nudge_count": 0, "last_nudge_at": 0, "aborted": False})
                        now = int(time.time())
                        if cs.get("aborted"):
                            continue
                        if cs["nudge_count"] == 0:
                            log_line(log_file, f"watchdog child_stale session_id={sid} idle_seconds={idle_seconds} action=nudge")
                            try:
                                run_continue_session(sid, log_file)
                                cs["nudge_count"] = 1
                                cs["last_nudge_at"] = now
                                state_file.write_text(json.dumps(state, indent=2))
                            except TimeoutError:
                                log_line(log_file, f"watchdog child_stale session_id={sid} action=continue_timeout")
                                cs["nudge_count"] = 1
                                cs["last_nudge_at"] = now
                                state_file.write_text(json.dumps(state, indent=2))
                        elif now - cs["last_nudge_at"] >= args.child_cooldown_seconds:
                            log_line(log_file, f"watchdog child_stale session_id={sid} idle_seconds={idle_seconds} action=abort")
                            abort_session_http(sid, log_file)
                            prompt_session_async(
                                top["session_id"],
                                (
                                    f"Subagent session {sid} stalled and was aborted by the watchdog. "
                                    "Continue the main task without waiting forever on that child. "
                                    "If needed, spawn a narrower replacement subagent or continue the exploration yourself."
                                ),
                                log_file,
                            )
                            cs["aborted"] = True
                            cs["last_nudge_at"] = now
                            state_file.write_text(json.dumps(state, indent=2))
            except Exception as exc:
                log_line(log_file, f"watchdog child_monitor_error={exc}")

        if quiet_rounds >= 3:
            log_line(log_file, "watchdog exiting: no active lock and wrapper is gone")
            break

        time.sleep(args.poll_seconds)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
