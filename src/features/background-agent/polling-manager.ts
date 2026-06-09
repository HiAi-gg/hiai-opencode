import type { BackgroundTaskConfig } from "../../config/schema";
import { log, normalizeSDKResponse } from "../../shared";
import { SessionCategoryRegistry } from "../../shared/session-category-registry";
import type { ConcurrencyManager } from "./concurrency";
import { POLLING_INTERVAL_MS } from "./constants";
import { removeTaskToastTracking } from "./remove-task-toast-tracking";
import {
  MIN_SESSION_GONE_POLLS,
  verifySessionExists as verifySessionStillExists,
} from "./session-existence";
import {
  isActiveSessionStatus,
  isTerminalSessionStatus,
} from "./session-status-classifier";
import type { TaskHistory } from "./task-history";
import {
  checkAndInterruptStaleTasks,
  pruneStaleTasksAndNotifications,
} from "./task-poller";
import type { BackgroundTask, LaunchInput } from "./types";

type OpencodeClient = Parameters<
  typeof checkAndInterruptStaleTasks
>[0]["client"];

interface QueueItem {
  task: BackgroundTask;
  input: LaunchInput;
}

export interface PollingManagerAdapter {
  readonly tasks: Map<string, BackgroundTask>;
  readonly notifications: Map<string, BackgroundTask[]>;
  readonly client: OpencodeClient;
  readonly directory: string;
  readonly config?: BackgroundTaskConfig;
  readonly concurrencyManager: ConcurrencyManager;
  readonly taskHistory: TaskHistory;
  readonly queuesByKey: Map<string, QueueItem[]>;
  readonly completionTimers: Map<string, ReturnType<typeof setTimeout>>;
  readonly idleDeferralTimers: Map<string, ReturnType<typeof setTimeout>>;

  tryFallbackRetry(
    task: BackgroundTask,
    errorInfo: { name?: string; message?: string },
    source: string,
  ): Promise<boolean>;
  tryCompleteTask(task: BackgroundTask, source: string): Promise<boolean>;
  validateSessionHasOutput(sessionID: string): Promise<boolean>;
  checkSessionTodos(sessionID: string): Promise<boolean>;
  enqueueNotificationForParent(
    parentSessionID: string | undefined,
    operation: () => Promise<void>,
  ): Promise<void>;
  notifyParentSession(task: BackgroundTask): Promise<void>;
  unregisterRootDescendant(rootSessionID: string): void;
  cleanupPendingByParent(task: BackgroundTask): void;
  clearNotificationsForTask(taskId: string): void;
  scheduleTaskRemoval(taskId: string): void;
  markForNotification(task: BackgroundTask): void;
}

export class TaskPollingManager {
  private adapter: PollingManagerAdapter;
  private pollingInterval?: ReturnType<typeof setInterval>;
  private pollingInFlight = false;

  constructor(adapter: PollingManagerAdapter) {
    this.adapter = adapter;
  }

  startPolling(): void {
    if (this.pollingInterval) return;

    this.pollingInterval = setInterval(() => {
      this.pollRunningTasks();
    }, POLLING_INTERVAL_MS);
    this.pollingInterval.unref();
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
  }

  hasRunningTasks(): boolean {
    for (const task of this.adapter.tasks.values()) {
      if (task.status === "running") return true;
    }
    return false;
  }

  private async verifySessionExists(sessionID: string): Promise<boolean> {
    return verifySessionStillExists(
      this.adapter.client,
      sessionID,
      this.adapter.directory,
    );
  }

