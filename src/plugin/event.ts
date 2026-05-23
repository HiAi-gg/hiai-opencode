import type { HiaiOpenCodeConfig } from "../config";
import type { PluginContext } from "./types";

import {
  clearSessionAgent,
  getMainSessionID,
  getSessionAgent,
  setMainSession,
  subagentSessions,
  syncSubagentSessions,
  updateSessionAgent,
} from "../features/claude-code-session-state";
import {
  clearPendingModelFallback,
  clearSessionFallbackChain,
  setSessionFallbackChain,
  setPendingModelFallback,
} from "../hooks/model-fallback/hook";
import { getRawFallbackModels } from "../hooks/runtime-fallback/fallback-models";
import {
  clearBackgroundOutputConsumptionsForParentSession,
  clearBackgroundOutputConsumptionsForTaskSession,
  restoreBackgroundOutputConsumption,
} from "../shared/background-output-consumption";
import { resetMessageCursor } from "../shared";
import { getAgentConfigKey } from "../shared/agent-display-names";
import { readConnectedProvidersCache } from "../shared/connected-providers-cache";
import { log } from "../shared/logger";
import { shouldRetryError } from "../shared/model-error-classifier";
import { buildFallbackChainFromModels } from "../shared/fallback-chain-from-models";
import { extractRetryAttempt, normalizeRetryStatusMessage } from "../shared/retry-status-utils";
import { clearSessionModel, getSessionModel, setSessionModel } from "../shared/session-model-state";
import { clearSessionPromptParams } from "../shared/session-prompt-params-state";
import { deleteSessionTools } from "../shared/session-tools-store";
import { lspManager } from "../tools";

import type { CreatedHooks } from "../create-hooks";
import type { Managers } from "../create-managers";
import { pruneRecentSyntheticIdles } from "./recent-synthetic-idles";
import { normalizeSessionStatusToIdle } from "./session-status-normalizer";

import type { EventInput } from "./event-handlers/types";
import type { EventHandlerDeps } from "./event-handlers/types";
import { handleSessionError } from "./event-handlers/session-error";
import { handleMessageUpdated } from "./event-handlers/message-updated";
import { handleSessionStatus } from "./event-handlers/session-status";
import {
  normalizeFallbackModelID,
  isCompactionAgent,
} from "./event-handlers/utils";

type FirstMessageVariantGate = {
  markSessionCreated: (sessionInfo: { id?: string; title?: string; parentID?: string } | undefined) => void;
  clear: (sessionID: string) => void;
};

