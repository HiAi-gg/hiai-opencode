import { setPendingModelFallback } from "../../hooks/model-fallback/hook";
import {
  getMainSessionID,
  getSessionAgent,
} from "../../features/claude-code-session-state";
import { log } from "../../shared/logger";
import { shouldRetryError } from "../../shared/model-error-classifier";
import {
  extractRetryAttempt,
  normalizeRetryStatusMessage,
} from "../../shared/retry-status-utils";

import type { EventInput, EventHandlerDeps } from "./types";
import {
  extractProviderModelFromErrorMessage,
  normalizeFallbackModelID,
  applyUserConfiguredFallbackChain,
} from "./utils";

export async function handleSessionStatus(
  input: EventInput,
  deps: EventHandlerDeps,
): Promise<void> {
  const props = input.event.properties as Record<string, unknown> | undefined;
  const sessionID = props?.sessionID as string | undefined;
  const status = props?.status as
    | { type?: string; attempt?: number; message?: string; next?: number }
    | undefined;

  if (sessionID && status?.type === "idle") {
    deps.lastHandledRetryStatusKey.delete(sessionID);
  }

  if (
    sessionID &&
    status?.type === "retry" &&
    deps.isModelFallbackEnabled &&
    !deps.isRuntimeFallbackEnabled
  ) {
    try {
      const retryMessage =
        typeof status.message === "string" ? status.message : "";
      const parsedForKey = extractProviderModelFromErrorMessage(retryMessage);
      const retryAttempt = extractRetryAttempt(status.attempt, retryMessage);
      const retryKey = `${retryAttempt}:${parsedForKey.providerID ?? ""}/${parsedForKey.modelID ?? ""}:${normalizeRetryStatusMessage(retryMessage)}`;
      if (deps.lastHandledRetryStatusKey.get(sessionID) === retryKey) return;
      deps.lastHandledRetryStatusKey.set(sessionID, retryKey);

      const errorInfo = {
        name: undefined as string | undefined,
        message: retryMessage,
      };
      if (shouldRetryError(errorInfo)) {
        let agentName = getSessionAgent(sessionID);
        if (!agentName && sessionID === getMainSessionID()) {
          if (
            retryMessage.includes("claude-opus") ||
            retryMessage.includes("opus")
          ) {
            agentName = "bob";
          } else if (retryMessage.includes("gpt-5")) {
            agentName = "coder";
          } else {
            agentName = "bob";
          }
        }

        if (agentName) {
          const parsed = extractProviderModelFromErrorMessage(retryMessage);
          const lastKnown = deps.lastKnownModelBySession.get(sessionID);
          const currentProvider = deps.resolveFallbackProviderID(
            sessionID,
            parsed.providerID,
          );
          let currentModel =
            parsed.modelID ?? lastKnown?.modelID ?? "claude-opus-4-6";
          currentModel = normalizeFallbackModelID(currentModel);
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
            await deps.autoContinueAfterFallback(sessionID, "session.status");
          }
        }
      }
    } catch (err) {
      log("[event] model-fallback error in session.status:", {
        sessionID,
        error: err,
      });
    }
  }
}