  private pruneStaleTasksAndNotifications(): void {
    pruneStaleTasksAndNotifications({
      tasks: this.adapter.tasks,
      notifications: this.adapter.notifications,
      taskTtlMs: this.adapter.config?.taskTtlMs,
      onTaskPruned: (taskId, task, errorMessage) => {
        const { adapter } = this;
        const wasPending = task.status === "pending";
        log("[background-agent] Pruning stale task:", {
          taskId,
          status: task.status,
          age: `${Math.round(
            ((wasPending ? task.queuedAt?.getTime() : task.startedAt?.getTime())
              ? Date.now() -
                (wasPending
                  ? (task.queuedAt?.getTime() ?? 0)
                  : (task.startedAt?.getTime() ?? 0))
              : 0) / 1000,
          )}s`,
        });
        task.status = "error";
        task.error = errorMessage;
        task.completedAt = new Date();
        if (!wasPending && task.rootSessionID) {
          adapter.unregisterRootDescendant(task.rootSessionID);
        }
        adapter.taskHistory.record(task.parentSessionID, {
          id: task.id,
          sessionID: task.sessionID,
          agent: task.agent,
          description: task.description,
          status: "error",
          category: task.category,
          startedAt: task.startedAt,
          completedAt: task.completedAt,
        });
        if (task.concurrencyKey) {
          adapter.concurrencyManager.release(task.concurrencyKey);
          task.concurrencyKey = undefined;
        }
        removeTaskToastTracking(task.id);
        const existingTimer = adapter.completionTimers.get(taskId);
        if (existingTimer) {
          clearTimeout(existingTimer);
          adapter.completionTimers.delete(taskId);
        }
        const idleTimer = adapter.idleDeferralTimers.get(taskId);
        if (idleTimer) {
          clearTimeout(idleTimer);
          adapter.idleDeferralTimers.delete(taskId);
        }
        if (wasPending) {
          const key = task.model
            ? `${task.model.providerID}/${task.model.modelID}`
            : task.agent;
          const queue = adapter.queuesByKey.get(key);
          if (queue) {
            const index = queue.findIndex((item) => item.task.id === taskId);
            if (index !== -1) {
              queue.splice(index, 1);
              if (queue.length === 0) {
                adapter.queuesByKey.delete(key);
              }
            }
          }
        }
        adapter.cleanupPendingByParent(task);
        adapter.markForNotification(task);
        adapter
          .enqueueNotificationForParent(task.parentSessionID, () =>
            adapter.notifyParentSession(task),
          )
          .catch((err) => {
            const errorMessage =
              err instanceof Error ? err.message : String(err);
            const errorStack = err instanceof Error ? err.stack : undefined;
            log(
              "[background-agent] Error in notifyParentSession for stale-pruned task:",
              {
                taskId: task.id,
                error: errorMessage,
                stack: errorStack,
                parentSessionID: task.parentSessionID,
              },
            );
          });
      },
    });
  }

  private async checkAndInterruptStaleTasks(
    allStatuses: Record<string, { type: string }> = {},
  ): Promise<void> {
    await checkAndInterruptStaleTasks({
      tasks: this.adapter.tasks.values(),
      client: this.adapter.client,
      directory: this.adapter.directory,
      config: this.adapter.config,
      concurrencyManager: this.adapter.concurrencyManager,
      notifyParentSession: (task) =>
        this.adapter.enqueueNotificationForParent(task.parentSessionID, () =>
          this.adapter.notifyParentSession(task),
        ),
      sessionStatuses: allStatuses,
    });
  }

  private async failCrashedTask(
    task: BackgroundTask,
    errorMessage: string,
  ): Promise<void> {
    const { adapter } = this;
    task.status = "error";
    task.error = errorMessage;
    task.completedAt = new Date();
    if (task.rootSessionID) {
      adapter.unregisterRootDescendant(task.rootSessionID);
    }
    adapter.taskHistory.record(task.parentSessionID, {
      id: task.id,
      sessionID: task.sessionID,
      agent: task.agent,
      description: task.description,
      status: "error",
      category: task.category,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
    });
    if (task.concurrencyKey) {
      adapter.concurrencyManager.release(task.concurrencyKey);
      task.concurrencyKey = undefined;
    }

    const completionTimer = adapter.completionTimers.get(task.id);
    if (completionTimer) {
      clearTimeout(completionTimer);
      adapter.completionTimers.delete(task.id);
    }
    const idleTimer = adapter.idleDeferralTimers.get(task.id);
    if (idleTimer) {
      clearTimeout(idleTimer);
      adapter.idleDeferralTimers.delete(task.id);
    }

    adapter.cleanupPendingByParent(task);
    adapter.clearNotificationsForTask(task.id);
    removeTaskToastTracking(task.id);
    adapter.scheduleTaskRemoval(task.id);
    if (task.sessionID) {
      SessionCategoryRegistry.remove(task.sessionID);
    }

    adapter.markForNotification(task);
    adapter
      .enqueueNotificationForParent(task.parentSessionID, () =>
        adapter.notifyParentSession(task),
      )
      .catch((err) => {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const errorStack = err instanceof Error ? err.stack : undefined;
        log(
          "[background-agent] Error in notifyParentSession for crashed task:",
          {
            taskId: task.id,
            error: errorMessage,
            stack: errorStack,
            parentSessionID: task.parentSessionID,
          },
        );
      });
  }

