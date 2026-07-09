import type { BobConfig, HookSet } from "../types";
import { createAgentUsageReminder } from "./agent-usage-reminder";
import { createCavemanMessageCompressor } from "./caveman-message-compressor";
import { createCavemanSystemInjector } from "./caveman-system-injector";
import { createClosureInjector } from "./closure-injector";
import { createCompactionContextInjector } from "./compaction-context-injector";
import { createCompactionTodoPreserverHook } from "./compaction-todo-preserver";
import { createContextWindowLimitRecoveryHook } from "./context-window-limit-recovery";
import { createContextWindowMonitor } from "./context-window-monitor";
import { createDirectoryAgentsInjector } from "./directory-agents-injector";
import { createEditErrorRecovery } from "./edit-error-recovery";
import { createJsonErrorRecovery } from "./json-error-recovery";
import { createLegalGate } from "./legal-gate";
import { createLoopHook } from "./loop";
import { createManagerGuard } from "./manager-guard";
import { createModelFallbackHook } from "./model-fallback";
import { createNonInteractiveEnv } from "./non-interactive-env";
import { createPreemptiveCompaction } from "./preemptive-compaction";
import { createQualityGate } from "./quality-gate";
import { createReasoningContentCacheHook } from "./reasoning-content-cache";
import { createRulesInjector } from "./rules-injector";
import { createRuntimeFallback } from "./runtime-fallback";
import { createSessionNotification } from "./session-notification";
import { createSessionRecoveryHook } from "./session-recovery";
import { createStopContinuationGuard } from "./stop-continuation-guard";
import { createThinkModeHook } from "./think-mode";
import { createThinkingBlockValidator } from "./thinking-block-validator";
import { createTodoContinuationHook } from "./todo-continuation";
import { createTokenBudgetHook } from "./token-budget";
import { createToolPairValidator } from "./tool-pair-validator";
import { createWriteExistingFileGuard } from "./write-existing-file-guard";

type HookFactory = (config: BobConfig) => HookSet;

interface NamedHookFactory {
  name: string;
  factory: HookFactory;
}

const HOOK_POINT_KEYS: (keyof HookSet)[] = [
  "experimental.chat.messages.transform",
  "experimental.chat.system.transform",
  "experimental.session.compacting",
  "experimental.compaction.autocontinue",
  "event",
  "chat.message",
  "chat.params",
  "tool.execute.before",
  "tool.execute.after",
  "permission.ask",
  "command.execute.before",
];

function mergeHookSets(factories: HookFactory[], config: BobConfig): HookSet {
  const allSets = factories.map((f) => f(config));
  const merged: HookSet = {};

  for (const point of HOOK_POINT_KEYS) {
    const handlers = allSets
      .map((s) => s[point])
      .filter(
        (h): h is (...args: never[]) => Promise<void> =>
          typeof h === "function",
      );
    if (handlers.length === 0) continue;

    if (handlers.length === 1) {
      (merged as Record<string, unknown>)[point] = handlers[0];
    } else {
      (merged as Record<string, unknown>)[point] = async (
        input: unknown,
        output: unknown,
      ) => {
        for (const handler of handlers) {
          try {
            await handler(input as never, output as never);
          } catch (err) {
            console.error(
              `[hiai-opencode] Hook handler error in ${point}:`,
              err,
            );
          }
        }
      };
    }
  }

  const disposeFns = allSets
    .map((s) => s.dispose)
    .filter((d): d is NonNullable<typeof d> => d != null);
  if (disposeFns.length > 0) {
    merged.dispose = async () => {
      for (const fn of disposeFns) await fn();
    };
  }

  return merged;
}

const ALL_NAMED_HOOK_FACTORIES: NamedHookFactory[] = [
  { name: "closure-injector", factory: createClosureInjector },
  { name: "caveman-system-injector", factory: createCavemanSystemInjector },
  {
    name: "caveman-message-compressor",
    factory: createCavemanMessageCompressor,
  },

  { name: "todo-continuation", factory: createTodoContinuationHook },
  { name: "quality-gate", factory: createQualityGate },
  { name: "context-window-monitor", factory: createContextWindowMonitor },
  { name: "tool-pair-validator", factory: createToolPairValidator },
  { name: "thinking-block-validator", factory: createThinkingBlockValidator },
  { name: "write-existing-file-guard", factory: createWriteExistingFileGuard },
  { name: "json-error-recovery", factory: createJsonErrorRecovery },
  { name: "edit-error-recovery", factory: createEditErrorRecovery },
  { name: "non-interactive-env", factory: createNonInteractiveEnv },
  { name: "model-fallback", factory: createModelFallbackHook },
  { name: "runtime-fallback", factory: createRuntimeFallback },
  { name: "preemptive-compaction", factory: createPreemptiveCompaction },
  { name: "stop-continuation-guard", factory: createStopContinuationGuard },
  { name: "rules-injector", factory: createRulesInjector },
  { name: "legal-gate", factory: createLegalGate },

  { name: "directory-agents-injector", factory: createDirectoryAgentsInjector },
  { name: "loop", factory: createLoopHook },
  { name: "manager-guard", factory: createManagerGuard },
  {
    name: "compaction-context-injector",
    factory: createCompactionContextInjector,
  },
  { name: "session-notification", factory: createSessionNotification },

  { name: "agent-usage-reminder", factory: createAgentUsageReminder },
  { name: "session-recovery", factory: createSessionRecoveryHook },
  { name: "think-mode", factory: createThinkModeHook },
  { name: "token-budget", factory: createTokenBudgetHook },
  {
    name: "compaction-todo-preserver",
    factory: createCompactionTodoPreserverHook,
  },
  { name: "reasoning-content-cache", factory: createReasoningContentCacheHook },
  {
    name: "context-window-limit-recovery",
    factory: createContextWindowLimitRecoveryHook,
  },
];

export function createHooks(config: BobConfig): HookSet {
  const disabledSet = new Set(config.hooks?.disabled ?? []);

  const enabledFactories = ALL_NAMED_HOOK_FACTORIES.filter(
    (h) => !disabledSet.has(h.name),
  ).map((h) => h.factory);

  return mergeHookSets(enabledFactories, config);
}
