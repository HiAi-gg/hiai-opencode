import { expect, test, describe, beforeEach, afterEach, mock } from "bun:test"
import type { TaskLifecycleEvent } from "./manager-notifier"
import type { BackgroundTask } from "./types"
import type { NotifierAdapter } from "./manager-notifier"

let mockToastManager: {
  addTask: (event: TaskLifecycleEvent) => void
  showCompletionToast: (opts: { id: string; description: string; duration: string }) => void
  updateTask: (taskId: string, status: string) => void
} | null = null

mock.module("../task-toast-manager", () => ({
  getTaskToastManager: () => mockToastManager,
  initTaskToastManager: () => {},
  TaskToastManager: class {},
}))

const { notifyTaskStarted, notifyTaskProgress, notifyTaskCompleted, notifyTaskFailed, enqueueNotificationForParent, notifyParentSession, startBatch, endBatch, isBatchMode } = await import("./manager-notifier")

function createMockTask(id: string, status: "pending" | "running" | "completed" | "error" | "cancelled" | "interrupt" = "running"): BackgroundTask {
  return {
    id,
    status,
    parentSessionID: "parent-1",
    parentMessageID: "msg-1",
    description: `Task ${id}`,
    prompt: "Test prompt",
    agent: "coder",
  }
}

function createMockAdapter(overrides?: {
  prompt?: (input: unknown) => Promise<unknown>
  messages?: (input: unknown) => Promise<unknown>
  enableParentSessionNotifications?: boolean
  queuePendingNotification?: (parentSessionID: string, notification: string) => void
}): NotifierAdapter {
  return {
    client: {
      session: {
        messages: overrides?.messages ?? (async () => ({ data: { info: {} } })),
        prompt: overrides?.prompt ?? (async () => ({})),
      },
    },
    directory: "/tmp/test",
    enableParentSessionNotifications: overrides?.enableParentSessionNotifications ?? true,
    tasks: new Map(),
    completedTaskSummaries: new Map(),
    pendingByParent: new Map(),
    pendingNotifications: new Map(),
    notificationQueueByParent: new Map(),
    queuePendingNotification: overrides?.queuePendingNotification ?? (() => {}),
    scheduleTaskRemoval: () => {},
    clearNotificationsForTask: () => {},
    cleanupPendingByParent: () => {},
    getTasksByParentSession: () => [],
  }
}

describe("Task 1.1: Background Notifications — Happy Path", () => {
  beforeEach(() => {
    mockToastManager = {
      addTask: () => {},
      showCompletionToast: () => {},
      updateTask: () => {},
    }
  })

  afterEach(() => {
    mockToastManager = null
    if (isBatchMode()) {
      endBatch()
    }
  })

  test("notifyTaskStarted adds task with running status", () => {
    let capturedEvent: TaskLifecycleEvent | null = null
    mockToastManager = {
      addTask: (event: TaskLifecycleEvent) => {
        capturedEvent = event
      },
      showCompletionToast: () => {},
      updateTask: () => {},
    }

    const event: TaskLifecycleEvent = {
      id: "task-1",
      description: "Test task",
      agent: "coder",
      isBackground: true,
    }

    notifyTaskStarted(event)

    expect(capturedEvent).not.toBeNull()
    expect(capturedEvent!.id).toBe("task-1")
    expect(capturedEvent!.status).toBe("running")
    expect(capturedEvent!.description).toBe("Test task")
  })

  test("notifyTaskProgress updates task status", () => {
    let capturedEvent: TaskLifecycleEvent | null = null
    mockToastManager = {
      addTask: (event: TaskLifecycleEvent) => {
        capturedEvent = event
      },
      showCompletionToast: () => {},
      updateTask: () => {},
    }

    const task = createMockTask("task-1")
    const event: TaskLifecycleEvent = {
      id: "task-1",
      description: "Progress update",
      agent: "coder",
      isBackground: true,
      status: "running",
    }

    notifyTaskProgress(task, event)

    expect(capturedEvent).not.toBeNull()
    expect(capturedEvent!.status).toBe("running")
  })

  test("notifyTaskCompleted marks task as completed", () => {
    let capturedEvent: TaskLifecycleEvent | null = null
    mockToastManager = {
      addTask: (event: TaskLifecycleEvent) => {
        capturedEvent = event
      },
      showCompletionToast: () => {},
      updateTask: () => {},
    }

    const task = createMockTask("task-1")
    const event: TaskLifecycleEvent = {
      id: "task-1",
      description: "Task done",
      agent: "coder",
      isBackground: true,
    }

    notifyTaskCompleted(task, event)

    expect(capturedEvent).not.toBeNull()
    expect(capturedEvent!.status).toBe("completed")
  })

  test("notifyTaskFailed marks task as error", () => {
    let capturedEvent: TaskLifecycleEvent | null = null
    mockToastManager = {
      addTask: (event: TaskLifecycleEvent) => {
        capturedEvent = event
      },
      showCompletionToast: () => {},
      updateTask: () => {},
    }

    const task = createMockTask("task-1")
    const event: TaskLifecycleEvent = {
      id: "task-1",
      description: "Task failed",
      agent: "coder",
      isBackground: true,
    }

    notifyTaskFailed(task, event)

    expect(capturedEvent).not.toBeNull()
    expect(capturedEvent!.status).toBe("error")
  })

  test("batch mode queues events until endBatch", () => {
    const events: TaskLifecycleEvent[] = []
    mockToastManager = {
      addTask: (event: TaskLifecycleEvent) => {
        events.push(event)
      },
      showCompletionToast: () => {},
      updateTask: () => {},
    }

    startBatch()

    notifyTaskStarted({ id: "task-1", description: "Task 1", agent: "coder", isBackground: true })
    notifyTaskStarted({ id: "task-2", description: "Task 2", agent: "coder", isBackground: true })
    notifyTaskCompleted(createMockTask("task-1"), { id: "task-1", description: "Task 1", agent: "coder", isBackground: true })

    expect(events.length).toBe(0)
    expect(isBatchMode()).toBe(true)

    endBatch()

    expect(events.length).toBe(3)
    expect(isBatchMode()).toBe(false)
  })

  test("enqueueNotificationForParent queues operations serially", async () => {
    const adapter = createMockAdapter()
    const operations: string[] = []

    const op1 = async () => {
      operations.push("op1")
    }
    const op2 = async () => {
      operations.push("op2")
    }

    await Promise.all([
      enqueueNotificationForParent(adapter, "parent-1", op1),
      enqueueNotificationForParent(adapter, "parent-1", op2),
    ])

    expect(operations).toEqual(["op1", "op2"])
  })

  test("enqueueNotificationForParent with no parentSessionID runs immediately", async () => {
    const adapter = createMockAdapter()
    let called = false

    await enqueueNotificationForParent(adapter, undefined, async () => {
      called = true
    })

    expect(called).toBe(true)
  })

  test("notifyParentSession sends notification to parent session", async () => {
    let promptCalled = false
    const adapter = createMockAdapter({
      prompt: async () => {
        promptCalled = true
        return {}
      },
    })

    const task = createMockTask("task-1", "completed")
    task.parentSessionID = "parent-1"
    task.startedAt = new Date(Date.now() - 5000)
    task.completedAt = new Date()

    await notifyParentSession(adapter, task)

    expect(promptCalled).toBe(true)
  })

  test("notifyParentSession does not notify when disabled", async () => {
    let promptCalled = false
    const adapter = createMockAdapter({
      prompt: async () => {
        promptCalled = true
        return {}
      },
      enableParentSessionNotifications: false,
    })

    const task = createMockTask("task-1", "completed")
    task.parentSessionID = "parent-1"

    await notifyParentSession(adapter, task)

    expect(promptCalled).toBe(false)
  })
})

