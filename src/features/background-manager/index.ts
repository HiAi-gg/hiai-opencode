import type { PluginInput } from "@opencode-ai/plugin";

interface ToolCallWindow {
  lastSignature: string;
  consecutiveCount: number;
  threshold: number;
}

interface TaskProgress {
  toolCalls: number;
  lastTool?: string;
  toolCallWindow?: ToolCallWindow;
  lastUpdate: Date;
}

export interface BackgroundTask {
  id: string;
  sessionID: string;
  parentSessionID: string;
  status: "running" | "completed" | "error" | "cancelled";
  description: string;
  result?: string;
  error?: string;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  progress?: TaskProgress;
}

function sortObject(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sortObject);
  return Object.keys(obj as Record<string, unknown>)
    .sort()
    .reduce(
      (acc, key) => {
        (acc as Record<string, unknown>)[key] = sortObject(
          (obj as Record<string, unknown>)[key],
        );
        return acc;
      },
      {} as Record<string, unknown>,
    );
}

function createToolCallSignature(
  toolName: string,
  toolInput?: Record<string, unknown>,
): string {
  if (
    !toolInput ||
    (typeof toolInput === "object" && Object.keys(toolInput).length === 0)
  )
    return toolName;
  return `${toolName}::${JSON.stringify(sortObject(toolInput))}`;
}

function recordToolCallCheck(
  window: ToolCallWindow | undefined,
  signature: string,
  threshold: number,
): ToolCallWindow {
  if (!window || window.lastSignature !== signature) {
    return { lastSignature: signature, consecutiveCount: 1, threshold };
  }
  return { ...window, consecutiveCount: window.consecutiveCount + 1 };
}

function detectRepetitiveToolUse(window: ToolCallWindow): {
  triggered: boolean;
  tool?: string;
  count?: number;
} {
  if (!window || window.consecutiveCount < window.threshold)
    return { triggered: false };
  const tool = window.lastSignature.split("::")[0];
  return { triggered: true, tool, count: window.consecutiveCount };
}

/**
 * Sanitize raw subagent result for parent notification.
 * Strips:
 * - Raw <CLOSURE>...</CLOSURE> blocks
 * - Result Envelope labels (**Status:**, **Summary:**, **Evidence:**, **Files touched:**)
 * - Any Caveman protocol scaffolding
 * Preserves: task description, useful deliverable content, evidence paths.
 */
export function formatBackgroundResultForParent(raw: string): string {
  if (!raw) return "No output";

  let text = raw;

  // 1. Strip <CLOSURE>...</CLOSURE> blocks entirely
  text = text.replace(/<CLOSURE>[\s\S]*?<\/CLOSURE>/gi, "");

  // 2. Strip Result Envelope labels and their line content
  // These patterns match the full line containing the label
  text = text.replace(/\*\*Status:\*\*[^\n]*/gi, "");
  text = text.replace(/\*\*Summary:\*\*[^\n]*/gi, "");
  text = text.replace(/\*\*Evidence:\*\*[^\n]*/gi, "");
  text = text.replace(/\*\*Files touched:\*\*[^\n]*/gi, "");

  // 3. Strip any remaining <CLOSURE_PROTOCOL>...</CLOSURE_PROTOCOL> blocks
  text = text.replace(/<CLOSURE_PROTOCOL>[\s\S]*?<\/CLOSURE_PROTOCOL>/gi, "");

  // 4. Clean up multiple blank lines resulting from removals
  text = text.replace(/\n{3,}/g, "\n\n");

  // 5. Trim whitespace
  text = text.trim();

  // 6. Length guard — truncate to a reasonable notification size
  const MAX_LEN = 2000;
  if (text.length > MAX_LEN) {
    text = `${text.slice(0, MAX_LEN)}\n... (truncated)`;
  }

  return text || "No output";
}

export class BackgroundManager {
  private tasks = new Map<string, BackgroundTask>();
  private client: PluginInput["client"] | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private concurrencyLimit = 5;
  private runningCount = 0;
  private staleTimeoutMs = 45 * 60 * 1000; // 45 min
  private circuitBreaker = {
    enabled: true,
    maxToolCalls: 4000,
    consecutiveThreshold: 20,
  };
  private maxDescendants = 50;
  private rootDescendantCounts = new Map<string, number>();

