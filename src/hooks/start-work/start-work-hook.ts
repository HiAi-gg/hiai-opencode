import type { PluginInput } from "@opencode-ai/plugin";
import {
  readBoulderState,
  hasConflictingPlan,
  ensureRegistryExists,
} from "../../features/boulder-state";
import { log } from "../../shared/logger";
import {
  resolveRegisteredAgentName,
  updateSessionAgent,
} from "../../features/claude-code-session-state";
import {
  detectWorktreePath,
  createWorktreeForPlan,
  validateWorktreeHealth,
} from "./worktree-detector";
import { parseUserRequest } from "./parse-user-request";
import { buildStartWorkContextInfo } from "./context-info-builder";
import { createWorktreeActiveBlock } from "./worktree-block";

export const HOOK_NAME = "start-work" as const;
const START_WORK_TEMPLATE_MARKER = "You are starting a Bob work session.";

interface StartWorkHookInput {
  sessionID: string;
  messageID?: string;
}

interface StartWorkCommandExecuteBeforeInput {
  sessionID: string;
  command: string;
  arguments: string;
}

interface StartWorkHookOutput {
  message?: Record<string, unknown>;
  parts: Array<{ type: string; text?: string }>;
}

interface StartWorkProcessOptions {
  allowMessageMutation: boolean;
}

/**
 * Check if a directory is a git repository
 */
async function checkIfGitRepo(directory: string): Promise<boolean> {
  try {
    const { exec } = await import("node:child_process");
    return await new Promise((resolve) => {
      exec("git rev-parse --show-toplevel", { cwd: directory }, (error) => {
        resolve(!error);
      });
    });
  } catch {
    return false;
  }
}

function resolveWorktreeContext(explicitWorktreePath: string | null): {
  worktreePath: string | undefined;
  block: string;
} {
  if (explicitWorktreePath === null) {
    return { worktreePath: undefined, block: "" };
  }

  const validatedPath = detectWorktreePath(explicitWorktreePath);
  if (validatedPath) {
    return {
      worktreePath: validatedPath,
      block: createWorktreeActiveBlock(validatedPath),
    };
  }

  return {
    worktreePath: undefined,
    block: `\n**Worktree** (needs setup): \`git worktree add ${explicitWorktreePath} <branch>\`, then add \`"worktree_path"\` to boulder.json`,
  };
}

export function createStartWorkHook(ctx: PluginInput) {
  const processStartWork = async (
    input: StartWorkHookInput,
    output: StartWorkHookOutput,
    options: StartWorkProcessOptions,
  ): Promise<void> => {
    const parts = output.parts;
    const promptText =
      parts
        ?.filter((p) => p.type === "text" && p.text)
        .map((p) => p.text)
        .join("\n")
        .trim() || "";

    if (
      !promptText.includes("<session-context>") ||
      !promptText.includes(START_WORK_TEMPLATE_MARKER)
    ) {
      return;
    }

    log(`[${HOOK_NAME}] Processing start-work command`, {
      sessionID: input.sessionID,
    });
    const activeAgent = "bob";
    updateSessionAgent(input.sessionID, activeAgent);
    if (options.allowMessageMutation && output.message) {
      output.message.agent =
        resolveRegisteredAgentName(activeAgent) ?? activeAgent;
    }

    const existingState = readBoulderState(ctx.directory);
    const sessionId = input.sessionID;
    const timestamp = new Date().toISOString();

    const { planName: explicitPlanName, explicitWorktreePath } =
      parseUserRequest(promptText);

    // Phase 4: Auto-isolation decision flow
    // Ensure registry exists (triggers migration if v1 found)
    ensureRegistryExists(ctx.directory);

    let effectiveDirectory = ctx.directory;
    let isolationError: string | null = null;

    // Get the plan name for conflict checking
    let planName = explicitPlanName;
    if (!planName && existingState) {
      planName = existingState.plan_name;
    }

    // Check for conflicting plans if we have a plan name
    if (planName) {
      const conflict = hasConflictingPlan(ctx.directory, planName);
      if (conflict) {
        // Need isolation — check if git repo
        const isGitRepo = await checkIfGitRepo(ctx.directory);
        if (!isGitRepo) {
          isolationError =
            "Cannot isolate parallel plans: not a git repository. Complete the other plan first, or initialize git.";
        } else {
          // Create or reuse worktree
          const worktreePath = createWorktreeForPlan(
            ctx.directory,
            planName,
            input.sessionID,
          );
          if (!worktreePath) {
            isolationError = "Failed to create worktree for plan isolation";
          } else {
            // Validate health
            const health = validateWorktreeHealth(worktreePath);
            if (!health.valid) {
              isolationError = `Worktree unhealthy: ${health.reason}`;
            } else {
              effectiveDirectory = worktreePath;
            }
          }
        }
      }
    }

    // Handle explicit worktree path (manual override)
    if (explicitWorktreePath !== null && !isolationError) {
      const { worktreePath: manualWorktreePath, block: manualBlock } =
        resolveWorktreeContext(explicitWorktreePath);
      if (manualWorktreePath) {
        effectiveDirectory = manualWorktreePath;
      }
    }

    const { worktreePath, block: worktreeBlock } =
      resolveWorktreeContext(explicitWorktreePath);

    const contextInfo = buildStartWorkContextInfo({
      ctx,
      explicitPlanName,
      existingState,
      sessionId,
      timestamp,
      activeAgent,
      worktreePath,
      worktreeBlock,
      effectiveDirectory,
      isolationError,
    });

    const idx = output.parts.findIndex((p) => p.type === "text" && p.text);
    if (idx >= 0 && output.parts[idx].text) {
      output.parts[idx].text = output.parts[idx].text
        .replace(/\$SESSION_ID/g, sessionId)
        .replace(/\$TIMESTAMP/g, timestamp);

      output.parts[idx].text += `\n\n---\n${contextInfo}`;
    }

    log(`[${HOOK_NAME}] Context injected`, {
      sessionID: input.sessionID,
      hasExistingState: !!existingState,
      worktreePath,
    });
  };

  return {
    "chat.message": async (
      input: StartWorkHookInput,
      output: StartWorkHookOutput,
    ): Promise<void> => {
      await processStartWork(input, output, { allowMessageMutation: true });
    },
    "command.execute.before": async (
      input: StartWorkCommandExecuteBeforeInput,
      output: StartWorkHookOutput,
    ): Promise<void> => {
      await processStartWork(input, output, { allowMessageMutation: false });
    },
  };
}
