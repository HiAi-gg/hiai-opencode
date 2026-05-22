import type { PluginInput } from "@opencode-ai/plugin";
import { log } from "../../shared/logger";
import type { RecoveryErrorType } from "./detect-error-type";
import { detectErrorType } from "./detect-error-type";
import type { SessionRecoveryHook, SessionRecoveryOptions } from "./hook";
import { recoverThinkingBlockOrder } from "./recover-thinking-block-order";
import { recoverThinkingDisabledViolation } from "./recover-thinking-disabled-violation";
import { recoverToolResultMissing } from "./recover-tool-result-missing";
import { recoverUnavailableTool } from "./recover-unavailable-tool";
import {
  extractResumeConfig,
  findLastUserMessage,
  resumeSession,
} from "./resume";
import {
  createSessionStateBackupManager,
  type SessionStateSnapshot,
} from "./state-backup";
import type { MessageData } from "./types";

interface MessageInfo {
  id?: string;
  role?: string;
  sessionID?: string;
  parentID?: string;
  error?: unknown;
}

export interface EnhancedSessionRecoveryHook extends SessionRecoveryHook {
  captureState: (sessionID: string, options?: CaptureOptions) => Promise<void>;
  getSnapshot: (sessionID: string) => SessionStateSnapshot | undefined;
  clearSnapshot: (sessionID: string) => void;
}

export interface CaptureOptions {
  agent?: string;
  model?: { providerID: string; modelID: string; variant?: string };
  tools?: Record<string, boolean>;
  todoSnapshot?: Array<{ id: string; content: string; status: string }>;
  activePlanName?: string;
  continuationState?: {
    failureCount: number;
    lastInjectedAt?: number;
    stagnationCount: number;
  };
  sessionTitle?: string;
}