  constructor(config?: {
    concurrency_limit?: number;
    stale_timeout_ms?: number;
    circuit_breaker?: {
      enabled?: boolean;
      max_tool_calls?: number;
      consecutive_threshold?: number;
    };
  }) {
    if (
      config?.concurrency_limit !== undefined &&
      config.concurrency_limit < 1
    ) {
      throw new Error(
        `concurrency_limit must be >= 1, got ${config.concurrency_limit}`,
      );
    }
    if (config?.concurrency_limit)
      this.concurrencyLimit = config.concurrency_limit;
    if (config?.stale_timeout_ms) this.staleTimeoutMs = config.stale_timeout_ms;
    if (config?.circuit_breaker) {
      this.circuitBreaker = {
        ...this.circuitBreaker,
        ...(config.circuit_breaker.enabled !== undefined && {
          enabled: config.circuit_breaker.enabled,
        }),
        ...(config.circuit_breaker.max_tool_calls !== undefined && {
          maxToolCalls: config.circuit_breaker.max_tool_calls,
        }),
        ...(config.circuit_breaker.consecutive_threshold !== undefined && {
          consecutiveThreshold: config.circuit_breaker.consecutive_threshold,
        }),
      };
    }
  }

  setClient(client: PluginInput["client"]) {
    this.client = client;
    this.startPolling();
    this.startCleanup();
  }

  checkSpawnLimits(parentSessionID: string): boolean {
    const count = this.rootDescendantCounts.get(parentSessionID) ?? 0;
    if (count >= this.maxDescendants) {
      console.log(
        `[hiai-opencode] Spawn limit: ${count} descendants for ${parentSessionID}`,
      );
      return false;
    }
    this.rootDescendantCounts.set(parentSessionID, count + 1);
    return true;
  }

