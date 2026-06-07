import type { BackgroundManager } from "../../features/background-agent"

interface Event {
  type: string
  properties?: Record<string, unknown>
}

interface EventInput {
  event: Event
}

interface ChatMessageInput {
  sessionID: string
}

interface ChatMessageOutput {
  parts: Array<{ type: string; text?: string; [key: string]: unknown }>
}

const FORWARDED_EVENT_TYPES = new Set([
  "message.updated",
  "message.part.updated",
  "message.part.delta",
  "todo.updated",
  "session.idle",
  "session.error",
  "session.deleted",
  "session.status",
])

/**
 * Background notification hook - handles event routing to BackgroundManager.
 *
 * Notifications are now delivered directly via session.prompt({ noReply })
 * from the manager, so this hook only needs to handle event routing.
 *
 * FIX: Inject pending notifications on session.idle too (not just chat.message)
 * so idle LLM sessions receive task completion notifications without waiting
 * for user input.
 */
export function createBackgroundNotificationHook(manager: BackgroundManager) {
  const eventHandler = async ({ event }: EventInput) => {
    if (!FORWARDED_EVENT_TYPES.has(event.type)) return
    manager.handleEvent(event)
  }

  const chatMessageHandler = async (
    input: ChatMessageInput,
    output: ChatMessageOutput,
  ): Promise<void> => {
    manager.injectPendingNotificationsIntoChatMessage(output, input.sessionID)
  }

  const sessionIdleHandler = async (input: { sessionID?: string }): Promise<void> => {
    if (!input.sessionID) return
    const pending = manager.getTasksByParentSession(input.sessionID)
      .filter((task: { status: string }) => task.status === "completed" || task.status === "error")
    if (pending.length > 0) {
      manager.handleEvent({
        type: "session.idle",
        properties: { sessionID: input.sessionID },
      })
    }
  }

  return {
    "chat.message": chatMessageHandler,
    event: eventHandler,
    "session.idle": sessionIdleHandler,
  }
}
