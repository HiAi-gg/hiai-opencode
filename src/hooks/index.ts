import type { BobConfig, HookSet } from "../types";
import { createCavemanMessageCompressor } from "./caveman-message-compressor";
import { createCavemanSystemInjector } from "./caveman-system-injector";
import { createClosureInjector } from "./closure-injector";
import { createCompactionContextInjector } from "./compaction-context-injector";
import { createCompactionTodoPreserverHook } from "./compaction-todo-preserver";
import { createContextWindowLimitRecoveryHook } from "./context-window-limit-recovery";
import { createContextWindowMonitor } from "./context-window-monitor";
import { createDirectoryAgentsInjector } from "./directory-agents-injector";
import { createEditErrorRecovery } from "./edit-error-recovery";
import {
  BlockingHookError,
  MAX_HOOK_ERRORS,
  sanitizeHookError,
  type HookErrorDTO,
} from "./errors";
import { createJsonErrorRecovery } from "./json-error-recovery";
import { createLegalGate } from "./legal-gate";
import { createLoopHook } from "./loop";
import { createModelFallbackHook } from "./model-fallback";
import { createNonInteractiveEnv } from "./non-interactive-env";
import { createPreemptiveCompaction } from "./preemptive-compaction";
import { createQualityGate } from "./quality-gate";
import { createReasoningContentCacheHook } from "./reasoning-content-cache";
import { createRulesInjector } from "./rules-injector";
import { createRuntimeFallback } from "./runtime-fallback";
import { createSessionRecoveryHook } from "./session-recovery";
import { createStopContinuationGuard } from "./stop-continuation-guard";
import { createThinkModeHook } from "./think-mode";
import { createThinkingBlockValidator } from "./thinking-block-validator";
import { createTodoContinuationHook } from "./todo-continuation";
import { createTokenBudgetHook } from "./token-budget";
import { createToolPairValidator } from "./tool-pair-validator";
import { createWorktreeLifecycleHook } from "./worktree-lifecycle";
import { createWriteExistingFileGuard } from "./write-existing-file-guard";
import { logger } from "../util/log";

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

/**
 * Combine multiple HookSet instances into one.
 *
 * - Multiple handlers for the same hook point are chained sequentially.
 * - Non-blocking errors are logged and accumulated into output.errors[]
 * - BlockingHookError propagates immediately, ensuring safety-critical hooks
 *   (legal gate, permission checks) can always halt the pipeline.
 * - Dispose functions from all sources are merged and run sequentially,
 *   with each wrapped in try/catch so one failure doesn't skip the rest.
 */
export function combineHookSets(allSets: HookSet[]): HookSet {
  const merged: HookSet = {};

  for (const point of HOOK_POINT_KEYS) {
    const handlers = allSets
      .map((s) => s[point])
      .filter(
        (h): h is (...args: never[]) => Promise<void> =>
          typeof h === "function",
      );
    if (handlers.length === 0) continue;

    // Always wrap handlers in the safe chain so a single handler also gets
    // error sanitization (no raw error/payload leak) and BlockingHookError
    // still propagates. The wrapper is identical for 1 or N handlers.
    (merged as Record<string, unknown>)[point] = async (
      input: unknown,
      output: unknown,
    ) => {
      const out = output as { errors?: HookErrorDTO[] };
      out.errors = out.errors ?? [];
      const seen = new Set<string>();
      for (const handler of handlers) {
        try {
          await handler(input as never, output as never);
        } catch (err) {
          if (err instanceof BlockingHookError) {
            throw err;
          }
          // Convert the raw error into a TUI-safe DTO first. Never push the
          // raw error/payload — it may embed the full session/event object
          // and is not serializable. Logging the raw value can also throw
          // (e.g. on huge/circular payloads), so we log the DTO instead.
          const dto = sanitizeHookError(err, point);
          try {
            logger.error(
              `[hiai-opencode] Hook handler error in ${point}:`,
              dto,
            );
          } catch {
            /* logging must never break the hook chain */
          }
          // Lazily initialize the errors array so a BlockingHookError (which
          // propagates) never leaves a spurious empty `errors: []` behind.
          out.errors = out.errors ?? [];
          // Dedup identical errors (same code + summary + hook point).
          const key = `${dto.code}|${dto.summary}|${dto.hookPoint ?? ""}`;
          if (seen.has(key)) continue;
          seen.add(key);
          // Cap the number of retained errors to avoid unbounded growth.
          if (out.errors.length >= MAX_HOOK_ERRORS) continue;
          out.errors.push(dto);
        }
      }
    };
  }

  const disposeFns = allSets
    .map((s) => s.dispose)
    .filter((d): d is NonNullable<typeof d> => d != null);
  if (disposeFns.length > 0) {
    merged.dispose = async () => {
      for (const fn of disposeFns) {
        try {
          await fn();
        } catch (err) {
          logger.error("[hiai-opencode] Dispose error:", err);
        }
      }
    };
  }

  return merged;
}

function mergeHookSets(factories: HookFactory[], config: BobConfig): HookSet {
  const allSets = factories.map((f) => f(config));
  return combineHookSets(allSets);
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
  {
    name: "compaction-context-injector",
    factory: createCompactionContextInjector,
  },
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
  { name: "worktree-lifecycle", factory: createWorktreeLifecycleHook },
];

export function createHooks(config: BobConfig): HookSet {
  const disabledSet = new Set(config.hooks?.disabled ?? []);

  const enabledFactories = ALL_NAMED_HOOK_FACTORIES.filter(
    (h) => !disabledSet.has(h.name),
  ).map((h) => h.factory);

  return mergeHookSets(enabledFactories, config);
}
