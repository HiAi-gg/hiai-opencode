/**
 * session-manager/index.test.ts — Tests for session management tools.
 *
 * Verifies uninitialized-client handling, error paths, and formatting.
 */

import { describe, expect, test } from "bun:test";
import {
  sessionInfoTool,
  sessionListTool,
  sessionReadTool,
  sessionSearchTool,
  setSessionClient,
} from "./index";

// Reset client before each test group
function resetClient() {
  // @ts-expect-error - resetting the module-internal client reference
  setSessionClient(null);
}

describe("sessionListTool", () => {
  test("returns uninitialized message when client is null", async () => {
    resetClient();
    const result = await sessionListTool.execute({});
    expect(result).toContain("not initialized");
  });

  test("formats sessions from mocked client", async () => {
    const mockClient = {
      session: {
        list: async () => ({
          data: [
            { id: "s1", title: "Session One", status: "active" },
            { id: "s2", title: undefined, status: "idle" },
          ],
        }),
      },
    };
    setSessionClient(mockClient as any);

    const result = await sessionListTool.execute({});
    expect(result).toContain("s1");
    expect(result).toContain("Session One");
    expect(result).toContain("active");
    expect(result).toContain("s2");
    expect(result).toContain("untitled");
  });

  test("handles client.list error", async () => {
    const mockClient = {
      session: {
        list: async () => {
          throw new Error("connection refused");
        },
      },
    };
    setSessionClient(mockClient as any);

    const result = await sessionListTool.execute({});
    expect(result).toContain("Error listing sessions");
    expect(result).toContain("connection refused");
  });

  test("handles empty sessions list", async () => {
    const mockClient = {
      session: {
        list: async () => ({ data: [] }),
      },
    };
    setSessionClient(mockClient as any);

    const result = await sessionListTool.execute({});
    expect(result).toContain("No sessions found");
  });
});

describe("sessionReadTool", () => {
  test("returns uninitialized message when client is null", async () => {
    resetClient();
    const result = await sessionReadTool.execute({ session_id: "s1" });
    expect(result).toContain("not initialized");
  });

  test("reads and formats messages from mocked client", async () => {
    const mockClient = {
      session: {
        messages: async (_input: any) => ({
          data: [
            {
              info: { role: "user" },
              parts: [{ type: "text", text: "Hello" }],
            },
            {
              info: { role: "assistant" },
              parts: [{ type: "text", text: "Hi there!" }],
            },
          ],
        }),
      },
    };
    setSessionClient(mockClient as any);

    const result = await sessionReadTool.execute({ session_id: "s1" });
    expect(result).toContain("[user]");
    expect(result).toContain("Hello");
    expect(result).toContain("[assistant]");
    expect(result).toContain("Hi there!");
  });

  test("respects limit parameter", async () => {
    const messages = Array.from({ length: 50 }, (_, i) => ({
      info: { role: i % 2 === 0 ? "user" : "assistant" },
      parts: [{ type: "text", text: `msg ${i}` }],
    }));
    const mockClient = {
      session: {
        messages: async () => ({ data: messages }),
      },
    };
    setSessionClient(mockClient as any);

    const result = await sessionReadTool.execute({
      session_id: "s1",
      limit: 5,
    });
    const lines = result.split("\n---\n");
    expect(lines.length).toBeLessThanOrEqual(5);
  });

  test("handles client.messages error", async () => {
    const mockClient = {
      session: {
        messages: async () => {
          throw new Error("timeout");
        },
      },
    };
    setSessionClient(mockClient as any);

    const result = await sessionReadTool.execute({ session_id: "s1" });
    expect(result).toContain("Error reading session");
  });

  test("handles empty messages", async () => {
    const mockClient = {
      session: {
        messages: async () => ({ data: [] }),
      },
    };
    setSessionClient(mockClient as any);

    const result = await sessionReadTool.execute({ session_id: "s1" });
    expect(result).toContain("No messages");
  });
});

describe("sessionSearchTool", () => {
  test("returns uninitialized message when client is null", async () => {
    resetClient();
    const result = await sessionSearchTool.execute({ query: "test" });
    expect(result).toContain("not initialized");
  });

  test("searches sessions and returns matching ones", async () => {
    const mockClient = {
      session: {
        list: async () => ({
          data: [
            { id: "s1", title: "Bug fix" },
            { id: "s2", title: "Feature X" },
          ],
        }),
        messages: async ({ path }: any) => {
          if (path.id === "s1") {
            return {
              data: [
                { parts: [{ type: "text", text: "fixing a critical bug" }] },
              ],
            };
          }
          return {
            data: [{ parts: [{ type: "text", text: "building feature" }] }],
          };
        },
      },
    };
    setSessionClient(mockClient as any);

    const result = await sessionSearchTool.execute({ query: "bug" });
    expect(result).toContain("Bug fix");
    expect(result).not.toContain("Feature X");
  });

  test("returns not found message when no match", async () => {
    const mockClient = {
      session: {
        list: async () => ({
          data: [{ id: "s1", title: "Other" }],
        }),
        messages: async () => ({
          data: [{ parts: [{ type: "text", text: "some content" }] }],
        }),
      },
    };
    setSessionClient(mockClient as any);

    const result = await sessionSearchTool.execute({ query: "nonexistent" });
    expect(result).toContain("No results for");
  });

  test("handles client.search error gracefully", async () => {
    const mockClient = {
      session: {
        list: async () => {
          throw new Error("db error");
        },
      },
    };
    setSessionClient(mockClient as any);

    const result = await sessionSearchTool.execute({ query: "test" });
    expect(result).toContain("Error searching sessions");
  });
});

describe("sessionInfoTool", () => {
  test("returns uninitialized message when client is null", async () => {
    resetClient();
    const result = await sessionInfoTool.execute({ session_id: "s1" });
    expect(result).toContain("not initialized");
  });

  test("returns session info JSON from mocked client", async () => {
    const mockClient = {
      session: {
        get: async () => ({
          data: { id: "s1", title: "My Session", directory: "/projects/test" },
        }),
      },
    };
    setSessionClient(mockClient as any);

    const result = await sessionInfoTool.execute({ session_id: "s1" });
    expect(result).toContain("s1");
    expect(result).toContain("My Session");
    expect(result).toContain("/projects/test");
  });

  test("handles session not found", async () => {
    const mockClient = {
      session: {
        get: async () => ({ data: null }),
      },
    };
    setSessionClient(mockClient as any);

    const result = await sessionInfoTool.execute({ session_id: "nonexistent" });
    expect(result).toContain("Session not found");
  });

  test("handles client.get error", async () => {
    const mockClient = {
      session: {
        get: async () => {
          throw new Error("forbidden");
        },
      },
    };
    setSessionClient(mockClient as any);

    const result = await sessionInfoTool.execute({ session_id: "s1" });
    expect(result).toContain("Error getting session info");
  });
});