  private async pollRunningTasks(): Promise<void> {
    if (this.pollingInFlight) return;
    this.pollingInFlight = true;
    try {
      this.pruneStaleTasksAndNotifications();

      const statusResult = await this.adapter.client.session.status();
      const allStatuses = normalizeSDKResponse(
        statusResult,
        {} as Record<string, { type: string }>,
      );

      await this.checkAndInterruptStaleTasks(allStatuses);

      for (const task of this.adapter.tasks.values()) {
        if (task.status !== "running") continue;

        const sessionID = task.sessionID;
        if (!sessionID) continue;

        try {
          const sessionStatus = allStatuses[sessionID];
          // Handle retry before checking running state
          if (sessionStatus?.type === "retry") {
            const retryMessage =
              typeof (sessionStatus as { message?: string }).message ===
              "string"
                ? (sessionStatus as { message?: string }).message
                : undefined;
            const errorInfo = { name: "SessionRetry", message: retryMessage };
            if (
              await this.adapter.tryFallbackRetry(
                task,
                errorInfo,
                "polling:session.status",
              )
            ) {
              continue;
            }
          }

          // Only skip completion when session status is actively running.
          // Unknown or terminal statuses (like "interrupted") fall through to completion.
          if (sessionStatus && isActiveSessionStatus(sessionStatus.type)) {
            log(
              "[background-agent] Session still running, relying on event-based progress:",
              {
                taskId: task.id,
                sessionID,
                sessionStatus: sessionStatus.type,
                toolCalls: task.progress?.toolCalls ?? 0,
              },
            );
            continue;
          }

          if (sessionStatus && isTerminalSessionStatus(sessionStatus.type)) {
            log(
              "[background-agent] Calling tryCompleteTask from polling-manager (terminal):",
              { taskId: task.id, sessionStatus: sessionStatus.type },
            );
            await this.adapter.tryCompleteTask(
              task,
              `polling (terminal session status: ${sessionStatus.type})`,
            );
            continue;
          }

          if (sessionStatus && sessionStatus.type !== "idle") {
            log(
              "[background-agent] Unknown session status, treating as potentially idle:",
              {
                taskId: task.id,
                sessionID,
                sessionStatus: sessionStatus.type,
              },
            );
          }

          // Session is idle or no longer in status response (completed/disappeared)
          const sessionGoneFromStatus = !sessionStatus;
          const sessionGoneThresholdReached =
            sessionGoneFromStatus &&
            (task.consecutiveMissedPolls ?? 0) >= MIN_SESSION_GONE_POLLS;
          const completionSource =
            sessionStatus?.type === "idle"
              ? "polling (idle status)"
              : "polling (session gone from status)";
          const hasValidOutput =
            await this.adapter.validateSessionHasOutput(sessionID);
          if (!hasValidOutput) {
            if (sessionGoneThresholdReached) {
              const sessionExists = await this.verifySessionExists(sessionID);
              if (!sessionExists) {
                log(
                  "[background-agent] Session no longer exists (crashed), marking task as error:",
                  task.id,
                );
                await this.failCrashedTask(
                  task,
                  "Subagent session no longer exists (process likely crashed). The session disappeared without producing any output.",
                );
                continue;
              }

              task.consecutiveMissedPolls = 0;
            }
            log(
              "[background-agent] Polling idle/gone but no valid output yet, waiting:",
              task.id,
            );
            continue;
          }

          // Re-check status after async operation
          if (task.status !== "running") continue;

          const hasIncompleteTodos =
            await this.adapter.checkSessionTodos(sessionID);
          if (hasIncompleteTodos) {
            log(
              "[background-agent] Task has incomplete todos via polling, waiting:",
              task.id,
            );
            continue;
          }

          log(
            "[background-agent] Calling tryCompleteTask from polling-manager (idle/gone):",
            { taskId: task.id, source: completionSource },
          );
          await this.adapter.tryCompleteTask(task, completionSource);
        } catch (error) {
          log("[background-agent] Poll error for task:", {
            taskId: task.id,
            error,
          });
        }
      }

      if (!this.hasRunningTasks()) {
        this.stopPolling();
      }
    } finally {
      this.pollingInFlight = false;
    }
  }
}
