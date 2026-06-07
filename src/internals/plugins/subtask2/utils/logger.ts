import * as fs from "fs";
import * as path from "path";
import { log as sharedLog } from "../../../../shared/logger";

const LOG_DIR = path.join(process.cwd(), ".logs");
const LOG_FILE = path.join(LOG_DIR, "subtask2.log");
const WRITE_INTERVAL_MS = 100;

let logBuffer: string[] = [];
let writeScheduled = false;
let initialized = false;

function ensureInitialized(): boolean {
  if (initialized) return true;

  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    fs.writeFileSync(LOG_FILE, "");
    initialized = true;
    return true;
  } catch {
    return false;
  }
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

async function flushLogs(): Promise<void> {
  if (logBuffer.length === 0) {
    writeScheduled = false;
    return;
  }

  const toWrite = logBuffer.join("");
  logBuffer = [];
  writeScheduled = false;

  try {
    await fs.promises.appendFile(LOG_FILE, toWrite);
  } catch (error) {
    // Self-eating: subtask2's log file failed to write (disk full, EACCES,
    // file removed). Surface to the main hiai-opencode log file via sharedLog
    // so we have a single place to inspect subtask2 log-loss. The buffered
    // entries are intentionally dropped — they have already been delivered
    // to the schedule, not the call site.
    sharedLog("[subtask2] log file write failed, dropping buffered entries", {
      path: LOG_FILE,
      error: String(error),
    });
  }
}

function scheduleFlush(): void {
  if (!writeScheduled) {
    writeScheduled = true;
    setTimeout(flushLogs, WRITE_INTERVAL_MS);
  }
}

export function log(...args: unknown[]) {
  if (!ensureInitialized()) return;

  const timestamp = formatTimestamp();
  const message = args
    .map(a => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a)))
    .join(" ");
  logBuffer.push(`[${timestamp}] ${message}\n`);
  scheduleFlush();
}

export function clearLog() {
  if (!ensureInitialized()) return;
  fs.writeFileSync(LOG_FILE, "");
}
