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

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getHiaiOpenCodeCacheDir } from "./data-path";
import { log } from "./logger";

interface CacheEntry {
  content: string;
  timestamp: number;
}

export class ReasoningContentCache {
  // Key format: "${sessionId}:${messageIndex}"
  private cache = new Map<string, CacheEntry>();

  // TTL in ms - entries expire after 30 minutes
  private readonly TTL_MS = 30 * 60 * 1000;

  private dirty = false;

  constructor() {
    this.loadCache();
  }

  private getCacheFilePath(): string {
    const dir = getHiaiOpenCodeCacheDir();
    const filename = process.env.NODE_ENV === "test"
      ? "reasoning-content-cache.test.json"
      : "reasoning-content-cache.json";
    return join(dir, filename);
  }

  private loadCache(): void {
    const filepath = this.getCacheFilePath();
    if (!existsSync(filepath)) {
      this.cache = new Map<string, CacheEntry>();
      return;
    }
    try {
      const content = readFileSync(filepath, "utf-8");
      const data = JSON.parse(content) as Record<string, CacheEntry>;
      this.cache = new Map<string, CacheEntry>(Object.entries(data));
      this.clearExpired();
    } catch (e) {
      log("[reasoning-content-cache] Error loading persistent cache from file:", String(e));
      this.cache = new Map<string, CacheEntry>();
    }
  }

  private persistCache(): void {
    const filepath = this.getCacheFilePath();
    try {
      const dir = getHiaiOpenCodeCacheDir();
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      const plainObj = Object.fromEntries(this.cache.entries());
      writeFileSync(filepath, JSON.stringify(plainObj, null, 2), "utf-8");
    } catch (e) {
      log("[reasoning-content-cache] Error persisting cache to file:", String(e));
    }
  }

  private setKey(key: string, value: CacheEntry): void {
    this.cache.set(key, value);
    this.dirty = true;
  }

  private deleteKey(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.dirty = true;
    }
    return deleted;
  }

  private flush(): void {
    if (this.dirty) {
      this.persistCache();
      this.dirty = false;
    }
  }

  private makeKey(sessionId: string, index: number): string {
    return `${sessionId}:${index}`;
  }

  private makeIdKey(sessionId: string, messageId: string): string {
    return `${sessionId}:id:${messageId}`;
  }

  /**
   * Save reasoning_content for a specific message in a session.
   * @param sessionId - The session identifier
   * @param index - The message index in the session
   * @param content - The reasoning_content string to cache
   */
  save(sessionId: string, index: number, content: string): void {
    const key = this.makeKey(sessionId, index);
    this.setKey(key, {
      content,
      timestamp: Date.now(),
    });
    this.flush();
  }

  /**
   * Save reasoning_content for a specific message by its messageId in a session.
   * @param sessionId - The session identifier
   * @param messageId - The unique message identifier
   * @param content - The reasoning_content string to cache
   */
  saveById(sessionId: string, messageId: string, content: string): void {
    const key = this.makeIdKey(sessionId, messageId);
    this.setKey(key, {
      content,
      timestamp: Date.now(),
    });
    this.flush();
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
      this.deleteKey(key);
      this.flush();
      return null;
    }

    return entry.content;
  }

  /**
   * Retrieve cached reasoning_content for a specific message by its messageId.
   * @param sessionId - The session identifier
   * @param messageId - The unique message identifier
   * @returns The cached content or null if not found/expired
   */
  retrieveById(sessionId: string, messageId: string): string | null {
    const key = this.makeIdKey(sessionId, messageId);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.TTL_MS) {
      this.deleteKey(key);
      this.flush();
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
    const result = messages.map((msg, index) => {
      if (typeof msg !== "object" || msg === null) return msg;

      const msgObj = msg as Record<string, unknown>;

      if (msgObj.info !== undefined && typeof msgObj.info === "object") {
        const infoObj = msgObj.info as Record<string, unknown>;

        const hasReasoningContent =
          "reasoning_content" in infoObj &&
          typeof infoObj.reasoning_content === "string" &&
          (infoObj.reasoning_content as string).length > 0;

        if (hasReasoningContent) return msg;

        // Try retrieving by message ID first
        let cached: string | null = null;
        if (typeof infoObj.id === "string" && infoObj.id.length > 0) {
          cached = this.retrieveById(sessionId, infoObj.id);
        }
        // Fall back to index
        if (cached === null) {
          cached = this.retrieve(sessionId, index);
        }

        if (cached === null) return msg;

        return { ...msgObj, info: { ...infoObj, reasoning_content: cached } };
      }

      const hasReasoningContent =
        "reasoning_content" in msgObj &&
        typeof msgObj.reasoning_content === "string" &&
        (msgObj.reasoning_content as string).length > 0;

      if (hasReasoningContent) return msg;

      // Try retrieving by message ID first
      let cached: string | null = null;
      if (typeof msgObj.id === "string" && msgObj.id.length > 0) {
        cached = this.retrieveById(sessionId, msgObj.id);
      }
      // Fall back to index
      if (cached === null) {
        cached = this.retrieve(sessionId, index);
      }

      if (cached === null) return msg;

      return { ...msgObj, reasoning_content: cached };
    });
    this.flush();
    return result;
  }

  /**
   * Clear all cache entries for a specific session.
   * Call this when a session is cleaned up.
   */
  clearSession(sessionId: string): void {
    const prefix = `${sessionId}:`;
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.deleteKey(key);
      }
    }
    this.flush();
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
        this.deleteKey(key);
        cleared++;
      }
    }
    this.flush();
    return cleared;
  }

  /**
   * Clear all entries in the cache (both in-memory and persisted).
   * Useful for test isolation.
   */
  clearAll(): void {
    this.cache.clear();
    this.dirty = true;
    this.flush();
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

/**
 * Safely extracts reasoning content from a message info object.
 * Looks in reasoning_content, reasoningContent, reasoning, and parts of type reasoning/thinking/redacted_thinking.
 */
export function extractReasoningContent(info: unknown): string | null {
  if (typeof info !== "object" || info === null) return null;

  const infoObj = info as Record<string, unknown>;

  // 1. Direct fields
  if (typeof infoObj.reasoning_content === "string" && infoObj.reasoning_content.trim().length > 0) {
    return infoObj.reasoning_content;
  }
  if (typeof infoObj.reasoningContent === "string" && infoObj.reasoningContent.trim().length > 0) {
    return infoObj.reasoningContent;
  }
  if (typeof infoObj.reasoning === "string" && infoObj.reasoning.trim().length > 0) {
    return infoObj.reasoning;
  }

  // 2. Parts array
  if (Array.isArray(infoObj.parts)) {
    const parts = infoObj.parts as Array<Record<string, unknown>>;
    const reasoningTexts: string[] = [];

    for (const part of parts) {
      if (typeof part !== "object" || part === null) continue;
      const type = part.type;
      if (type === "reasoning" && typeof part.text === "string" && part.text.trim().length > 0) {
        reasoningTexts.push(part.text);
      } else if (
        (type === "thinking" || type === "redacted_thinking") &&
        typeof part.thinking === "string" &&
        part.thinking.trim().length > 0
      ) {
        reasoningTexts.push(part.thinking);
      }
    }

    if (reasoningTexts.length > 0) {
      return reasoningTexts.join("\n");
    }
  }

  return null;
}
