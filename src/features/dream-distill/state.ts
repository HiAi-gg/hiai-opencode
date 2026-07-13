import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const STATE_DIR = join(homedir(), ".hiai-opencode", "state");
const STATE_FILE = join(STATE_DIR, "dream-distill-lastrun.json");

const lastRun = new Map<string, number>();
let loaded = false;

function ensureLoaded() {
  if (loaded) return;
  loaded = true;
  try {
    if (!existsSync(STATE_FILE)) return;
    const raw = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
    if (typeof raw !== "object" || raw === null) return;
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === "number") lastRun.set(k, v);
    }
  } catch {
    // Corrupt state file — start fresh.
  }
}

export function getLastRun(): Map<string, number> {
  ensureLoaded();
  return lastRun;
}

export function markFatal(key: string) {
  ensureLoaded();
  lastRun.set(key, -1);
}

export function save() {
  ensureLoaded();
  try {
    if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
    writeFileSync(STATE_FILE, JSON.stringify(Object.fromEntries(lastRun), null, 2));
  } catch {
    // Best-effort persistence.
  }
}