export function createSessionRecoveryHook(
  ctx: PluginInput,
  options?: SessionRecoveryOptions,
): EnhancedSessionRecoveryHook {
  const processingErrors = new Set<string>();
  const experimental = options?.experimental;
  let onAbortCallback: ((sessionID: string) => void) | null = null;
  let onRecoveryCompleteCallback: ((sessionID: string) => void) | null = null;

  const backupManager = createSessionStateBackupManager(ctx);

  const setOnAbortCallback = (callback: (sessionID: string) => void): void => {
    onAbortCallback = callback;
  };

  const setOnRecoveryCompleteCallback = (
    callback: (sessionID: string) => void,
  ): void => {
    onRecoveryCompleteCallback = callback;
  };

  const isRecoverableError = (error: unknown): boolean => {
    return detectErrorType(error) !== null;
  };

  /**
   * Capture current session state for potential recovery.
   * Call this before any operation that could fail and lose state.
   */
  const captureState = async (
    sessionID: string,
    captureOptions?: CaptureOptions,
  ): Promise<void> => {
    try {
      // Capture todo state
      let todoSnapshot: CaptureOptions["todoSnapshot"] | undefined;
      try {
        const todoResp = await ctx.client.session.todo({
          path: { id: sessionID },
        });
        const todos =
          (
            todoResp as {
              todos?: Array<{ id?: string; content?: string; status?: string }>;
            }
          )?.todos ?? [];
        if (todos.length > 0) {
          todoSnapshot = todos.map((t) => ({
            id: t.id ?? "",
            content: t.content ?? "",
            status: t.status ?? "pending",
          }));
        }
      } catch {
        // Ignore todo fetch failures
      }

      await backupManager.capture(sessionID, {
        agent: captureOptions?.agent,
        model: captureOptions?.model,
        tools: captureOptions?.tools,
        todoSnapshot,
        activePlanName: captureOptions?.activePlanName,
        continuationState: captureOptions?.continuationState,
        sessionTitle: captureOptions?.sessionTitle,
      });
    } catch (err) {
      log(`[session-recovery] Failed to capture state`, {
        sessionID,
        error: String(err),
      });
    }
  };

  /**
   * Get the current state snapshot for a session.
   */
  const getSnapshot = (sessionID: string): SessionStateSnapshot | undefined => {
    return backupManager.getSnapshot(sessionID);
  };

  /**
   * Clear a state snapshot after successful recovery.
   */
  const clearSnapshot = (sessionID: string): void => {
    backupManager.clearSnapshot(sessionID);
  };

  const handleSessionRecovery = async (info: MessageInfo): Promise<boolean> => {
    if (!info || info.role !== "assistant" || !info.error) return false;

    const errorType = detectErrorType(info.error);
    if (!errorType) return false;

    const sessionID = info.sessionID;
    let assistantMsgID = info.id;

    if (!sessionID) return false;

    // Capture state BEFORE recovery attempt for any subsequent failures
    await captureState(sessionID);

    if (!assistantMsgID) {
      try {
        const messagesResp = await ctx.client.session.messages({
          path: { id: sessionID },
          query: { directory: ctx.directory },
        });
        const msgs = (messagesResp as { data?: MessageData[] }).data;
        const lastAssistant = msgs?.findLast(
          (m) => m.info?.role === "assistant" && m.info?.error,
        );
        assistantMsgID = lastAssistant?.info?.id;
      } catch {
        log(
          "[session-recovery] Failed to fetch messages for messageID fallback",
          { sessionID },
        );
      }
    }

    if (!assistantMsgID) return false;
    if (processingErrors.has(assistantMsgID)) return false;
    processingErrors.add(assistantMsgID);

    try {
      if (onAbortCallback) {
        onAbortCallback(sessionID);
      }

      await ctx.client.session
        .abort({ path: { id: sessionID } })
        .catch((err: unknown) => {
          log(`[session-recovery] session abort failed: ${String(err)}`);
        });

      const messagesResp = await ctx.client.session.messages({
        path: { id: sessionID },
        query: { directory: ctx.directory },
      });
      const msgs = (messagesResp as { data?: MessageData[] }).data;

      const failedMsg = msgs?.find((m) => m.info?.id === assistantMsgID);
      if (!failedMsg) {
        return false;
      }

      const toastTitles: Record<RecoveryErrorType & string, string> = {
        tool_result_missing: "Tool Crash Recovery",
        unavailable_tool: "Tool Recovery",
        thinking_block_order: "Thinking Block Recovery",
        thinking_disabled_violation: "Thinking Strip Recovery",
        assistant_prefill_unsupported: "Prefill Unsupported",
      };
      const toastMessages: Record<RecoveryErrorType & string, string> = {
        tool_result_missing: "Injecting cancelled tool results...",
        unavailable_tool: "Recovering from unavailable tool call...",
        thinking_block_order: "Fixing message structure...",
        thinking_disabled_violation: "Stripping thinking blocks...",
        assistant_prefill_unsupported:
          "Prefill not supported; continuing without recovery.",
      };

      await ctx.client.tui
        .showToast({
          body: {
            title: toastTitles[errorType],
            message: toastMessages[errorType],
            variant: "warning",
            duration: 3000,
          },
        })
        .catch((err: unknown) => {
          log(`[session-recovery] showToast failed: ${String(err)}`);
        });

      let success = false;

      if (errorType === "tool_result_missing") {
        success = await recoverToolResultMissing(
          ctx.client,
          sessionID,
          failedMsg,
        );
      } else if (errorType === "unavailable_tool") {
        success = await recoverUnavailableTool(
          ctx.client,
          sessionID,
          failedMsg,
        );
      } else if (errorType === "thinking_block_order") {
        success = await recoverThinkingBlockOrder(
          ctx.client,
          sessionID,
          failedMsg,
          ctx.directory,
          info.error,
        );
        if (success && experimental?.auto_resume) {
          const lastUser = findLastUserMessage(msgs ?? []);
          const resumeConfig = extractResumeConfig(lastUser, sessionID);
          await resumeSession(ctx.client, resumeConfig);
        }
      } else if (errorType === "thinking_disabled_violation") {
        success = await recoverThinkingDisabledViolation(
          ctx.client,
          sessionID,
          failedMsg,
        );
        if (success && experimental?.auto_resume) {
          const lastUser = findLastUserMessage(msgs ?? []);
          const resumeConfig = extractResumeConfig(lastUser, sessionID);
          await resumeSession(ctx.client, resumeConfig);
        }
      } else if (errorType === "assistant_prefill_unsupported") {
        success = false;
      }

      // Clear snapshot on successful recovery
      if (success) {
        backupManager.clearSnapshot(sessionID);
      }

      return success;
    } catch (err) {
      log("[session-recovery] Recovery failed:", err);
      return false;
    } finally {
      processingErrors.delete(assistantMsgID);

      if (sessionID && onRecoveryCompleteCallback) {
        onRecoveryCompleteCallback(sessionID);
      }
    }
  };

  return {
    handleSessionRecovery,
    isRecoverableError,
    setOnAbortCallback,
    setOnRecoveryCompleteCallback,
    captureState,
    getSnapshot,
    clearSnapshot,
  };
}
