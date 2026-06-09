import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { LOG_FILENAME } from "./plugin-identity";

const logFile = path.join(os.tmpdir(), LOG_FILENAME);

let buffer: string[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const FLUSH_INTERVAL_MS = 500;
const BUFFER_SIZE_LIMIT = 50;

const LOG_LEVELS: Record<string, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};
let currentLogLevel: number = LOG_LEVELS.info;

function flush(): void {
  if (buffer.length === 0) return;
  const data = buffer.join("");
  buffer = [];
  try {
    fs.appendFileSync(logFile, data);
    try {
      fs.chmodSync(logFile, 0o600);
    } catch (error) {
      // self-eating: chmod on the log file failed (e.g. file removed, EPERM).
      // Cannot recurse into the logger here, fall back to console.
      console.error("[logger] chmodSync failed:", error);
    }
  } catch (err) {
    try {
      process.stderr.write(`${String(err)}\n`);
    } catch {
      // self-eating: stderr is closed or unwritable. Nothing we can do.
    }
  }
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_INTERVAL_MS);
}

export function log(
  message: string,
  data?: unknown,
  level: string = "info",
): void {
  if (level in LOG_LEVELS && LOG_LEVELS[level] < currentLogLevel) return;
  try {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message} ${data ? JSON.stringify(data) : ""}\n`;
    buffer.push(logEntry);
    if (buffer.length >= BUFFER_SIZE_LIMIT) {
      flush();
    } else {
      scheduleFlush();
    }
  } catch (err) {
    try {
      process.stderr.write(`[logger] log failed: ${err}\n`);
    } catch (error) {
      // self-eating: stderr is closed or unwritable. Nothing we can do.
      console.error("[logger] stderr fallback failed:", error);
    }
  }
}

export function logDebug(message: string, data?: unknown): void {
  if (currentLogLevel > LOG_LEVELS.debug) return;
  try {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] DEBUG: ${message} ${data ? JSON.stringify(data) : ""}\n`;
    buffer.push(logEntry);
    if (buffer.length >= BUFFER_SIZE_LIMIT) {
      flush();
    } else {
      scheduleFlush();
    }
  } catch (err) {
    try {
      process.stderr.write(`[logger] logDebug failed: ${err}\n`);
    } catch (error) {
      // self-eating: stderr is closed or unwritable. Nothing we can do.
      console.error("[logger] stderr fallback failed:", error);
    }
  }
}

export function logWarn(message: string, data?: unknown): void {
  log(`WARN: ${message}`, data, "warn");
}

export function logError(message: string, data?: unknown): void {
  log(`ERROR: ${message}`, data, "error");
}

export function getLogFilePath(): string {
  return logFile;
}

export function setLogLevel(level: string): void {
  if (level in LOG_LEVELS) {
    currentLogLevel = LOG_LEVELS[level];
  }
}

export function getLogLevel(): string {
  for (const [name, value] of Object.entries(LOG_LEVELS)) {
    if (value === currentLogLevel) return name;
  }
  return "info";
}

export function setLogLevelFromEnv(): void {
  const envLevel = process.env.HIAI_OPENCODE_LOG_LEVEL?.toLowerCase();
  if (envLevel && envLevel in LOG_LEVELS) {
    currentLogLevel = LOG_LEVELS[envLevel];
  }
}