  launch(input: {
    sessionID: string;
    parentSessionID: string;
    description: string;
  }): BackgroundTask {
    if (this.runningCount >= this.concurrencyLimit) {
      throw new Error(
        `Concurrency limit reached (${this.concurrencyLimit}). Wait for existing tasks to complete.`,
      );
    }

    const task: BackgroundTask = {
      id: `bg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      sessionID: input.sessionID,
      parentSessionID: input.parentSessionID,
      status: "running",
      description: input.description,
      createdAt: Date.now(),
      startedAt: Date.now(),
    };

    if (!this.checkSpawnLimits(input.parentSessionID)) {
      throw new Error(
        `Spawn limit reached for session ${input.parentSessionID}`,
      );
    }

    task.progress = { toolCalls: 0, lastUpdate: new Date() };
    this.tasks.set(task.id, task);
    this.runningCount++;
    return task;
  }

  getTask(id: string): BackgroundTask | undefined {
    return this.tasks.get(id);
  }

  recordToolCall(
    taskId: string,
    toolName: string,
    toolInput?: Record<string, unknown>,
  ) {
    if (!this.circuitBreaker.enabled) return;
    const task = this.tasks.get(taskId);
    if (!task?.progress) return;

    task.progress.toolCalls++;
    task.progress.lastUpdate = new Date();
    task.progress.lastTool = toolName;

    const sig = createToolCallSignature(toolName, toolInput);
    task.progress.toolCallWindow = recordToolCallCheck(
      task.progress.toolCallWindow,
      sig,
      this.circuitBreaker.consecutiveThreshold,
    );

    const check = detectRepetitiveToolUse(task.progress.toolCallWindow);
    if (check.triggered) {
      this.cancel(
        taskId,
        `Circuit breaker: ${check.count} consecutive ${check.tool} calls`,
      );
      return;
    }

    if (task.progress.toolCalls >= this.circuitBreaker.maxToolCalls) {
      this.cancel(
        taskId,
        `Circuit breaker: ${task.progress.toolCalls} total tool calls`,
      );
    }
  }

  cancel(id: string, reason?: string): boolean {
    const task = this.tasks.get(id);
    if (!task) return false;
    const wasRunning = task.status === "running";
    task.status = "cancelled";
    task.completedAt = Date.now();
    if (reason) task.error = reason;
    if (wasRunning) this.runningCount = Math.max(0, this.runningCount - 1);
    if (task.parentSessionID) {
      const count = this.rootDescendantCounts.get(task.parentSessionID) ?? 1;
      this.rootDescendantCounts.set(
        task.parentSessionID,
        Math.max(0, count - 1),
      );
    }
    if (this.client && task.sessionID) {
      this.client.session
        .abort({ path: { id: task.sessionID } })
        .catch(() => {});
    }
    return true;
  }

  private startPolling() {
    if (this.pollInterval) return;
    this.pollInterval = setInterval(() => this.poll(), 5000);
    this.pollInterval.unref?.();
  }

  private async poll() {
    if (!this.client) return;

    for (const [_id, task] of this.tasks) {
      if (task.status !== "running") continue;

      // Check stale timeout
      if (Date.now() - task.createdAt > this.staleTimeoutMs) {
        task.status = "error";
        task.error = "Task timed out";
        task.completedAt = Date.now();
        this.runningCount = Math.max(0, this.runningCount - 1);
        if (task.parentSessionID) {
          const count =
            this.rootDescendantCounts.get(task.parentSessionID) ?? 1;
          this.rootDescendantCounts.set(
            task.parentSessionID,
            Math.max(0, count - 1),
          );
        }
        await this.notifyParent(task);
        continue;
      }

      // Check session status
      try {
        const statusResult = await this.client.session.status();
        const sessionStatus = statusResult.data?.[task.sessionID];
        const status = (sessionStatus as { status?: string } | undefined)
          ?.status;

        if (status === "idle" || status === "completed") {
          // Fetch result
          const messages = await this.client.session.messages({
            path: { id: task.sessionID },
          });
          const lastAssistant = (messages.data ?? [])
            .reverse()
            .find(
              (m: { info?: { role?: string } }) => m.info?.role === "assistant",
            );
          const text =
            lastAssistant?.parts
              ?.filter((p) => (p as { type?: string }).type === "text")
              .map((p) => (p as { text?: string }).text)
              .join("") ?? "";

          task.status = "completed";
          task.result = text;
          task.completedAt = Date.now();
          this.runningCount = Math.max(0, this.runningCount - 1);
          if (task.parentSessionID) {
            const count =
              this.rootDescendantCounts.get(task.parentSessionID) ?? 1;
            this.rootDescendantCounts.set(
              task.parentSessionID,
              Math.max(0, count - 1),
            );
          }

          // Notify parent
          await this.notifyParent(task);
        } else if (status === "error") {
          task.status = "error";
          task.error = "Session errored";
          task.completedAt = Date.now();
          this.runningCount = Math.max(0, this.runningCount - 1);
          if (task.parentSessionID) {
            const count =
              this.rootDescendantCounts.get(task.parentSessionID) ?? 1;
            this.rootDescendantCounts.set(
              task.parentSessionID,
              Math.max(0, count - 1),
            );
          }
          await this.notifyParent(task);
        }
      } catch {
        // Transient error, continue polling
      }
    }
  }

  private async notifyParent(task: BackgroundTask) {
    if (!this.client) return;
    try {
      const sanitizedResult =
        task.status === "completed"
          ? formatBackgroundResultForParent(task.result ?? "")
          : undefined;

      const message =
        task.status === "completed"
          ? `[Background task completed: ${task.description}]\nResult: ${sanitizedResult ?? "No output"}`
          : `[Background task failed: ${task.description}]\nError: ${task.error ?? "Unknown error"}`;

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Notification timeout")), 10000),
      );
      const notifyPromise = this.client.session.prompt({
        path: { id: task.parentSessionID },
        body: { parts: [{ type: "text" as const, text: message }] },
      });
      await Promise.race([notifyPromise, timeoutPromise]);
    } catch {
      console.log("[hiai-opencode] Notification failed or timed out");
    }
  }

  getRunningTasks(): BackgroundTask[] {
    return Array.from(this.tasks.values()).filter(
      (t) => t.status === "running",
    );
  }

  private startCleanup() {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [_id, task] of this.tasks) {
        if (task.status !== "running") {
          if (task.completedAt && now - task.completedAt > 10 * 60 * 1000) {
            this.tasks.delete(_id);
          }
        }
      }
    }, 60_000);
    this.cleanupInterval.unref?.();
  }

  dispose() {
    if (this.pollInterval) clearInterval(this.pollInterval);
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
  }
}
