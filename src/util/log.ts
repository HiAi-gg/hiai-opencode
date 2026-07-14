import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const LOG_DIR = join(homedir(), ".hiai-opencode", "logs");
const LOG_FILE = join(LOG_DIR, "hiai-opencode.log");

let initialized = false;

function ensureDir() {
  if (!initialized) {
    mkdirSync(LOG_DIR, { recursive: true });
    initialized = true;
  }
}

function formatMessage(level: string, ...args: unknown[]): string {
  const ts = new Date().toISOString();
  const msg = args
    .map((a) => (typeof a === "string" ? a : a instanceof Error ? a.stack ?? a.message : JSON.stringify(a)))
    .join(" ");
  return `[${ts}] [${level}] ${msg}\n`;
}

export function log(...args: unknown[]) {
  ensureDir();
  try {
    appendFileSync(LOG_FILE, formatMessage("LOG", ...args), "utf-8");
  } catch {
    // File write failed — silently ignored (stderr also leaks into TUI)
  }
}

export function warn(...args: unknown[]) {
  ensureDir();
  try {
    appendFileSync(LOG_FILE, formatMessage("WARN", ...args), "utf-8");
  } catch {}
}

export function error(...args: unknown[]) {
  ensureDir();
  try {
    appendFileSync(LOG_FILE, formatMessage("ERROR", ...args), "utf-8");
  } catch {}
}

export const logger = { log, warn, error };
