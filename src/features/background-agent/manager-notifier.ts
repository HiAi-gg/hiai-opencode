import type { BackgroundTask } from "./types"
import type { BackgroundTaskNotificationTask } from "./background-task-notification-template"
import { buildBackgroundTaskNotificationText } from "./background-task-notification-template"
import { formatDuration } from "./duration-formatter"
import { log, normalizeSDKResponse, normalizePromptTools, resolveInheritedPromptTools, createInternalAgentTextPart } from "../../shared"
import { isRecord } from "../../shared/record-type-guard"
import { getTaskToastManager } from "../task-toast-manager"
import { findNearestMessageExcludingCompaction, resolvePromptContextFromSessionMessages } from "./compaction-aware-message-resolver"
import { isAbortedSessionError, isRecoverablePromptInjectionError, extractErrorMessage } from "./error-classifier"
import { join } from "node:path"
import { MESSAGE_STORAGE } from "../hook-message-injector"
import { createPromptTimeoutContext } from "../../shared/prompt-timeout-context"

export interface TaskLifecycleEvent {
  id: string
  description: string
  agent: string
  isBackground: boolean
  status?: "queued" | "running" | "completed" | "error"
  skills?: string[]
}

let batchMode = false
let pendingEvents: TaskLifecycleEvent[] = []

export function startBatch(): void {
  batchMode = true
}

export function endBatch(): void {
  batchMode = false
  const events = pendingEvents
  pendingEvents = []
  const toastManager = getTaskToastManager()
  if (!toastManager) return
  for (const event of events) {
    toastManager.addTask(event)
  }
}

function shouldQueueInBatch(): boolean {
  return batchMode
}

export function notifyTaskStarted(event: TaskLifecycleEvent): void {
  if (shouldQueueInBatch()) {
    pendingEvents.push(event)
    return
  }
  const toastManager = getTaskToastManager()
  if (!toastManager) return
  toastManager.addTask({ ...event, status: event.status ?? "running" })
}

export function notifyTaskProgress(task: BackgroundTask, event: TaskLifecycleEvent): void {
  if (shouldQueueInBatch()) {
    pendingEvents.push(event)
    return
  }
  const toastManager = getTaskToastManager()
  if (!toastManager) return
  toastManager.addTask({ ...event, status: event.status ?? "running" })
}

export function notifyTaskCompleted(task: BackgroundTask, event: TaskLifecycleEvent): void {
  if (shouldQueueInBatch()) {
    pendingEvents.push(event)
    return
  }
  const toastManager = getTaskToastManager()
  if (!toastManager) return
  toastManager.addTask({ ...event, status: "completed" })
}

export function notifyTaskFailed(task: BackgroundTask, event: TaskLifecycleEvent): void {
  if (shouldQueueInBatch()) {
    pendingEvents.push(event)
    return
  }
  const toastManager = getTaskToastManager()
  if (!toastManager) return
  toastManager.addTask({ ...event, status: "error" })
}

export function isBatchMode(): boolean {
  return batchMode
}

export interface NotifierAdapter {
  client: {
    session: {
      messages: (input: { path: { id: string } }) => Promise<unknown>
      prompt: (input: {
        path: { id: string }
        body: {
          noReply?: boolean
          agent?: string
          model?: { providerID: string; modelID: string }
          variant?: string
          tools?: Record<string, boolean | "allow" | "deny" | "ask">
          parts: Array<{ type: "text"; text: string }>
        }
      }) => Promise<unknown>
    }
  }
  directory: string
  enableParentSessionNotifications: boolean
  tasks: Map<string, BackgroundTask>
  completedTaskSummaries: Map<string, BackgroundTaskNotificationTask[]>
  pendingByParent: Map<string, Set<string>>
  pendingNotifications: Map<string, string[]>
  notificationQueueByParent: Map<string, Promise<void>>
  queuePendingNotification: (parentSessionID: string, notification: string) => void
  scheduleTaskRemoval: (taskId: string, rescheduleCount?: number) => void
  clearNotificationsForTask: (taskId: string) => void
  cleanupPendingByParent: (task: BackgroundTask) => void
  getTasksByParentSession: (sessionID: string) => BackgroundTask[]
}

