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

function writeWithFallback(level: string, msg: string) {
  try {
    appendFileSync(LOG_FILE, msg, "utf-8");
  } catch (e) {
    process.stderr.write(`[log-fallback] ${msg}`);
  }
}

export function log(...args: unknown[]) {
  ensureDir();
  writeWithFallback("LOG", formatMessage("LOG", ...args));
}

export function warn(...args: unknown[]) {
  ensureDir();
  writeWithFallback("WARN", formatMessage("WARN", ...args));
}

export function error(...args: unknown[]) {
  ensureDir();
  writeWithFallback("ERROR", formatMessage("ERROR", ...args));
}

export const logger = { log, warn, error };
