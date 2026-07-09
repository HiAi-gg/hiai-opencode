/**
 * firecrawl-error.test.ts — Tests for Firecrawl error classification helpers.
 */

import { beforeEach, describe, expect, test } from "bun:test";
import { formatFirecrawlError, hasFirecrawlKey } from "./firecrawl";

describe("hasFirecrawlKey", () => {
  beforeEach(() => {
    delete process.env.FIRECRAWL_API_KEY;
  });

  test("returns false when key is not set", () => {
    expect(hasFirecrawlKey()).toBe(false);
  });

  test("returns false when key is empty string", () => {
    process.env.FIRECRAWL_API_KEY = "";
    expect(hasFirecrawlKey()).toBe(false);
  });

  test("returns false when key is only whitespace", () => {
    process.env.FIRECRAWL_API_KEY = "   ";
    expect(hasFirecrawlKey()).toBe(false);
  });

  test("returns true when key is set and non-empty", () => {
    process.env.FIRECRAWL_API_KEY = "test-key-123";
    expect(hasFirecrawlKey()).toBe(true);
  });
});

describe("formatFirecrawlError", () => {
  beforeEach(() => {
    delete process.env.FIRECRAWL_API_KEY;
  });

  describe("CLI not installed", () => {
    test("classifies command not found", () => {
      const result = formatFirecrawlError(
        "firecrawl: command not found",
        "",
        "",
      );
      expect(result).toContain("not installed");
      expect(result).toContain("bun add -g firecrawl-cli");
    });

    test("classifies ENOENT", () => {
      const result = formatFirecrawlError(
        "ENOENT: no such file or directory",
        "",
        "",
      );
      expect(result).toContain("not installed");
    });

    test("classifies cannot find module", () => {
      const result = formatFirecrawlError(
        "Cannot find module firecrawl",
        "",
        "",
      );
      expect(result).toContain("not installed");
    });
  });

  describe("401 / invalid key", () => {
    test("classifies 401 error with key set as invalid/expired", () => {
      process.env.FIRECRAWL_API_KEY = "some-key";
      const result = formatFirecrawlError("", "401 Unauthorized", "");
      expect(result).toContain("invalid or expired");
      expect(result).not.toContain("not set");
    });

    test("classifies 401 error without key set as missing", () => {
      const result = formatFirecrawlError("", "401 Unauthorized", "");
      expect(result).toContain("not set");
      expect(result).toContain("bob.env");
    });

    test("classifies invalid token error", () => {
      process.env.FIRECRAWL_API_KEY = "some-key";
      const result = formatFirecrawlError("", "Invalid token", "");
      expect(result).toContain("invalid or expired");
    });

    test("classifies invalid api key error", () => {
      process.env.FIRECRAWL_API_KEY = "some-key";
      const result = formatFirecrawlError("", "Invalid API key", "");
      expect(result).toContain("invalid or expired");
    });

    test("classifies authentication failed error", () => {
      process.env.FIRECRAWL_API_KEY = "some-key";
      const result = formatFirecrawlError("", "Authentication failed", "");
      expect(result).toContain("invalid or expired");
    });

    test("classifies credentials are invalid error", () => {
      process.env.FIRECRAWL_API_KEY = "some-key";
      const result = formatFirecrawlError("", "Credentials are invalid", "");
      expect(result).toContain("invalid or expired");
    });
  });

  describe("missing key", () => {
    test("classifies missing api key when key not set", () => {
      const result = formatFirecrawlError("", "Missing API key", "");
      expect(result).toContain("not set");
      expect(result).toContain("bob.env");
    });

    test("classifies no api key error", () => {
      const result = formatFirecrawlError("", "No API key provided", "");
      expect(result).toContain("not set");
    });

    test("classifies api key required error", () => {
      const result = formatFirecrawlError("", "API key required", "");
      expect(result).toContain("not set");
    });

    test("when key is set but still missing, suggests keyless/cached issue", () => {
      process.env.FIRECRAWL_API_KEY = "some-key";
      const result = formatFirecrawlError("", "API key is missing", "");
      expect(result).toContain("despite");
      expect(result).toContain("cached");
    });
  });

  describe("rate limit", () => {
    test("classifies rate limit error", () => {
      const result = formatFirecrawlError("", "Rate limit exceeded", "");
      expect(result).toContain("rate limit");
      expect(result).toContain("firecrawl.dev");
    });

    test("classifies too many requests error", () => {
      const result = formatFirecrawlError("", "Too many requests", "");
      expect(result).toContain("rate limit");
    });
  });

  describe("generic error", () => {
    test("returns original message for unknown errors", () => {
      const result = formatFirecrawlError("", "", "Unknown error occurred");
      expect(result).toContain("Unknown error occurred");
    });

    test("returns stdout when stderr is empty", () => {
      const result = formatFirecrawlError("", "some output", "");
      expect(result).toBe("some output");
    });

    test("prefers stderr over stdout", () => {
      const result = formatFirecrawlError("error output", "stdout output", "");
      expect(result).toBe("error output");
    });
  });

  test("does not leak secret values in error messages", () => {
    process.env.FIRECRAWL_API_KEY = "super-secret-key-12345";
    const result = formatFirecrawlError("", "401 Unauthorized", "");
    expect(result).not.toContain("super-secret-key");
    expect(result).not.toContain("12345");
  });
});