export function enqueueNotificationForParent(
  adapter: NotifierAdapter,
  parentSessionID: string | undefined,
  operation: () => Promise<void>,
): Promise<void> {
  if (!parentSessionID) {
    return operation()
  }

  const previous = adapter.notificationQueueByParent.get(parentSessionID) ?? Promise.resolve()
  const cleanupQueueEntry = (): void => {
    if (adapter.notificationQueueByParent.get(parentSessionID) === current) {
      adapter.notificationQueueByParent.delete(parentSessionID)
    }
  }

  const current = previous
    .catch((error) => {
      log("[background-agent] Continuing notification queue after previous failure:", {
        parentSessionID,
        error,
      })
    })
    .then(operation)

  adapter.notificationQueueByParent.set(parentSessionID, current)

  void current.then(cleanupQueueEntry, cleanupQueueEntry)

  return current
}

/**
 * Send a task-completion receipt to the parent session.
 *
 * Receipt contract (single path, called from `BackgroundManager.tryCompleteTask`):
 *   - Caller MUST have atomically transitioned `task.status` to `completed` before
 *     invoking this function; the dedup gate lives in `tryCompleteTask` (manager.ts)
 *     so this function fires exactly once per task.
  *   - Sends `ctx.client.session.prompt({ path: { id: parentSessionID }, body })`
  *     with a 10-second timeout to inject the `<system-reminder>` notification.
 *   - When `task.status` is a failure (error / cancel / interrupt) the parent is
 *     always notified (`shouldReply = true`); for normal completions the parent
 *     is only notified when ALL of the parent's tasks are finished (`allComplete`).
 *   - Aborted-session errors and recoverable prompt errors are swallowed and the
 *     notification is queued via `queuePendingNotification` for the next
 *     `chat.message` on the parent session.
 */
