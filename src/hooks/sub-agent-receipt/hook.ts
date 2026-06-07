import type { BackgroundManager } from "../../features/background-agent"

interface Event {
  type: string
  properties?: Record<string, unknown>
}

interface EventInput {
  event: Event
}

export function createSubAgentReceiptHook(manager: BackgroundManager) {
  let pollTimer: ReturnType<typeof setInterval> | null = null
  const notifiedTasks = new Set<string>()
  let isDisposed = false

  const POLL_INTERVAL_MS = 5000

  function startPolling(): void {
    if (pollTimer || isDisposed) return

    pollTimer = setInterval(() => {
      if (isDisposed) {
        stopPolling()
        return
      }

      const tasks = manager.getRunningTasks()

      if (tasks.length === 0) {
        const nonRunning = manager.getNonRunningTasks()
        for (const task of nonRunning) {
          if (notifiedTasks.has(task.id)) continue
          if (task.status === "completed" || task.status === "error" || task.status === "cancelled" || task.status === "interrupt") {
            notifiedTasks.add(task.id)
            manager.sendReceiptNotification(task).catch(() => {
              // Task may have already been cleaned up; ignore
            })
          }
        }

        if (nonRunning.length === 0) {
          stopPolling()
        }
      }
    }, POLL_INTERVAL_MS)
  }

  function stopPolling(): void {
    if (pollTimer) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }

  const eventHandler = async ({ event }: EventInput) => {
    if (event.type === "session.created") {
      startPolling()
    } else if (event.type === "session.deleted") {
      const tasks = manager.getRunningTasks()
      if (tasks.length === 0) {
        stopPolling()
      }
    }
  }

  return {
    event: eventHandler,
    dispose: () => {
      isDisposed = true
      stopPolling()
      notifiedTasks.clear()
    },
  }
}
