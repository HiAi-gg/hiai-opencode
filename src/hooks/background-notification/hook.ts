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
 * FIX: Register session.idle as a separate hook so OpenCode can dispatch
 * idle events to us. The eventHandler already routes session.idle through
 * manager.handleEvent, which then triggers notifyParentSession → promptAsync.
 * Without this separate registration, the plugin may not receive session.idle
 * for subagent sessions.
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

  return {
    "chat.message": chatMessageHandler,
    event: eventHandler,
  }
}
