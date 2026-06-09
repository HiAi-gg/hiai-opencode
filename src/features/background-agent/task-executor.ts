import type { BackgroundTask, LaunchInput } from "./types.js";
import type { QueueItem } from "./manager-types.js";
import type { TaskStateStore } from "./task-state-store.js";
import type { ConcurrencyManager } from "./concurrency.js";
import type { PluginInput } from "@opencode-ai/plugin";
import {
  log,
  getAgentToolRestrictions,
  createInternalAgentTextPart,
  promptWithModelSuggestionRetry,
} from "../../shared";
import { setSessionTools } from "../../shared/session-tools-store.js";
import { applySessionPromptParams } from "../../shared/session-prompt-params-helpers.js";
import {
  isAgentNotFoundError,
  FALLBACK_AGENT,
  buildFallbackBody,
} from "./spawner";
import { subagentSessions } from "../claude-code-session-state";
import { getTaskToastManager } from "../task-toast-manager";
import { isInsideTmux } from "../../shared/tmux";
import type { OnSubagentSessionCreated } from "./manager-types";
import { removeTaskToastTracking } from "./remove-task-toast-tracking";
import { abortWithTimeout } from "./abort-with-timeout";
import type { TaskHistory } from "./task-history";

type OpencodeClient = PluginInput["client"];

export interface TaskExecutorDeps {
  client: OpencodeClient;
  directory: string;
  state: TaskStateStore;
  concurrencyManager: ConcurrencyManager;
  taskHistory: TaskHistory;
  tmuxEnabled: boolean;
  onSubagentSessionCreated?: OnSubagentSessionCreated;
}

export class TaskExecutor {
  constructor(private readonly deps: TaskExecutorDeps) {}

  private get client() {
    return this.deps.client;
  }
  private get directory() {
    return this.deps.directory;
  }
  private get state() {
    return this.deps.state;
  }
  private get concurrencyManager() {
    return this.deps.concurrencyManager;
  }
  private get taskHistory() {
    return this.deps.taskHistory;
  }
  private get tmuxEnabled() {
    return this.deps.tmuxEnabled;
  }
  private get onSubagentSessionCreated() {
    return this.deps.onSubagentSessionCreated;
  }

  async processKey(key: string): Promise<void> {
    if (this.state.processingKeys.has(key)) {
      return;
    }

    this.state.processingKeys.add(key);

    try {
      const queue = this.state.queuesByKey.get(key);
      while (queue && queue.length > 0) {
        const item = queue.shift();
        if (!item) {
          continue;
        }

        await this.concurrencyManager.acquire(key);

        if (
          item.task.status === "cancelled" ||
          item.task.status === "error" ||
          item.task.status === "interrupt"
        ) {
          this.rollbackPreStartDescendantReservation(item.task);
          this.concurrencyManager.release(key);
          continue;
        }

        try {
          await this.startTask(item);
        } catch (error) {
          log("[background-agent] Error starting task:", error);
          this.rollbackPreStartDescendantReservation(item.task);

          item.task.status = "error";
          item.task.error =
            error instanceof Error ? error.message : String(error);
          item.task.completedAt = new Date();

          if (item.task.concurrencyKey) {
            this.concurrencyManager.release(item.task.concurrencyKey);
            item.task.concurrencyKey = undefined;
          } else {
            this.concurrencyManager.release(key);
          }

          removeTaskToastTracking(item.task.id);

          if (item.task.sessionID) {
            await this.abortSessionWithLogging(
              item.task.sessionID,
              "startTask error cleanup",
            );
          }

          this.markForNotification(item.task);
        }
      }
    } finally {
      this.state.processingKeys.delete(key);
    }
  }