describe("Task 1.2: Background Notifications — Error Path", () => {
  beforeEach(() => {
    mockToastManager = {
      addTask: () => {},
      showCompletionToast: () => {},
      updateTask: () => {},
    }
  })

  afterEach(() => {
    mockToastManager = null
  })

  test("notifyParentSession handles aborted session error", async () => {
    let queuedNotification = false
    const adapter = createMockAdapter({
      prompt: async () => {
        throw new Error("Session aborted")
      },
      queuePendingNotification: () => {
        queuedNotification = true
      },
    })

    const task = createMockTask("task-1", "completed")
    task.parentSessionID = "parent-1"
    task.startedAt = new Date(Date.now() - 5000)
    task.completedAt = new Date()

    await notifyParentSession(adapter, task)

    expect(queuedNotification).toBe(true)
  })

  test("notifyParentSession handles prompt injection error", async () => {
    let queuedNotification = false
    const adapter = createMockAdapter({
      prompt: async () => {
        throw new Error("UnknownError: createUserMessage failed")
      },
      queuePendingNotification: () => {
        queuedNotification = true
      },
    })

    const task = createMockTask("task-1", "completed")
    task.parentSessionID = "parent-1"
    task.startedAt = new Date(Date.now() - 5000)
    task.completedAt = new Date()

    await notifyParentSession(adapter, task)

    expect(queuedNotification).toBe(true)
  })

  test("enqueueNotificationForParent continues after previous failure", async () => {
    const adapter = createMockAdapter()
    const operations: string[] = []

    const failingOp = async () => {
      operations.push("fail")
      throw new Error("Previous operation failed")
    }

    const successOp = async () => {
      operations.push("success")
    }

    try {
      await enqueueNotificationForParent(adapter, "parent-1", failingOp)
    } catch {
    }
    await enqueueNotificationForParent(adapter, "parent-1", successOp)

    expect(operations).toEqual(["fail", "success"])
  })

  test("notifyParentSession handles missing prompt function", async () => {
    const adapter = createMockAdapter({
      prompt: undefined as unknown as (input: unknown) => Promise<unknown>,
    })

    const task = createMockTask("task-1", "completed")
    task.parentSessionID = "parent-1"
    task.startedAt = new Date(Date.now() - 5000)
    task.completedAt = new Date()

    await notifyParentSession(adapter, task)
  })

  test("notifyParentSession handles generic prompt error", async () => {
    const adapter = createMockAdapter({
      prompt: async () => {
        throw new Error("Generic error")
      },
    })

    const task = createMockTask("task-1", "completed")
    task.parentSessionID = "parent-1"
    task.startedAt = new Date(Date.now() - 5000)
    task.completedAt = new Date()

    await notifyParentSession(adapter, task)
  })
})
