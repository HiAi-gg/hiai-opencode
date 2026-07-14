import { openSync, writeSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const LOG_PATH = join(homedir(), ".hiai-opencode", "logs", "hiai-opencode.log");

// Open the log file once at module init — if it fails, route to /dev/null.
// Bun plugin context breaks appendFileSync, but a raw fd works.
let fd: number;
try {
  fd = openSync(LOG_PATH, "a");
} catch {
  try {
    fd = openSync("/dev/null", "w");
  } catch {
    // Last resort — if even /dev/null fails, use a dummy function
  }
}

function format(level: string, args: unknown[]): string {
  const ts = new Date().toISOString();
  const msg = args
    .map((a) =>
      typeof a === "string"
        ? a
        : a instanceof Error
          ? a.stack ?? a.message
          : JSON.stringify(a),
    )
    .join(" ");
  return `[${ts}] [${level}] ${msg}\n`;
}

function writeLog(level: string, args: unknown[]) {
  if (fd! === undefined) return;
  try {
    writeSync(fd!, format(level, args));
  } catch {
    // Nothing we can do — don't fall back to console/stderr
  }
}

export function log(...args: unknown[]) {
  writeLog("LOG", args);
}

export function warn(...args: unknown[]) {
  writeLog("WARN", args);
}

export function error(...args: unknown[]) {
  writeLog("ERROR", args);
}

export const logger = { log, warn, error };