export async function notifyParentSession(adapter: NotifierAdapter, task: BackgroundTask): Promise<void> {
  const duration = formatDuration(task.startedAt ?? new Date(), task.completedAt)

  log("[background-agent] notifyParentSession called for task:", task.id)

  // Show toast notification
  const toastManager = getTaskToastManager()
  if (toastManager) {
    toastManager.showCompletionToast({
      id: task.id,
      description: task.description,
      duration,
    })
  }

  if (!adapter.completedTaskSummaries.has(task.parentSessionID)) {
    adapter.completedTaskSummaries.set(task.parentSessionID, [])
  }
  adapter.completedTaskSummaries.get(task.parentSessionID)!.push({
    id: task.id,
    description: task.description,
    status: task.status,
    error: task.error,
  })

  // Update pending tracking and check if all tasks complete
  const pendingSet = adapter.pendingByParent.get(task.parentSessionID)
  let allComplete = false
  let remainingCount = 0
  if (pendingSet) {
    pendingSet.delete(task.id)
    remainingCount = pendingSet.size
    allComplete = remainingCount === 0
    if (allComplete) {
      adapter.pendingByParent.delete(task.parentSessionID)
    }
  } else {
    remainingCount = Array.from(adapter.tasks.values())
      .filter(t => t.parentSessionID === task.parentSessionID && t.id !== task.id && (t.status === "running" || t.status === "pending"))
      .length
    allComplete = remainingCount === 0
  }

  const completedTasks = allComplete
    ? (adapter.completedTaskSummaries.get(task.parentSessionID) ?? [{ id: task.id, description: task.description, status: task.status, error: task.error }])
    : []

  if (allComplete) {
    adapter.completedTaskSummaries.delete(task.parentSessionID)
  }

  const statusText = task.status === "completed"
    ? "COMPLETED"
    : task.status === "interrupt"
      ? "INTERRUPTED"
      : task.status === "error"
        ? "ERROR"
        : "CANCELLED"
  const notification = buildBackgroundTaskNotificationText({
    task,
    duration,
    statusText,
    allComplete,
    remainingCount,
    completedTasks,
  })

  let agent: string | undefined = task.parentAgent
  let model: { providerID: string; modelID: string } | undefined
  let tools: Record<string, boolean> | undefined = task.parentTools
  let promptContext: ReturnType<typeof resolvePromptContextFromSessionMessages> = null

  if (adapter.enableParentSessionNotifications) {
    try {
      const messagesResp = await adapter.client.session.messages({ path: { id: task.parentSessionID } })
      const messages = normalizeSDKResponse(messagesResp, [] as Array<{
        info?: {
          agent?: string
          model?: { providerID: string; modelID: string }
          modelID?: string
          providerID?: string
          tools?: Record<string, boolean | "allow" | "deny" | "ask">
        }
      }>)
      promptContext = resolvePromptContextFromSessionMessages(
        messages,
        task.parentSessionID,
      )
      const normalizedTools = isRecord(promptContext?.tools)
        ? normalizePromptTools(promptContext.tools)
        : undefined

      if (promptContext?.agent || promptContext?.model || normalizedTools) {
        agent = promptContext?.agent ?? task.parentAgent
        model = promptContext?.model?.providerID && promptContext.model.modelID
          ? { providerID: promptContext.model.providerID, modelID: promptContext.model.modelID }
          : undefined
        tools = normalizedTools ?? tools
      }
    } catch (error) {
      if (isAbortedSessionError(error)) {
        log("[background-agent] Parent session aborted while loading messages; using messageDir fallback:", {
          taskId: task.id,
          parentSessionID: task.parentSessionID,
        })
      }
      const messageDir = join(MESSAGE_STORAGE, task.parentSessionID)
      const currentMessage = messageDir
        ? findNearestMessageExcludingCompaction(messageDir, task.parentSessionID)
        : null
      agent = currentMessage?.agent ?? task.parentAgent
      model = currentMessage?.model?.providerID && currentMessage?.model?.modelID
        ? { providerID: currentMessage.model.providerID, modelID: currentMessage.model.modelID }
        : undefined
      tools = normalizePromptTools(currentMessage?.tools) ?? tools
    }

    const resolvedTools = resolveInheritedPromptTools(task.parentSessionID, tools)

    log("[background-agent] notifyParentSession context:", {
      taskId: task.id,
      resolvedAgent: agent,
      resolvedModel: model,
    })

    const isTaskFailure = task.status === "error" || task.status === "cancelled" || task.status === "interrupt"
    const shouldReply = allComplete || isTaskFailure

    const variant = promptContext?.model?.variant

    const session = adapter.client.session
    const promptFn = (session as unknown as Record<string, unknown>)?.prompt

    log("[background-agent] About to send notification for task:", {
      taskId: task.id,
      parentSessionID: task.parentSessionID,
      hasPrompt: typeof promptFn === "function",
    })

    try {
      if (typeof promptFn === "function") {
        const promptBody = {
          path: { id: task.parentSessionID },
          body: {
            noReply: !shouldReply,
            ...(agent !== undefined ? { agent } : {}),
            ...(model !== undefined ? { model } : {}),
            ...(variant !== undefined ? { variant } : {}),
            ...(resolvedTools ? { tools: resolvedTools } : {}),
            parts: [createInternalAgentTextPart(notification)],
          },
        }

        log("[background-agent] Calling prompt() for notification:", {
          taskId: task.id,
          parentSessionID: task.parentSessionID,
          noReply: !shouldReply,
        })

        const { signal, cleanup } = createPromptTimeoutContext({}, 10000)
        try {
          await (promptFn as (...args: unknown[]) => Promise<unknown>)({
            ...promptBody,
            signal,
          })
          log("[background-agent] Notification prompt() succeeded for task:", {
            taskId: task.id,
            allComplete,
            isTaskFailure,
            noReply: !shouldReply,
          })
        } finally {
          cleanup()
        }
      } else {
        log("[background-agent] prompt() not available on session, cannot send notification:", {
          taskId: task.id,
          parentSessionID: task.parentSessionID,
        })
      }
    } catch (error) {
      log("[background-agent] prompt() THREW for task:", {
        taskId: task.id,
        error: extractErrorMessage(error) ?? String(error),
        stack: error instanceof Error ? error.stack : undefined,
        errorName: error instanceof Error ? error.name : typeof error,
      })
      if (isAbortedSessionError(error) || isRecoverablePromptInjectionError(error)) {
        log("[background-agent] Parent session aborted while sending notification; queuing for retry:", {
          taskId: task.id,
          parentSessionID: task.parentSessionID,
          recoverable: true,
          error: extractErrorMessage(error) ?? String(error),
        })
        adapter.queuePendingNotification(task.parentSessionID, notification)
      } else {
        log("[background-agent] Failed to send notification:", {
          taskId: task.id,
          parentSessionID: task.parentSessionID,
          error: extractErrorMessage(error) ?? String(error),
          stack: error instanceof Error ? error.stack : undefined,
        })
      }
    }
  } else {
    log("[background-agent] Parent session notifications disabled, skipping prompt injection:", {
      taskId: task.id,
      parentSessionID: task.parentSessionID,
    })
  }

  if (task.status !== "running" && task.status !== "pending") {
    adapter.scheduleTaskRemoval(task.id)
  }
}
