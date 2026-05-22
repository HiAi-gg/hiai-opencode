/**
 * MITIGATION ONLY - upstream fix required
 *
 * This module provides a temporary cache for reasoning_content that gets stripped
 * during message serialization in OpenAI-compatible SDKs. The root cause is an upstream
 * bug where reasoning_content fields are lost when messages are processed through
 * the SDK's message handling pipeline.
 *
 * The actual fix requires an update to the upstream SDK. This cache is a workaround
 * that stores reasoning_content separately and allows reinjection when needed.
 *
 * Usage:
 *   1. Before message serialization: cache.save(sessionId, index, content)
 *   2. After message deserialization: cache.retrieve(sessionId, index)
 *   3. To restore: messages = cache.reinjectIntoMessages(sessionId, messages)
 */

interface CacheEntry {
  content: string;
  timestamp: number;
}

export class ReasoningContentCache {
  // Key format: "${sessionId}:${messageIndex}"
  private cache = new Map<string, CacheEntry>();

  // TTL in ms - entries expire after 30 minutes
  private readonly TTL_MS = 30 * 60 * 1000;

  private makeKey(sessionId: string, index: number): string {
    return `${sessionId}:${index}`;
  }

  /**
   * Save reasoning_content for a specific message in a session.
   * @param sessionId - The session identifier
   * @param index - The message index in the session
   * @param content - The reasoning_content string to cache
   */
  save(sessionId: string, index: number, content: string): void {
    const key = this.makeKey(sessionId, index);
    this.cache.set(key, {
      content,
      timestamp: Date.now(),
    });
  }

  /**
   * Retrieve cached reasoning_content for a specific message.
   * @param sessionId - The session identifier
   * @param index - The message index in the session
   * @returns The cached content or null if not found/expired
   */
  retrieve(sessionId: string, index: number): string | null {
    const key = this.makeKey(sessionId, index);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.TTL_MS) {
      this.cache.delete(key);
      return null;
    }

    return entry.content;
  }

  /**
   * Reinject reasoning_content into messages that may have lost it during serialization.
   * This iterates through messages and restores reasoning_content from the cache where
   * the field is missing or empty but we have a cached value.
   *
   * Handles two message structures:
   * - MessageWithParts (with info/reasoning_content at msg.info.reasoning_content)
   * - Flat objects (with reasoning_content at msg.reasoning_content, legacy path)
   *
   * @param sessionId - The session identifier
   * @param messages - The messages array to process
   * @returns Messages with reasoning_content restored where applicable
   */
  reinjectIntoMessages(sessionId: string, messages: unknown[]): unknown[] {
    return messages.map((msg, index) => {
      if (typeof msg !== "object" || msg === null) return msg;

      const msgObj = msg as Record<string, unknown>;

      if (msgObj.info !== undefined && typeof msgObj.info === "object") {
        const infoObj = msgObj.info as Record<string, unknown>;

        const hasReasoningContent =
          "reasoning_content" in infoObj &&
          typeof infoObj.reasoning_content === "string" &&
          (infoObj.reasoning_content as string).length > 0;

        if (hasReasoningContent) return msg;

        const cached = this.retrieve(sessionId, index);
        if (cached === null) return msg;

        return { ...msgObj, info: { ...infoObj, reasoning_content: cached } };
      }

      const hasReasoningContent =
        "reasoning_content" in msgObj &&
        typeof msgObj.reasoning_content === "string" &&
        (msgObj.reasoning_content as string).length > 0;

      if (hasReasoningContent) return msg;

      const cached = this.retrieve(sessionId, index);
      if (cached === null) return msg;

      return { ...msgObj, reasoning_content: cached };
    });
  }

  /**
   * Clear all cache entries for a specific session.
   * Call this when a session is cleaned up.
   */
  clearSession(sessionId: string): void {
    const prefix = `${sessionId}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all expired entries. Called automatically on retrieve,
   * but can be triggered manually for batch cleanup.
   */
  clearExpired(): number {
    const now = Date.now();
    let cleared = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.TTL_MS) {
        this.cache.delete(key);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Get cache statistics for monitoring.
   */
  stats(): {
    size: number;
    oldestTimestamp: number | null;
    newestTimestamp: number | null;
  } {
    let oldest: number | null = null;
    let newest: number | null = null;

    for (const entry of this.cache.values()) {
      if (oldest === null || entry.timestamp < oldest) oldest = entry.timestamp;
      if (newest === null || entry.timestamp > newest) newest = entry.timestamp;
    }

    return {
      size: this.cache.size,
      oldestTimestamp: oldest,
      newestTimestamp: newest,
    };
  }
}

// Singleton instance for module-level use
export const reasoningContentCache = new ReasoningContentCache();
