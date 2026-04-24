#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any


INTERESTING_KEYS = {
    "text",
    "content",
    "message",
    "summary",
    "title",
    "body",
    "input",
    "output",
    "note",
}

BROKE_PATTERNS = [
    r"\berror\b",
    r"\bfailed\b",
    r"\bfail\b",
    r"\bbroken\b",
    r"\btimeout\b",
    r"\bpermission\b",
    r"\bdenied\b",
    r"\bmissing\b",
    r"\bnot found\b",
    r"\brefused\b",
    r"\bhang\b",
    r"\bstuck\b",
]

IMPROVED_PATTERNS = [
    r"\bfixed\b",
    r"\bfix\b",
    r"\badded\b",
    r"\bconfigured\b",
    r"\bupdated\b",
    r"\bimplemented\b",
    r"\bconnected\b",
    r"\bcreated\b",
    r"\bsynced\b",
    r"\bmirrored\b",
    r"\bexported\b",
    r"\bdoctor\b",
    r"\bsmoke\b",
    r"\bwrapper\b",
    r"\bbridge\b",
]

POLICY_PATTERNS = [
    r"\bmust\b",
    r"\balways\b",
    r"\bnever\b",
    r"\bshould\b",
    r"\bexpected to\b",
    r"\bsource of truth\b",
    r"\bcontract\b",
    r"\blaunch\b",
    r"\bstart through\b",
    r"\bdo not\b",
    r"\bmirror\b",
    r"\bwrapper\b",
]


def collect_strings(obj: Any, parent_key: str = "", out: list[str] | None = None) -> list[str]:
    if out is None:
        out = []
    if isinstance(obj, dict):
        role = obj.get("role")
        if isinstance(role, str):
            out.append(f"role: {role}")
        for key, value in obj.items():
            collect_strings(value, str(key), out)
    elif isinstance(obj, list):
        for item in obj:
            collect_strings(item, parent_key, out)
    elif isinstance(obj, str):
        text = obj.strip()
        if not text:
          return out
        if parent_key.lower() in INTERESTING_KEYS or len(text) <= 500:
            out.append(text)
    return out


def unique_keep_order(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        norm = re.sub(r"\s+", " ", value).strip()
        if not norm or norm in seen:
            continue
        seen.add(norm)
        result.append(norm)
    return result


def split_sentences(strings: list[str]) -> list[str]:
    parts: list[str] = []
    for text in strings:
        for chunk in re.split(r"(?:\n+|(?<=[.!?])\s+)", text):
            chunk = re.sub(r"\s+", " ", chunk).strip(" -\t\r\n")
            if re.match(r"^(#|session_id:|export_json:|session_md:|started_at:|ended_at:|smoke_|doctor_|projects:)", chunk, re.IGNORECASE):
                continue
            if 12 <= len(chunk) <= 280:
                parts.append(chunk)
    return unique_keep_order(parts)


def pick_matches(sentences: list[str], patterns: list[str], limit: int) -> list[str]:
    compiled = [re.compile(p, re.IGNORECASE) for p in patterns]
    picked: list[str] = []
    for sentence in sentences:
        if any(p.search(sentence) for p in compiled):
            picked.append(sentence)
        if len(picked) >= limit:
            break
    return unique_keep_order(picked)


def ensure_month_file(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_text(f"# OpenCode Notes {datetime.now():%Y-%m}\n\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--session-md", required=True)
    parser.add_argument("--export-json", default="")
    parser.add_argument("--month-file", required=True)
    parser.add_argument("--projects", default="not_specified")
    parser.add_argument("--session-note", default="")
    args = parser.parse_args()

    session_md = Path(args.session_md)
    export_json = Path(args.export_json) if args.export_json else None
    month_file = Path(args.month_file)

    corpus: list[str] = []
    if session_md.exists():
        corpus.append(session_md.read_text(errors="ignore"))
    if export_json and export_json.exists():
        try:
            exported = json.loads(export_json.read_text(errors="ignore"))
            corpus.extend(collect_strings(exported))
        except Exception as exc:
            corpus.append(f"export parse failed: {exc}")

    sentences = split_sentences(unique_keep_order(corpus))
    broke = pick_matches(sentences, BROKE_PATTERNS, 5)
    improved = pick_matches(sentences, IMPROVED_PATTERNS, 5)
    policy = pick_matches(sentences, POLICY_PATTERNS, 5)

    if not broke:
        broke = ["No explicit failures were extracted automatically; inspect the exported session JSON if needed."]
    if not improved:
        improved = ["No explicit improvements were extracted automatically; inspect the session markdown and export."]
    if not policy:
        policy = ["Review this session for repeatable workflow changes and promote stable ones into AGENTS.md or the OpenCode runbook."]

    ensure_month_file(month_file)
    ts = datetime.now().isoformat(timespec="seconds")
    with month_file.open("a", encoding="utf-8") as f:
        f.write(f"## {ts} | knowledge-loop | {args.projects}\n\n")
        if args.session_note:
            f.write(f"- session_note: {args.session_note}\n")
        f.write(f"- session_md: {session_md}\n")
        if export_json and export_json.exists():
            f.write(f"- export_json: {export_json}\n")
        else:
            f.write("- export_json: not_created\n")
        f.write("\n### What Broke\n\n")
        for item in broke:
            f.write(f"- {item}\n")
        f.write("\n### What Improved\n\n")
        for item in improved:
            f.write(f"- {item}\n")
        f.write("\n### What Should Become Policy\n\n")
        for item in policy:
            f.write(f"- {item}\n")
        f.write("\n- source: opencode/knowledge-loop\n\n")

    print(f"Knowledge loop appended: {month_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
