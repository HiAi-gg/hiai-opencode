import { describe, expect, test } from "bun:test";
import { acquireConsoleGuard, releaseConsoleGuard } from "./index";

describe("TUI console isolation", () => {
  test("never forwards console output, including source-like text, to the original TUI console", () => {
    const originalLog = console.log;
    const seen: unknown[][] = [];
    console.log = (...args: unknown[]) => seen.push(args);
    try {
      acquireConsoleGuard();
      console.log("const secretImplementation = () => 'must not reach TUI';");
      expect(seen).toEqual([]);
    } finally {
      releaseConsoleGuard();
      console.log = originalLog;
    }
  });
});