export function createEventHandler(args: {
  ctx: PluginContext;
  pluginConfig: HiaiOpenCodeConfig;
  firstMessageVariantGate: FirstMessageVariantGate;
  managers: Managers;
  hooks: CreatedHooks;
}): (input: EventInput) => Promise<void> {
  const { ctx, pluginConfig, firstMessageVariantGate, managers, hooks } = args;
  const tmuxIntegrationEnabled = pluginConfig.tmux?.enabled ?? false;
  const pluginContext = ctx as {
    directory: string;
    client: {
      session: {
        abort: (input: { path: { id: string } }) => Promise<unknown>;
        promptAsync?: (input: {
          path: { id: string };
          body: { parts: Array<{ type: "text"; text: string }> };
          query: { directory: string };
        }) => Promise<unknown>;
        prompt: (input: {
          path: { id: string };
          body: { parts: Array<{ type: "text"; text: string }> };
          query: { directory: string };
        }) => Promise<unknown>;
        summarize: (...args: unknown[]) => Promise<unknown>;
      };
    };
  };
  const isRuntimeFallbackEnabled =
    hooks.runtimeFallback !== null &&
    hooks.runtimeFallback !== undefined &&
    (typeof args.pluginConfig.runtime_fallback === "boolean"
      ? args.pluginConfig.runtime_fallback
      : (args.pluginConfig.runtime_fallback?.enabled ?? false));

  const isModelFallbackEnabled =
    hooks.modelFallback !== null && hooks.modelFallback !== undefined;

  const lastHandledModelErrorMessageID = new Map<string, string>();
  const lastHandledRetryStatusKey = new Map<string, string>();
  const lastKnownModelBySession = new Map<string, { providerID: string; modelID: string }>();

  const resolveFallbackProviderID = (sessionID: string, providerHint?: string): string => {
    const sessionModel = getSessionModel(sessionID);
    if (sessionModel?.providerID) return sessionModel.providerID;
    const lastKnown = lastKnownModelBySession.get(sessionID);
    if (lastKnown?.providerID) return lastKnown.providerID;
    const normalizedProviderHint = providerHint?.trim();
    if (normalizedProviderHint) return normalizedProviderHint;
    const connectedProvider = readConnectedProvidersCache()?.[0];
    if (connectedProvider) return connectedProvider;
    return "opencode";
  };

  const getEventSessionID = (input: EventInput): string | undefined => {
    const properties = input.event.properties;
    if (!properties || typeof properties !== "object" || !("sessionID" in properties) || typeof properties.sessionID !== "string") {
      return undefined;
    }
    return properties.sessionID;
  };

  const runEventHookSafely = async (
    hookName: string,
    handler: ((input: EventInput) => unknown | Promise<unknown>) | null | undefined,
    input: EventInput,
  ): Promise<void> => {
    if (!handler) return;
    try {
      await Promise.resolve(handler(input));
    } catch (error) {
      log("[event] hook execution failed", { hook: hookName, eventType: input.event.type, sessionID: getEventSessionID(input), error });
    }
  };

  const dispatchToHooks = async (input: EventInput): Promise<void> => {
    await runEventHookSafely("legacyPluginToast", hooks.legacyPluginToast?.event, input);
    await runEventHookSafely("claudeCodeHooks", hooks.claudeCodeHooks?.event, input);
    await runEventHookSafely("backgroundNotificationHook", hooks.backgroundNotificationHook?.event, input);
    await runEventHookSafely("sessionNotification", hooks.sessionNotification, input);
    await runEventHookSafely("todoContinuationEnforcer", hooks.todoContinuationEnforcer?.handler, input);
    await runEventHookSafely("unstableAgentBabysitter", hooks.unstableAgentBabysitter?.event, input);
    await runEventHookSafely("contextWindowMonitor", hooks.contextWindowMonitor?.event, input);
    await runEventHookSafely("preemptiveCompaction", hooks.preemptiveCompaction?.event, input);
    await runEventHookSafely("directoryAgentsInjector", hooks.directoryAgentsInjector?.event, input);
    await runEventHookSafely("directoryReadmeInjector", hooks.directoryReadmeInjector?.event, input);
    await runEventHookSafely("rulesInjector", hooks.rulesInjector?.event, input);
    await runEventHookSafely("thinkMode", hooks.thinkMode?.event, input);
    await runEventHookSafely("anthropicContextWindowLimitRecovery", hooks.anthropicContextWindowLimitRecovery?.event, input);
    await runEventHookSafely("runtimeFallback", hooks.runtimeFallback?.event, input);
    await runEventHookSafely("agentUsageReminder", hooks.agentUsageReminder?.event, input);
    await runEventHookSafely("categorySkillReminder", hooks.categorySkillReminder?.event, input);
    await runEventHookSafely("interactiveBashSession", hooks.interactiveBashSession?.event, input as EventInput);
    await runEventHookSafely("ralphLoop", hooks.ralphLoop?.event, input);
    await runEventHookSafely("stopContinuationGuard", hooks.stopContinuationGuard?.event, input);
    await runEventHookSafely("compactionContextInjector", hooks.compactionContextInjector?.event, input);
    await runEventHookSafely("compactionTodoPreserver", hooks.compactionTodoPreserver?.event, input);
    await runEventHookSafely("writeExistingFileGuard", hooks.writeExistingFileGuard?.event, input);
    await runEventHookSafely("guardHook", hooks.guardHook?.handler, input);
    await runEventHookSafely("autoSlashCommand", hooks.autoSlashCommand?.event, input);
    await runEventHookSafely("mempalaceAutoSave", hooks.mempalaceAutoSave?.handler, input);
  };

  const recentSyntheticIdles = new Map<string, number>();
  const recentRealIdles = new Map<string, number>();
  const DEDUP_WINDOW_MS = 500;
  const TMUX_ACTIVITY_EVENT_TYPES = new Set([
    "message.updated", "message.part.updated", "message.part.delta",
    "message.part.removed", "message.removed",
  ]);

  const shouldAutoRetrySession = (sessionID: string): boolean => {
    if (syncSubagentSessions.has(sessionID)) return true;
    const mainSessionID = getMainSessionID();
    if (mainSessionID) return sessionID === mainSessionID;
    return !subagentSessions.has(sessionID);
  };

  const autoContinueAfterFallback = async (sessionID: string, source: string): Promise<void> => {
    await pluginContext.client.session.abort({ path: { id: sessionID } }).catch((error) => {
      log("[event] model-fallback abort failed", { sessionID, source, error });
    });
    const promptBody = {
      path: { id: sessionID },
      body: { parts: [{ type: "text" as const, text: "continue" }] },
      query: { directory: pluginContext.directory },
    };
    if (typeof pluginContext.client.session.promptAsync === "function") {
      await pluginContext.client.session.promptAsync(promptBody).catch((error) => {
        log("[event] model-fallback promptAsync failed", { sessionID, source, error });
      });
      return;
    }
    await pluginContext.client.session.prompt(promptBody).catch((error) => {
      log("[event] model-fallback prompt failed", { sessionID, source, error });
    });
  };

  const deps: EventHandlerDeps = {
    pluginContext,
    pluginConfig,
    hooks,
    managers,
    isRuntimeFallbackEnabled,
    isModelFallbackEnabled,
    lastKnownModelBySession,
    lastHandledModelErrorMessageID,
    lastHandledRetryStatusKey,
    resolveFallbackProviderID,
    shouldAutoRetrySession,
    autoContinueAfterFallback,
  };

  return async (input): Promise<void> => {
    pruneRecentSyntheticIdles({
      recentSyntheticIdles, recentRealIdles,
      now: Date.now(), dedupWindowMs: DEDUP_WINDOW_MS,
    });

    if (input.event.type === "session.idle") {
      const sessionID = (input.event.properties as Record<string, unknown> | undefined)?.sessionID as string | undefined;
      if (sessionID) {
        const emittedAt = recentSyntheticIdles.get(sessionID);
        if (emittedAt && Date.now() - emittedAt < DEDUP_WINDOW_MS) {
          recentSyntheticIdles.delete(sessionID);
        }
        recentRealIdles.set(sessionID, Date.now());
      }
    }

    await dispatchToHooks(input);

    const syntheticIdle = normalizeSessionStatusToIdle(input);
    if (syntheticIdle) {
      const sessionID = (syntheticIdle.event.properties as Record<string, unknown>)?.sessionID as string;
      const emittedAt = recentRealIdles.get(sessionID);
      if (emittedAt && Date.now() - emittedAt < DEDUP_WINDOW_MS) {
        recentRealIdles.delete(sessionID);
        return;
      }
      recentSyntheticIdles.set(sessionID, Date.now());
      await dispatchToHooks(syntheticIdle as EventInput);
    }

    const { event } = input;
    const props = event.properties as Record<string, unknown> | undefined;

    if (tmuxIntegrationEnabled && TMUX_ACTIVITY_EVENT_TYPES.has(event.type)) {
      managers.tmuxSessionManager.onEvent?.(event as { type: string; properties?: Record<string, unknown> });
    }

    if (event.type === "session.created") {
      const sessionInfo = props?.info as { id?: string; title?: string; parentID?: string } | undefined;
      if (!sessionInfo?.parentID) setMainSession(sessionInfo?.id);
      firstMessageVariantGate.markSessionCreated(sessionInfo);
      if (tmuxIntegrationEnabled) {
        await managers.tmuxSessionManager.onSessionCreated(
          event as { type: string; properties?: { info?: { id?: string; parentID?: string; title?: string } } },
        );
      }
    }

    if (event.type === "session.deleted") {
      const sessionInfo = props?.info as { id?: string } | undefined;
      if (sessionInfo?.id === getMainSessionID()) setMainSession(undefined);
      if (sessionInfo?.id) {
        const wasSyncSubagentSession = syncSubagentSessions.has(sessionInfo.id);
        clearSessionAgent(sessionInfo.id);
        lastHandledModelErrorMessageID.delete(sessionInfo.id);
        lastHandledRetryStatusKey.delete(sessionInfo.id);
        lastKnownModelBySession.delete(sessionInfo.id);
        clearPendingModelFallback(sessionInfo.id);
        clearSessionFallbackChain(sessionInfo.id);
        resetMessageCursor(sessionInfo.id);
        clearBackgroundOutputConsumptionsForParentSession(sessionInfo.id);
        clearBackgroundOutputConsumptionsForTaskSession(sessionInfo.id);
        firstMessageVariantGate.clear(sessionInfo.id);
        clearSessionModel(sessionInfo.id);
        clearSessionPromptParams(sessionInfo.id);
        syncSubagentSessions.delete(sessionInfo.id);
        if (wasSyncSubagentSession) subagentSessions.delete(sessionInfo.id);
        deleteSessionTools(sessionInfo.id);
        await managers.skillMcpManager.disconnectSession(sessionInfo.id);
        await lspManager.cleanupTempDirectoryClients();
        if (tmuxIntegrationEnabled) {
          await managers.tmuxSessionManager.onSessionDeleted({ sessionID: sessionInfo.id });
        }
      }
    }

    if (event.type === "message.removed") {
      const messageID = props?.messageID as string | undefined;
      const sessionID = props?.sessionID as string | undefined;
      restoreBackgroundOutputConsumption(sessionID, messageID);
    }

    if (event.type === "message.updated") {
      await handleMessageUpdated(input, deps);
    }

    if (event.type === "session.status") {
      await handleSessionStatus(input, deps);
    }

    if (event.type === "session.error") {
      try {
        await handleSessionError(input, deps);
      } catch (err) {
        const sessionID = props?.sessionID as string | undefined;
        log("[event] model-fallback error in session.error:", { sessionID, error: err });
      }
    }
  };
}
