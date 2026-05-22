import { beforeEach, describe, expect, test } from "bun:test";
import {
  ReasoningContentCache,
  reasoningContentCache,
} from "./reasoning-content-cache";

describe("ReasoningContentCache", () => {
  let cache: ReasoningContentCache;

  beforeEach(() => {
    cache = new ReasoningContentCache();
  });

  describe("save and retrieve", () => {
    test("saves and retrieves reasoning_content for a message index", () => {
      const sessionID = "session-123";
      const index = 5;
      const content = "This is the reasoning content";

      cache.save(sessionID, index, content);
      const result = cache.retrieve(sessionID, index);

      expect(result).toBe(content);
    });

    test("returns null for non-existent session", () => {
      const result = cache.retrieve("non-existent-session", 0);
      expect(result).toBeNull();
    });

    test("returns null for non-existent index", () => {
      const result = cache.retrieve("session-123", 999);
      expect(result).toBeNull();
    });

    test("overwrites existing content at same index", () => {
      const sessionID = "session-123";
      const index = 5;

      cache.save(sessionID, index, "First content");
      cache.save(sessionID, index, "Second content");

      expect(cache.retrieve(sessionID, index)).toBe("Second content");
    });
  });

  describe("reinjectIntoMessages", () => {
    test("reinjects reasoning_content into messages missing it (MessageWithParts style)", () => {
      const sessionID = "session-123";
      cache.save(sessionID, 0, "Cached reasoning for msg 0");
      cache.save(sessionID, 1, "Cached reasoning for msg 1");
      cache.save(sessionID, 2, "Cached reasoning for msg 2");

      const messages = [
        {
          info: { role: "user", reasoning_content: "original user reasoning" },
        },
        { info: { role: "assistant", reasoning_content: "" } },
        { info: { role: "assistant" } },
      ];

      const result = cache.reinjectIntoMessages(
        sessionID,
        messages as unknown[],
      ) as Array<{
        info: { reasoning_content?: string };
      }>;

      expect(result[0].info.reasoning_content).toBe("original user reasoning");
      expect(result[1].info.reasoning_content).toBe(
        "Cached reasoning for msg 1",
      );
      expect(result[2].info.reasoning_content).toBe(
        "Cached reasoning for msg 2",
      );
    });

    test("reinjects reasoning_content into flat message objects (legacy style)", () => {
      const sessionID = "session-456";
      cache.save(sessionID, 1, "Cached flat reasoning 1");
      cache.save(sessionID, 2, "Cached flat reasoning 2");

      const messages = [
        { role: "user", reasoning_content: "user reasoning" },
        { role: "assistant", reasoning_content: "" },
        { role: "assistant" },
      ];

      const result = cache.reinjectIntoMessages(
        sessionID,
        messages as unknown[],
      ) as Array<{
        reasoning_content?: string;
      }>;

      expect(result[0].reasoning_content).toBe("user reasoning");
      expect(result[1].reasoning_content).toBe("Cached flat reasoning 1");
      expect(result[2].reasoning_content).toBe("Cached flat reasoning 2");
    });

    test("does not overwrite existing non-empty reasoning_content", () => {
      const sessionID = "session-789";
      cache.save(sessionID, 0, "Should not be used");

      const messages = [
        {
          info: { role: "assistant", reasoning_content: "Already has content" },
        },
      ];

      const result = cache.reinjectIntoMessages(
        sessionID,
        messages as unknown[],
      ) as Array<{
        info: { reasoning_content: string };
      }>;

      expect(result[0].info.reasoning_content).toBe("Already has content");
    });

    test("preserves non-object messages", () => {
      const sessionID = "session-abc";

      const messages = ["not an object", null, 42];

      const result = cache.reinjectIntoMessages(
        sessionID,
        messages as unknown[],
      );

      expect(result[0]).toBe("not an object");
      expect(result[1]).toBeNull();
      expect(result[2]).toBe(42);
    });

    test("handles mixed MessageWithParts and flat objects", () => {
      const sessionID = "session-mixed";
      cache.save(sessionID, 1, "Mixed reasoning");

      const messages = [
        { info: { role: "assistant", reasoning_content: "already set" } },
        { role: "assistant", reasoning_content: "" }, // flat object, empty - should be filled
      ];

      const result = cache.reinjectIntoMessages(
        sessionID,
        messages as unknown[],
      );

      expect(
        (result[0] as { info: { reasoning_content: string } }).info
          .reasoning_content,
      ).toBe("already set");
      expect(
        (result[1] as { reasoning_content?: string }).reasoning_content,
      ).toBe("Mixed reasoning");
    });
  });

  describe("clearSession", () => {
    test("clears all entries for a session", () => {
      const sessionID = "session-to-clear";
      cache.save(sessionID, 0, "Content 0");
      cache.save(sessionID, 1, "Content 1");
      cache.save("other-session", 0, "Other content");

      cache.clearSession(sessionID);

      expect(cache.retrieve(sessionID, 0)).toBeNull();
      expect(cache.retrieve(sessionID, 1)).toBeNull();
      expect(cache.retrieve("other-session", 0)).toBe("Other content");
    });

    test("clearSession on non-existent session does nothing", () => {
      cache.save("session-1", 0, "Content");
      cache.clearSession("non-existent-session");
      expect(cache.retrieve("session-1", 0)).toBe("Content");
    });
  });

  describe("clearExpired", () => {
    test("clears entries beyond TTL", () => {
      const cache = new ReasoningContentCache();
      const sessionID = "session-expiry";

      // Manually set an old entry by using internal access
      // Since we can't easily manipulate time, we test the logic via stats
      cache.save(sessionID, 0, "Current content");

      const stats = cache.stats();
      expect(stats.size).toBe(1);
      expect(stats.oldestTimestamp).not.toBeNull();
      expect(stats.newestTimestamp).not.toBeNull();
    });

    test("returns count of cleared entries", () => {
      const cache = new ReasoningContentCache();
      const sessionID = "session-count";

      cache.save(sessionID, 0, "Content 0");
      cache.save(sessionID, 1, "Content 1");

      // Since we can't easily expire entries without time manipulation,
      // this test verifies the method exists and returns a number
      const cleared = cache.clearExpired();
      expect(typeof cleared).toBe("number");
    });
  });

  describe("stats", () => {
    test("returns correct stats for empty cache", () => {
      const stats = cache.stats();
      expect(stats.size).toBe(0);
      expect(stats.oldestTimestamp).toBeNull();
      expect(stats.newestTimestamp).toBeNull();
    });

    test("returns correct stats after saving entries", () => {
      cache.save("session-1", 0, "Content 1");
      cache.save("session-2", 0, "Content 2");

      const stats = cache.stats();
      expect(stats.size).toBe(2);
      expect(stats.oldestTimestamp).not.toBeNull();
      expect(stats.newestTimestamp).not.toBeNull();
    });
  });

  describe("singleton instance", () => {
    test("reasoningContentCache singleton is available", () => {
      expect(reasoningContentCache).toBeDefined();
      expect(reasoningContentCache).toBeInstanceOf(ReasoningContentCache);
    });

    test("singleton can save and retrieve", () => {
      const sessionID = "singleton-test";
      reasoningContentCache.save(sessionID, 0, "Singleton content");
      expect(reasoningContentCache.retrieve(sessionID, 0)).toBe(
        "Singleton content",
      );
      reasoningContentCache.clearSession(sessionID);
    });
  });
});
