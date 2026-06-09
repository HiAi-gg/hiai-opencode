import type { BackgroundManager } from "../../features/background-agent";

interface Event {
  type: string;
  properties?: Record<string, unknown>;
}

interface EventInput {
  event: Event;
}

interface ChatMessageInput {
  sessionID: string;
}

interface ChatMessageOutput {
  parts: Array<{ type: string; text?: string; [key: string]: unknown }>;
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
]);

/**
 * Background notification hook - sub-agent task completion receipt.
 *
 * Receipt flow (single path, dedup at `tryCompleteTask`):
 *   1. OpenCode emits `session.idle` (or other FORWARDED_EVENT_TYPES)
 *   2. This hook's `event` handler routes it to `manager.handleEvent(event)`
 *   3. Manager -> `handleSessionIdleBackgroundEvent` validates output + todos
 *   4. Manager -> `tryCompleteTask(task, source)` is the canonical completion gate
 *      - Atomic `task.status = "completed"` makes the call single-shot
 *      - Subsequent session.idle events for the same task short-circuit
 *   5. Manager -> `notifyParentSession(task)` enqueues a per-parent promise
 *   6. Manager -> `ctx.client.session.promptAsync({ path, body })` sends the
 *      `[ALL BACKGROUND TASKS COMPLETE]` (or per-task) system message to the
 *      parent session, telling the parent to use `background_output(task_id=)`
 *
 * Why no separate `session.idle` handler:
 *   An earlier revision registered a dedicated `session.idle` hook that
 *   re-emitted the event to force a notification; it was removed because
 *   re-entering the same event caused an infinite loop. The generic `event`
 *   hook with `FORWARDED_EVENT_TYPES` filtering is the correct, loop-free
 *   entry point and OpenCode does dispatch `session.idle` to it for subagent
 *   sessions.
 *
 * Cleanup:
 *   - `idleDeferralTimers` in `TaskStateStore` are cleared on task completion
 *   - `notificationQueueByParent` self-cleans after each promise resolves
 *   - `pendingByParent` and `completedTaskSummaries` are deleted on full drain
 */
export function createBackgroundNotificationHook(manager: BackgroundManager) {
  const eventHandler = async ({ event }: EventInput) => {
    if (!FORWARDED_EVENT_TYPES.has(event.type)) return;
    manager.handleEvent(event);
  };

  const chatMessageHandler = async (
    input: ChatMessageInput,
    output: ChatMessageOutput,
  ): Promise<void> => {
    manager.injectPendingNotificationsIntoChatMessage(output, input.sessionID);
  };

  return {
    "chat.message": chatMessageHandler,
    event: eventHandler,
  };
}
