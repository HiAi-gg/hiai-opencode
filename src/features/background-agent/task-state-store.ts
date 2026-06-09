import type { BackgroundTask, LaunchInput } from "./types";
import type { QueueItem } from "./constants";
import type { BackgroundTaskNotificationTask } from "./background-task-notification-template";
import { log } from "../../shared";
import { subagentSessions } from "../claude-code-session-state";

export class TaskStateStore {
  readonly tasks: Map<string, BackgroundTask> = new Map();
  readonly notifications: Map<string, BackgroundTask[]> = new Map();
  readonly pendingNotifications: Map<string, string[]> = new Map();
  readonly pendingByParent: Map<string, Set<string>> = new Map();
  readonly queuesByKey: Map<string, QueueItem[]> = new Map();
  readonly processingKeys: Set<string> = new Set();
  readonly completionTimers: Map<string, ReturnType<typeof setTimeout>> =
    new Map();
  readonly completedTaskSummaries: Map<
    string,
    BackgroundTaskNotificationTask[]
  > = new Map();
  readonly idleDeferralTimers: Map<string, ReturnType<typeof setTimeout>> =
    new Map();
  readonly notificationQueueByParent: Map<string, Promise<void>> = new Map();
  readonly observedOutputSessions: Set<string> = new Set();
  readonly observedIncompleteTodosBySession: Map<string, boolean> = new Map();
  readonly rootDescendantCounts: Map<string, number> = new Map();
  readonly preStartDescendantReservations: Set<string> = new Set();

  getTask(id: string): BackgroundTask | undefined {
    return this.tasks.get(id);
  }

  setTask(id: string, task: BackgroundTask): void {
    this.tasks.set(id, task);
  }

  deleteTask(id: string): void {
    const task = this.tasks.get(id);
    if (task?.sessionID) {
      subagentSessions.delete(task.sessionID);
    }
    this.tasks.delete(id);
  }

  getAllTasks(): BackgroundTask[] {
    return Array.from(this.tasks.values());
  }

  findBySession(sessionID: string): BackgroundTask | undefined {
    for (const task of this.tasks.values()) {
      if (task.sessionID === sessionID) {
        return task;
      }
    }
    return undefined;
  }

  getTasksByParentSession(sessionID: string): BackgroundTask[] {
    const result: BackgroundTask[] = [];
    for (const task of this.tasks.values()) {
      if (task.parentSessionID === sessionID) {
        result.push(task);
      }
    }
    return result;
  }

  getAllDescendantTasks(sessionID: string): BackgroundTask[] {
    const result: BackgroundTask[] = [];
    const directChildren = this.getTasksByParentSession(sessionID);

    for (const child of directChildren) {
      result.push(child);
      if (child.sessionID) {
        const descendants = this.getAllDescendantTasks(child.sessionID);
        result.push(...descendants);
      }
    }

    return result;
  }

  getRunningTasks(): BackgroundTask[] {
    return Array.from(this.tasks.values()).filter(
      (t) => t.status === "running",
    );
  }

  getNonRunningTasks(): BackgroundTask[] {
    return Array.from(this.tasks.values()).filter(
      (t) => t.status !== "running",
    );
  }

  hasRunningTasks(): boolean {
    for (const task of this.tasks.values()) {
      if (task.status === "running") return true;
    }
    return false;
  }

  getConcurrencyKeyFromInput(input: LaunchInput): string {
    if (input.model) {
      return `${input.model.providerID}/${input.model.modelID}`;
    }
    return input.agent;
  }

  getConcurrencyKeyFromTask(task: BackgroundTask): string {
    if (task.model) {
      return `${task.model.providerID}/${task.model.modelID}`;
    }
    return task.agent;
  }

  addTask(task: BackgroundTask): void {
    this.tasks.set(task.id, task);
  }

  trackPendingTask(parentSessionID: string, taskId: string): void {
    const pending = this.pendingByParent.get(parentSessionID) ?? new Set();
    pending.add(taskId);
    this.pendingByParent.set(parentSessionID, pending);
  }

  cleanupPendingByParent(task: BackgroundTask): void {
    if (!task.parentSessionID) return;
    const pending = this.pendingByParent.get(task.parentSessionID);
    if (pending) {
      pending.delete(task.id);
      if (pending.size === 0) {
        this.pendingByParent.delete(task.parentSessionID);
      }
    }
  }

  getPendingByParent(parentSessionID: string): Set<string> | undefined {
    return this.pendingByParent.get(parentSessionID);
  }

  markForNotification(task: BackgroundTask): void {
    const queue = this.notifications.get(task.parentSessionID) ?? [];
    queue.push(task);
    this.notifications.set(task.parentSessionID, queue);
  }

  getPendingNotifications(sessionID: string): BackgroundTask[] {
    return this.notifications.get(sessionID) ?? [];
  }

  clearNotifications(sessionID: string): void {
    this.notifications.delete(sessionID);
  }

  clearNotificationsForTask(taskId: string): void {
    for (const [sessionID, tasks] of this.notifications.entries()) {
      const filtered = tasks.filter((t) => t.id !== taskId);
      if (filtered.length === 0) {
        this.notifications.delete(sessionID);
      } else {
        this.notifications.set(sessionID, filtered);
      }
    }
  }

  addToQueue(key: string, item: QueueItem): void {
    const queue = this.queuesByKey.get(key) ?? [];
    queue.push(item);
    this.queuesByKey.set(key, queue);
  }

