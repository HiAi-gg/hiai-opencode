#!/usr/bin/env python3
import re, os, sys

SRC = os.path.join(os.path.dirname(__file__), "..", "src")
LOG_TS = os.path.join(SRC, "util", "log.ts")

def patch_file(fp):
    with open(fp) as f:
        lines = f.readlines()
    
    has_console = any(re.search(r'\bconsole\.(log|warn|error)\b', l) for l in lines)
    if not has_console:
        return

    rel = os.path.relpath(LOG_TS, os.path.dirname(fp)).replace(".ts", "")
    if not rel.startswith("."):
        rel = "./" + rel

    # Already imported?
    if any(f'from "{rel}"' in l or f"from '{rel}'" in l for l in lines):
        return

    # Replace console.*
    for i in range(len(lines)):
        lines[i] = re.sub(r'\bconsole\.log\b', 'logger.log', lines[i])
        lines[i] = re.sub(r'\bconsole\.warn\b', 'logger.warn', lines[i])
        lines[i] = re.sub(r'\bconsole\.error\b', 'logger.error', lines[i])

    # Find last import statement line (0-based)
    # An import statement starts with "import " at column 0
    # or is a continuation (line starting with spaces then } or keyword in a multi-line import)
    last_import = -1
    in_multiline = False
    for i, line in enumerate(lines):
        s = line.strip()
        if not s:
            continue
        if in_multiline:
            if s.startswith("}") or s.startswith("]") or s.startswith(")"):
                in_multiline = False
                last_import = i
            continue
        if s.startswith("import "):
            if s.count("{") > s.count("}"):
                in_multiline = True
            last_import = i
        elif s.startswith("export ") and not any(s.startswith(f"export {kw}") for kw in ["function", "class", "const", "let", "var", "default", "type", "async", "interface"]):
            if s.count("{") > s.count("}"):
                in_multiline = True
            last_import = i
        elif last_import >= 0:
            # After imports, stop scanning
            break

    insert = f'import {{ logger }} from "{rel}";\n'
    if last_import >= 0:
        lines.insert(last_import + 1, insert)
    else:
        # No imports — insert after file header comment
        cutoff = 0
        for i, line in enumerate(lines):
            s = line.strip()
            if s.startswith("//") or s.startswith("/*") or s.startswith("*") or s.startswith("#!") or not s:
                cutoff = i + 1
            else:
                break
        lines.insert(cutoff, insert)

    with open(fp, "w") as f:
        f.writelines(lines)
    print(f"  OK  {os.path.relpath(fp, SRC)}")

for root, dirs, files in os.walk(SRC):
    dirs[:] = [d for d in dirs if d not in ("node_modules", ".turbo")]
    for f in files:
        if f.endswith(".ts") and ".test." not in f and f != "log.ts":
            try:
                patch_file(os.path.join(root, f))
            except Exception as e:
                print(f"  ERR {f}: {e}", file=sys.stderr)
print("Done.")
