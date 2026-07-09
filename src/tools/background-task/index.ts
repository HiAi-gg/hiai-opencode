import { tool } from "@opencode-ai/plugin";
import type { BackgroundManager } from "../../features/background-manager/index";

let manager: BackgroundManager | null = null;

export function setBackgroundManager(mgr: BackgroundManager) {
  manager = mgr;
}

export const backgroundOutputTool = tool({
  description: "Get output from a background task.",
  args: {
    task_id: tool.schema.string().describe("Background task ID"),
  },
  async execute(args) {
    if (!manager)
      return { title: "Error", output: "BackgroundManager not initialized." };
    try {
      const task = manager.getTask(args.task_id);
      if (!task)
        return {
          title: "Task not found",
          output: `No task with ID: ${args.task_id}`,
        };

      if (task.status === "completed") {
        return { title: "Task completed", output: task.result ?? "No output" };
      }
      if (task.status === "error") {
        return { title: "Task failed", output: task.error ?? "Unknown error" };
      }
      if (task.status === "cancelled") {
        return { title: "Task cancelled", output: "This task was cancelled." };
      }
      return { title: "Task running", output: `Status: ${task.status}` };
    } catch (err) {
      return {
        title: "Error",
        output: `Failed to get task: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
});

export const backgroundCancelTool = tool({
  description: "Cancel a background task.",
  args: {
    task_id: tool.schema.string().describe("Background task ID to cancel"),
  },
  async execute(args) {
    if (!manager)
      return { title: "Error", output: "BackgroundManager not initialized." };
    try {
      const success = manager.cancel(args.task_id);
      return success
        ? { title: "Task cancelled", output: `Task ${args.task_id} cancelled.` }
        : {
            title: "Task not found",
            output: `No task with ID: ${args.task_id}`,
          };
    } catch (err) {
      return {
        title: "Error",
        output: `Failed to cancel task: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
});
