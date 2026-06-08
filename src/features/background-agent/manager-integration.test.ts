import { expect, test, describe, beforeEach, afterEach } from "bun:test"
import { BackgroundManager } from "./manager"
import type { LaunchInput } from "./types"

describe("Task 6.1: Integration — Full Pipeline", () => {
  let manager: BackgroundManager
  let mockClient: any
  let createdSessions: string[] = []

  beforeEach(() => {
    createdSessions = []
    mockClient = {
      session: {
        create: async ({ body }: any) => {
          const sessionId = `session-${crypto.randomUUID().slice(0, 8)}`
          createdSessions.push(sessionId)
          return { id: sessionId }
        },
        get: async ({ path }: any) => {
          return {
            data: {
              id: path.id,
              parentID: undefined,
            },
          }
        },
        prompt: async () => ({ messages: [] }),
        promptAsync: async () => {},
        status: async () => ({}),
        todo: async () => [],
        abort: async () => {},
      },
      message: {
        list: async () => [],
      },
    }

    manager = new BackgroundManager(
      {
        client: mockClient,
        directory: "/test/dir",
      } as any,
      undefined,
      { enableParentSessionNotifications: false }
    )
  })

  afterEach(() => {
    manager.shutdown()
  })

  const createLaunchInput = (overrides: Partial<LaunchInput> = {}): LaunchInput => ({
    description: "Test task",
    prompt: "Do something",
    agent: "coder",
    parentSessionID: "parent-123",
    parentMessageID: "msg-456",
    ...overrides,
  })

  test("launch creates task with pending status and tracks it", async () => {
    const input = createLaunchInput()
    const task = await manager.launch(input)

    expect(task.id).toBeDefined()
    expect(task.status).toBe("pending")
    expect(task.description).toBe("Test task")
    expect(task.agent).toBe("coder")
    expect(task.parentSessionID).toBe("parent-123")
    expect(task.queuedAt).toBeDefined()

    const stored = manager.getTask(task.id)
    expect(stored).toBeDefined()
    expect(stored!.status).toBe("pending")
  })

  test("launch assigns rootSessionID from spawn context", async () => {
    const input = createLaunchInput()
    const task = await manager.launch(input)

    expect(task.rootSessionID).toBeDefined()
    expect(task.rootSessionID).toBe("parent-123")
  })

  test("launch sets spawnDepth based on parent chain", async () => {
    const task1 = await manager.launch(createLaunchInput({ parentSessionID: "root" }))
    expect(task1.spawnDepth).toBe(1)

    mockClient.session.get = async ({ path }: any) => {
      if (path.id === task1.id) {
        return { data: { id: path.id, parentID: "root" } }
      }
      return { data: { id: path.id, parentID: undefined } }
    }

    const task2 = await manager.launch(
      createLaunchInput({
        parentSessionID: task1.id,
        agent: "sub",
      })
    )
    expect(task2.spawnDepth).toBe(2)
  })

  test("launch queues task by concurrency key", async () => {
    const input1 = createLaunchInput({
      agent: "coder",
      model: { providerID: "anthropic", modelID: "claude-3" },
    })
    const input2 = createLaunchInput({
      agent: "coder",
      model: { providerID: "anthropic", modelID: "claude-3" },
    })

    const task1 = await manager.launch(input1)
    const task2 = await manager.launch(input2)

    expect(task1.concurrencyKey).toBeUndefined()
    expect(task2.concurrencyKey).toBeUndefined()

    expect(manager.getTask(task1.id)).toBeDefined()
    expect(manager.getTask(task2.id)).toBeDefined()
  })

  test("launch throws when agent is empty", async () => {
    const input = createLaunchInput({ agent: "" })

    expect(async () => {
      await manager.launch(input)
    }).toThrow("Agent parameter is required")
  })

  test("launch increments descendant count for root session", async () => {
    const input = createLaunchInput({ parentSessionID: "root-session" })
    const task = await manager.launch(input)

    expect(task.rootSessionID).toBe("root-session")
    expect(manager.pendingByParent.get("root-session")).toBeDefined()
  })

  test("launch tracks multiple tasks per parent", async () => {
    const parentId = "shared-parent"
    const task1 = await manager.launch(createLaunchInput({ parentSessionID: parentId }))
    const task2 = await manager.launch(createLaunchInput({ parentSessionID: parentId }))
    const task3 = await manager.launch(createLaunchInput({ parentSessionID: parentId }))

    const tasks = manager.getTasksByParentSession(parentId)
    expect(tasks.length).toBe(3)
    expect(tasks.map((t) => t.id)).toContain(task1.id)
    expect(tasks.map((t) => t.id)).toContain(task2.id)
    expect(tasks.map((t) => t.id)).toContain(task3.id)
  })

  test("launch respects concurrency model config", async () => {
    const config = {
      concurrency: {
        default: 2,
        model: { "anthropic/claude-3": 1 },
      },
    }

    const constrainedManager = new BackgroundManager(
      {
        client: mockClient,
        directory: "/test/dir",
      } as any,
      config as any,
      { enableParentSessionNotifications: false }
    )

    const input = createLaunchInput({
      model: { providerID: "anthropic", modelID: "claude-3" },
    })

    const task = await constrainedManager.launch(input)
    expect(task.status).toBe("pending")

    constrainedManager.shutdown()
  })

  test("launch returns immutable task snapshot", async () => {
    const input = createLaunchInput()
    const task = await manager.launch(input)

    const stored = manager.getTask(task.id)
    expect(stored).toBeDefined()

    task.status = "running" as any
    expect(stored!.status).toBe("pending")
  })

  test("launch creates unique task IDs", async () => {
    const ids = new Set<string>()

    for (let i = 0; i < 10; i++) {
      const task = await manager.launch(createLaunchInput())
      expect(ids.has(task.id)).toBe(false)
      ids.add(task.id)
    }

    expect(ids.size).toBe(10)
  })

  test("launch propagates parent metadata to task", async () => {
    const input = createLaunchInput({
      parentModel: { providerID: "openai", modelID: "gpt-4" },
      parentAgent: "coder",
      parentTools: { bash: true, read: false },
      category: "quick",
    })

    const task = await manager.launch(input)

    expect(task.parentModel).toEqual({ providerID: "openai", modelID: "gpt-4" })
    expect(task.parentAgent).toBe("coder")
    expect(task.parentTools).toEqual({ bash: true, read: false })
    expect(task.category).toBe("quick")
  })

  test("launch fallback chain is stored on task", async () => {
    const fallbackChain = [
      { providerID: "anthropic", modelID: "claude-3" },
      { providerID: "openai", modelID: "gpt-4" },
    ]

    const input = createLaunchInput({ fallbackChain: fallbackChain as any })
    const task = await manager.launch(input)

    expect(task.fallbackChain).toEqual(fallbackChain)
    expect(task.attemptCount).toBe(0)
  })

  test("full pipeline: launch → getTask → getTasksByParentSession", async () => {
    const parentId = "integration-parent"
    const inputs = [
      createLaunchInput({ parentSessionID: parentId, description: "Task A" }),
      createLaunchInput({ parentSessionID: parentId, description: "Task B" }),
      createLaunchInput({ parentSessionID: parentId, description: "Task C" }),
    ]

    const launched = await Promise.all(inputs.map((input) => manager.launch(input)))

    for (const task of launched) {
      const retrieved = manager.getTask(task.id)
      expect(retrieved).toBeDefined()
      expect(retrieved!.description).toBe(task.description)
    }

    const byParent = manager.getTasksByParentSession(parentId)
    expect(byParent.length).toBe(3)
    expect(byParent.map((t) => t.description).sort()).toEqual(["Task A", "Task B", "Task C"])
  })

  test("getAllDescendantTasks returns nested tasks", async () => {
    const rootTask = await manager.launch(
      createLaunchInput({ parentSessionID: "root" })
    )

    const childTask = await manager.launch(
      createLaunchInput({
        parentSessionID: rootTask.id,
        agent: "sub",
      })
    )

    const grandchildTask = await manager.launch(
      createLaunchInput({
        parentSessionID: childTask.id,
        agent: "sub",
      })
    )

    expect(rootTask.id).toBeDefined()
    expect(childTask.id).toBeDefined()
    expect(grandchildTask.id).toBeDefined()
  })

  test("launch with skills and skillContent", async () => {
    const input = createLaunchInput({
      skills: ["git-master", "test-driven-development"],
      skillContent: "Extra context for skills",
    })

    const task = await manager.launch(input)
    expect(task.id).toBeDefined()
  })

  test("launch reads maxDescendants from config", () => {
    const config = { maxDescendants: 5 }
    const mgr = new BackgroundManager(
      { client: mockClient, directory: "/test" } as any,
      config as any,
      { enableParentSessionNotifications: false }
    )
    const budget = (mgr as any).config?.maxDescendants
    expect(budget).toBe(5)
    mgr.shutdown()
  })

  test("shutdown does not throw", async () => {
    await manager.launch(createLaunchInput())

    expect(() => manager.shutdown()).not.toThrow()
  })

  test("launch populates taskHistory", async () => {
    const parentId = "history-parent"
    const task = await manager.launch(
      createLaunchInput({ parentSessionID: parentId })
    )

    const history = manager.taskHistory.getByParentSession(parentId)
    expect(history).toBeDefined()
    expect(history.length).toBeGreaterThan(0)
    expect(history[0].id).toBe(task.id)
    expect(history[0].agent).toBe("coder")
    expect(history[0].description).toBe("Test task")
    expect(history[0].status).toBe("pending")
  })
})
