import { closeSync, mkdirSync, openSync, writeSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const LOG_PATH = join(homedir(), ".hiai-opencode", "logs", "hiai-opencode.log");
let fd: number | undefined;
let users = 0;

function openLog(): void {
  if (fd !== undefined) return;
  try {
    mkdirSync(dirname(LOG_PATH), { recursive: true });
    fd = openSync(LOG_PATH, "a");
  } catch {
    fd = undefined;
  }
}

export function acquireLogger(): void {
  users += 1;
  openLog();
}
export function releaseLogger(): void {
  if (users === 0) return;
  users -= 1;
  if (users === 0 && fd !== undefined) {
    try {
      closeSync(fd);
    } catch {
      /* best effort */
    }
    fd = undefined;
  }
}

function format(level: string, args: unknown[]): string {
  const msg = args
    .map((arg) => {
      if (typeof arg === "string") return arg;
      if (arg instanceof Error) return arg.stack ?? arg.message;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(" ");
  return `[${new Date().toISOString()}] [${level}] ${msg}\n`;
}

function writeLog(level: string, args: unknown[]): void {
  openLog();
  if (fd === undefined) return;
  try {
    writeSync(fd, format(level, args));
  } catch {
    /* Never fall back to the TUI. */
  }
}

export function log(...args: unknown[]): void {
  writeLog("LOG", args);
}
export function warn(...args: unknown[]): void {
  writeLog("WARN", args);
}
export function error(...args: unknown[]): void {
  writeLog("ERROR", args);
}
export const logger = { log, warn, error };
