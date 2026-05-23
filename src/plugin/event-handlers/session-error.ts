import type { PluginContext } from "../types";
import {
  clearPendingModelFallback,
  setPendingModelFallback,
} from "../../hooks/model-fallback/hook";
import { getMainSessionID, getSessionAgent } from "../../features/claude-code-session-state";
import { log } from "../../shared/logger";
import { shouldRetryError } from "../../shared/model-error-classifier";
import { extractRetryAttempt, normalizeRetryStatusMessage } from "../../shared/retry-status-utils";

import type { EventInput, EventHandlerDeps } from "./types";
import {
  extractErrorName,
  extractErrorMessage,
  extractProviderModelFromErrorMessage,
  normalizeFallbackModelID,
  applyUserConfiguredFallbackChain,
} from "./utils";

export async function handleSessionError(
  input: EventInput,
  deps: EventHandlerDeps,
): Promise<void> {
  const props = input.event.properties as Record<string, unknown> | undefined;
  const sessionID = props?.sessionID as string | undefined;
  const error = props?.error;

  const errorName = extractErrorName(error);
  const errorMessage = extractErrorMessage(error);
  const errorInfo = { name: errorName, message: errorMessage };

  if (deps.hooks.sessionRecovery?.isRecoverableError(error)) {
    const messageInfo = {
      id: props?.messageID as string | undefined,
      role: "assistant" as const,
      sessionID,
      error,
    };
    const recovered = await deps.hooks.sessionRecovery.handleSessionRecovery(messageInfo);

    if (
      recovered &&
      sessionID &&
      sessionID === getMainSessionID() &&
      !deps.hooks.stopContinuationGuard?.isStopped(sessionID)
    ) {
      await deps.pluginContext.client.session
        .summarize({
          path: { id: sessionID },
          body: { auto: true },
          query: { directory: deps.pluginContext.directory },
        })
        .catch((err: unknown) => {
          log("[event] compaction before recovery continue failed:", { sessionID, error: err });
        });

      await deps.pluginContext.client.session
        .prompt({
          path: { id: sessionID },
          body: { parts: [{ type: "text", text: "continue" }] },
          query: { directory: deps.pluginContext.directory },
        })
        .catch(() => { /* intentionally ignored — recovery prompt is best-effort */ });
    }
  } else if (
    sessionID &&
    shouldRetryError(errorInfo) &&
    !deps.isRuntimeFallbackEnabled &&
    deps.isModelFallbackEnabled
  ) {
    let agentName = getSessionAgent(sessionID);

    if (!agentName && sessionID === getMainSessionID()) {
      if (errorMessage.includes("claude-opus") || errorMessage.includes("opus")) {
        agentName = "bob";
      } else if (errorMessage.includes("gpt-5")) {
        agentName = "coder";
      } else {
        agentName = "bob";
      }
    }

    if (agentName) {
      const parsed = extractProviderModelFromErrorMessage(errorMessage);
      const currentProvider = deps.resolveFallbackProviderID(
        sessionID,
        (props?.providerID as string | undefined) || parsed.providerID,
      );
      let currentModel = (props?.modelID as string) || parsed.modelID || "claude-opus-4-6";
      currentModel = normalizeFallbackModelID(currentModel);
      applyUserConfiguredFallbackChain(sessionID, agentName, currentProvider, deps.pluginConfig);

      const setFallback = setPendingModelFallback(sessionID, agentName, currentProvider, currentModel);

      if (
        setFallback &&
        deps.shouldAutoRetrySession(sessionID) &&
        !deps.hooks.stopContinuationGuard?.isStopped(sessionID)
      ) {
        await deps.autoContinueAfterFallback(sessionID, "session.error");
      }
    }
  }
}
