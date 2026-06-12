import { setPendingModelFallback } from "../../hooks/model-fallback/hook";
import {
  getMainSessionID,
  getSessionAgent,
  updateSessionAgent,
} from "../../features/claude-code-session-state";
import { log } from "../../shared/logger";
import { shouldRetryError } from "../../shared/model-error-classifier";
import { setSessionModel } from "../../shared/session-model-state";
import { reasoningContentCache, extractReasoningContent } from "../../shared/reasoning-content-cache";

import type { EventInput, EventHandlerDeps } from "./types";
import {
  extractErrorName,
  extractErrorMessage,
  normalizeFallbackModelID,
  applyUserConfiguredFallbackChain,
  isCompactionAgent,
} from "./utils";

export async function handleMessageUpdated(
  input: EventInput,
  deps: EventHandlerDeps,
): Promise<void> {
  const props = input.event.properties as Record<string, unknown> | undefined;
  const info = props?.info as Record<string, unknown> | undefined;
  const sessionID = info?.sessionID as string | undefined;
  const agent = info?.agent as string | undefined;
  const role = info?.role as string | undefined;

  if (sessionID && role === "user") {
    const isCompactionMsg = agent ? isCompactionAgent(agent) : false;
    if (agent && !isCompactionMsg) {
      updateSessionAgent(sessionID, agent);
    }
    const providerID = info?.providerID as string | undefined;
    const modelID = info?.modelID as string | undefined;
    if (providerID && modelID && !isCompactionMsg) {
      deps.lastKnownModelBySession.set(sessionID, { providerID, modelID });
      setSessionModel(sessionID, { providerID, modelID });
    }
  }

  if (sessionID && role === "assistant" && info) {
    const messageId = info.id as string | undefined;
    if (messageId) {
      const reasoningContent = extractReasoningContent(info);
      if (reasoningContent !== null && reasoningContent.length > 0) {
        reasoningContentCache.saveById(sessionID, messageId, reasoningContent);
        log("[reasoning-content-cache] Saved reasoning_content from message.updated", {
          sessionID,
          messageId,
          contentLength: reasoningContent.length,
        });
      }
    }
  }

  if (
    sessionID &&
    role === "assistant" &&
    !deps.isRuntimeFallbackEnabled &&
    deps.isModelFallbackEnabled
  ) {
    try {
      const assistantMessageID = info?.id as string | undefined;
      const assistantError = info?.error;
      if (assistantMessageID && assistantError) {
        const lastHandled = deps.lastHandledModelErrorMessageID.get(sessionID);
        if (lastHandled === assistantMessageID) return;

        const errorName = extractErrorName(assistantError);
        const errorMessage = extractErrorMessage(assistantError);
        const errorInfo = { name: errorName, message: errorMessage };

        if (shouldRetryError(errorInfo)) {
          let agentName = agent ?? getSessionAgent(sessionID);
          if (!agentName && sessionID === getMainSessionID()) {
            if (
              errorMessage.includes("claude-opus") ||
              errorMessage.includes("opus")
            ) {
              agentName = "bob";
            } else if (errorMessage.includes("gpt-5")) {
              agentName = "coder";
            } else {
              agentName = "bob";
            }
          }

          if (agentName) {
            const currentProvider = deps.resolveFallbackProviderID(
              sessionID,
              info?.providerID as string | undefined,
            );
            const rawModel =
              (info?.modelID as string | undefined) ?? "claude-opus-4-6";
            const currentModel = normalizeFallbackModelID(rawModel);
            applyUserConfiguredFallbackChain(
              sessionID,
              agentName,
              currentProvider,
              deps.pluginConfig,
            );

            const setFallback = setPendingModelFallback(
              sessionID,
              agentName,
              currentProvider,
              currentModel,
            );

            if (
              setFallback &&
              deps.shouldAutoRetrySession(sessionID) &&
              !deps.hooks.stopContinuationGuard?.isStopped(sessionID)
            ) {
              deps.lastHandledModelErrorMessageID.set(
                sessionID,
                assistantMessageID,
              );
              await deps.autoContinueAfterFallback(
                sessionID,
                "message.updated",
              );
            }
          }
        }
      }
    } catch (err) {
      log("[event] model-fallback error in message.updated:", {
        sessionID,
        error: err,
      });
    }
  }
}