  getQueue(key: string): QueueItem[] | undefined {
    return this.queuesByKey.get(key);
  }

  removeFromQueue(key: string, taskId: string): boolean {
    const queue = this.queuesByKey.get(key);
    if (!queue) return false;

    const index = queue.findIndex((item) => item.task.id === taskId);
    if (index === -1) return false;

    queue.splice(index, 1);
    if (queue.length === 0) {
      this.queuesByKey.delete(key);
    }
    return true;
  }

  setCompletionTimer(
    taskId: string,
    timer: ReturnType<typeof setTimeout>,
  ): void {
    this.completionTimers.set(taskId, timer);
  }

  clearCompletionTimer(taskId: string): void {
    const timer = this.completionTimers.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.completionTimers.delete(taskId);
    }
  }

  clearAllCompletionTimers(): void {
    for (const timer of this.completionTimers.values()) {
      clearTimeout(timer);
    }
    this.completionTimers.clear();
  }

  setIdleDeferralTimer(
    taskId: string,
    timer: ReturnType<typeof setTimeout>,
  ): void {
    this.idleDeferralTimers.set(taskId, timer);
  }

  clearIdleDeferralTimer(taskId: string): void {
    const timer = this.idleDeferralTimers.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.idleDeferralTimers.delete(taskId);
    }
  }

  clearAllIdleDeferralTimers(): void {
    for (const timer of this.idleDeferralTimers.values()) {
      clearTimeout(timer);
    }
    this.idleDeferralTimers.clear();
  }

  getRootDescendantCount(rootSessionID: string): number {
    return this.rootDescendantCounts.get(rootSessionID) ?? 0;
  }

  incrementRootDescendantCount(rootSessionID: string): number {
    const nextCount = this.getRootDescendantCount(rootSessionID) + 1;
    this.rootDescendantCounts.set(rootSessionID, nextCount);
    return nextCount;
  }

  decrementRootDescendantCount(rootSessionID: string): void {
    const currentCount = this.getRootDescendantCount(rootSessionID);
    if (currentCount <= 1) {
      this.rootDescendantCounts.delete(rootSessionID);
    } else {
      this.rootDescendantCounts.set(rootSessionID, currentCount - 1);
    }
  }

  addPreStartReservation(taskId: string): void {
    this.preStartDescendantReservations.add(taskId);
  }

  removePreStartReservation(taskId: string): boolean {
    return this.preStartDescendantReservations.delete(taskId);
  }

  hasPreStartReservation(taskId: string): boolean {
    return this.preStartDescendantReservations.has(taskId);
  }

  getPendingNotificationList(sessionID: string): string[] | undefined {
    return this.pendingNotifications.get(sessionID);
  }

  setPendingNotificationList(sessionID: string, list: string[]): void {
    this.pendingNotifications.set(sessionID, list);
  }

  deletePendingNotificationList(sessionID: string): void {
    this.pendingNotifications.delete(sessionID);
  }

  getCompletedTaskSummaries(
    sessionID: string,
  ): BackgroundTaskNotificationTask[] | undefined {
    return this.completedTaskSummaries.get(sessionID);
  }

  setCompletedTaskSummaries(
    sessionID: string,
    summaries: BackgroundTaskNotificationTask[],
  ): void {
    this.completedTaskSummaries.set(sessionID, summaries);
  }

  getNotificationQueue(parentSessionID: string): Promise<void> | undefined {
    return this.notificationQueueByParent.get(parentSessionID);
  }

  setNotificationQueue(parentSessionID: string, promise: Promise<void>): void {
    this.notificationQueueByParent.set(parentSessionID, promise);
  }

  observeOutputSession(sessionID: string): void {
    this.observedOutputSessions.add(sessionID);
  }

  unobserveOutputSession(sessionID: string): void {
    this.observedOutputSessions.delete(sessionID);
  }

  hasObservedOutputSession(sessionID: string): boolean {
    return this.observedOutputSessions.has(sessionID);
  }

  getObservedIncompleteTodos(sessionID: string): boolean | undefined {
    return this.observedIncompleteTodosBySession.get(sessionID);
  }

  setObservedIncompleteTodos(sessionID: string, value: boolean): void {
    this.observedIncompleteTodosBySession.set(sessionID, value);
  }

  deleteObservedIncompleteTodos(sessionID: string): void {
    this.observedIncompleteTodosBySession.delete(sessionID);
  }

  clear(): void {
    this.clearAllCompletionTimers();
    this.clearAllIdleDeferralTimers();
    this.tasks.clear();
    this.notifications.clear();
    this.pendingNotifications.clear();
    this.pendingByParent.clear();
    this.queuesByKey.clear();
    this.processingKeys.clear();
    this.completedTaskSummaries.clear();
    this.notificationQueueByParent.clear();
    this.observedOutputSessions.clear();
    this.observedIncompleteTodosBySession.clear();
    this.rootDescendantCounts.clear();
    this.preStartDescendantReservations.clear();
  }

  cancelPendingTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== "pending") {
      return false;
    }

    const key = this.getConcurrencyKeyFromTask(task);
    this.removeFromQueue(key, taskId);

    task.status = "cancelled";
    task.completedAt = new Date();

    this.cleanupPendingByParent(task);

    log("[background-agent] Cancelled pending task:", { taskId, key });
    return true;
  }
}