  private async startTask(item: QueueItem): Promise<void> {
    const { task, input } = item;

    log("[background-agent] Starting task:", {
      taskId: task.id,
      agent: input.agent,
      model: input.model,
    });

    const concurrencyKey = this.getConcurrencyKeyFromInput(input);

    const parentSession = await this.client.session
      .get({
        path: { id: input.parentSessionID },
        query: { directory: this.directory },
      })
      .catch((err) => {
        log(`[background-agent] Failed to get parent session: ${err}`);
        return null;
      });
    const parentDirectory = parentSession?.data?.directory ?? this.directory;
    log(
      `[background-agent] Parent dir: ${parentSession?.data?.directory}, using: ${parentDirectory}`,
    );

    const createResult = await this.client.session.create({
      body: {
        parentID: input.parentSessionID,
        title: `${input.description} (@${input.agent} subagent)`,
        ...(input.sessionPermission
          ? { permission: input.sessionPermission }
          : {}),
      } as Record<string, unknown>,
      query: {
        directory: parentDirectory,
      },
    });

    if (createResult.error) {
      throw new Error(
        `Failed to create background session: ${createResult.error}`,
      );
    }

    if (!createResult.data?.id) {
      throw new Error(
        "Failed to create background session: API returned no session ID",
      );
    }

    const sessionID = createResult.data.id;

    if (task.status === "cancelled") {
      await this.abortSessionWithLogging(
        sessionID,
        "cancelled pre-start cleanup",
      );
      this.concurrencyManager.release(concurrencyKey);
      return;
    }

    this.settlePreStartDescendantReservation(task);
    subagentSessions.add(sessionID);

    if (this.onSubagentSessionCreated && this.tmuxEnabled && isInsideTmux()) {
      log("[background-agent] Invoking tmux callback NOW", { sessionID });
      await this.onSubagentSessionCreated({
        sessionID,
        parentID: input.parentSessionID,
        title: input.description,
      }).catch((err) => {
        log("[background-agent] Failed to spawn tmux pane:", err);
      });
      log("[background-agent] tmux callback completed, waiting 200ms");
      await new Promise((r) => setTimeout(r, 200));
    }

    if (this.state.tasks.get(task.id)?.status === "cancelled") {
      await this.abortSessionWithLogging(
        sessionID,
        "cancelled during tmux setup",
      );
      subagentSessions.delete(sessionID);
      if (task.rootSessionID) {
        this.unregisterRootDescendant(task.rootSessionID);
      }
      this.concurrencyManager.release(concurrencyKey);
      return;
    }

    task.status = "running";
    task.startedAt = new Date();
    task.sessionID = sessionID;
    task.progress = {
      toolCalls: 0,
      lastUpdate: new Date(),
    };
    task.concurrencyKey = concurrencyKey;
    task.concurrencyGroup = concurrencyKey;

    this.taskHistory.record(input.parentSessionID, {
      id: task.id,
      sessionID,
      agent: input.agent,
      description: input.description,
      status: "running",
      category: input.category,
      startedAt: task.startedAt,
    });

    log("[background-agent] Launching task:", {
      taskId: task.id,
      sessionID,
      agent: input.agent,
    });

    const toastManager = getTaskToastManager();
    if (toastManager) {
      toastManager.updateTask(task.id, "running");
    }

    const launchModel = input.model
      ? {
          providerID: input.model.providerID,
          modelID: input.model.modelID,
        }
      : undefined;
    const launchVariant = input.model?.variant;

    if (input.model) {
      applySessionPromptParams(sessionID, input.model);
    }

    const promptBody = {
      agent: input.agent,
      ...(launchModel ? { model: launchModel } : {}),
      ...(launchVariant ? { variant: launchVariant } : {}),
      system: input.skillContent,
      tools: (() => {
        const tools = {
          task: false,
          call_hiai_agent: true,
          question: false,
          ...getAgentToolRestrictions(input.agent),
        };
        setSessionTools(sessionID, tools);
        return tools;
      })(),
      parts: [createInternalAgentTextPart(input.prompt)],
    };

    promptWithModelSuggestionRetry(this.client, {
      path: { id: sessionID },
      body: promptBody,
    }).catch(async (error) => {
      if (isAgentNotFoundError(error) && input.agent !== FALLBACK_AGENT) {
        log(
          "[background-agent] Agent not found, retrying with fallback agent",
          {
            original: input.agent,
            fallback: FALLBACK_AGENT,
            taskId: task.id,
          },
        );
        try {
          const fallbackBody = buildFallbackBody(promptBody, FALLBACK_AGENT);
          setSessionTools(
            sessionID,
            fallbackBody.tools as Record<string, boolean>,
          );
          await promptWithModelSuggestionRetry(this.client, {
            path: { id: sessionID },
            body: fallbackBody,
          });
          task.agent = FALLBACK_AGENT;
          return;
        } catch (retryError) {
          log("[background-agent] Fallback agent also failed:", retryError);
        }
      }

      log("[background-agent] promptAsync error:", error);
      const existingTask = this.findBySession(sessionID);
      if (existingTask) {
        existingTask.status = "interrupt";
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (
          errorMessage.includes("agent.name") ||
          errorMessage.includes("undefined") ||
          isAgentNotFoundError(error)
        ) {
          existingTask.error = `Agent "${input.agent}" not found. Make sure the agent is registered in your opencode.json or provided by a plugin.`;
        } else {
          existingTask.error = errorMessage;
        }
        existingTask.completedAt = new Date();
        if (existingTask.rootSessionID) {
          this.unregisterRootDescendant(existingTask.rootSessionID);
        }
        if (existingTask.concurrencyKey) {
          this.concurrencyManager.release(existingTask.concurrencyKey);
          existingTask.concurrencyKey = undefined;
        }

        removeTaskToastTracking(existingTask.id);
        await this.abortSessionWithLogging(sessionID, "launch error cleanup");
        this.markForNotification(existingTask);
      }
    });
  }

  private getConcurrencyKeyFromInput(input: LaunchInput): string {
    if (input.model) {
      return `${input.model.providerID}/${input.model.modelID}`;
    }
    return input.agent;
  }

  private async abortSessionWithLogging(
    sessionID: string,
    reason: string,
  ): Promise<void> {
    try {
      await abortWithTimeout(this.client, sessionID);
    } catch (error) {
      log(
        `[background-agent] abortSessionWithLogging failed (${reason}):`,
        error,
      );
    }
  }

  private findBySession(sessionID: string): BackgroundTask | undefined {
    for (const task of this.state.tasks.values()) {
      if (task.sessionID === sessionID) {
        return task;
      }
    }
    return undefined;
  }

  private rollbackPreStartDescendantReservation(task: BackgroundTask): void {
    if (task.rootSessionID) {
      if (this.state.preStartDescendantReservations.has(task.id)) {
        const count =
          this.state.rootDescendantCounts.get(task.rootSessionID) ?? 0;
        if (count > 0) {
          this.state.rootDescendantCounts.set(task.rootSessionID, count - 1);
        }
        this.state.preStartDescendantReservations.delete(task.id);
      }
    }
  }

  private settlePreStartDescendantReservation(task: BackgroundTask): void {
    if (task.rootSessionID) {
      this.state.preStartDescendantReservations.delete(task.id);
    }
  }

  private unregisterRootDescendant(rootSessionID: string): void {
    const count = this.state.rootDescendantCounts.get(rootSessionID) ?? 0;
    if (count > 0) {
      this.state.rootDescendantCounts.set(rootSessionID, count - 1);
    }
  }

  private markForNotification(task: BackgroundTask): void {
    this.state.markForNotification(task);
  }
}
