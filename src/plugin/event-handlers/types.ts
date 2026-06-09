import type { HiaiOpenCodeConfig } from "../../config";
import type { CreatedHooks } from "../../create-hooks";
import type { Managers } from "../../create-managers";

export type EventInput = Parameters<
  NonNullable<NonNullable<CreatedHooks["writeExistingFileGuard"]>["event"]>
>[0];

export type PluginContextTyped = {
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

export type EventHandlerDeps = {
  pluginContext: PluginContextTyped;
  pluginConfig: HiaiOpenCodeConfig;
  hooks: CreatedHooks;
  managers: Managers;
  isRuntimeFallbackEnabled: boolean;
  isModelFallbackEnabled: boolean;
  lastKnownModelBySession: Map<string, { providerID: string; modelID: string }>;
  lastHandledModelErrorMessageID: Map<string, string>;
  lastHandledRetryStatusKey: Map<string, string>;
  resolveFallbackProviderID: (
    sessionID: string,
    providerHint?: string,
  ) => string;
  shouldAutoRetrySession: (sessionID: string) => boolean;
  autoContinueAfterFallback: (
    sessionID: string,
    source: string,
  ) => Promise<void>;
};
