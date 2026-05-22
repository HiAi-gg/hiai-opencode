import type { PluginInput } from "@opencode-ai/plugin";
import {
  type ContextLimitModelCacheState,
  resolveActualContextLimit,
} from "../shared/context-limit-resolver";
import { log } from "../shared/logger";
import { isCompacting } from "./shared/compaction-in-progress";

const WARNING_THRESHOLD_80 = 0.8;
const WARNING_THRESHOLD_90 = 0.9;
const HARD_LIMIT_THRESHOLD = 0.95;
const TOAST_DURATION_MS = 4_000;

interface TokenInfo {
  input: number;
  output: number;
  reasoning: number;
  cache: { read: number; write: number };
}

interface CachedTokenState {
  providerID: string;
  modelID: string;
  tokens: TokenInfo;
  warned80: boolean;
  warned90: boolean;
}

export interface TokenBudgetConfig {
  warningThreshold80?: number;
  warningThreshold90?: number;
  hardLimitThreshold?: number;
}

export function createTokenBudgetHook(
  ctx: PluginInput,
  modelCacheState?: ContextLimitModelCacheState,
  config?: TokenBudgetConfig,
) {
  const tokenCache = new Map<string, CachedTokenState>();
  const warn80 = config?.warningThreshold80 ?? WARNING_THRESHOLD_80;
  const warn90 = config?.warningThreshold90 ?? WARNING_THRESHOLD_90;
  const hardLimit = config?.hardLimitThreshold ?? HARD_LIMIT_THRESHOLD;

  function getTokenUsage(sessionID: string): {
    usedTokens: number;
    totalTokens: number;
    usagePercentage: number;
    remainingTokens: number;
  } | null {
    const cached = tokenCache.get(sessionID);
    if (!cached) return null;
    const totalTokens = resolveActualContextLimit(
      cached.providerID,
      cached.modelID,
      modelCacheState,
    );
    if (totalTokens === null) return null;
    const usedTokens =
      (cached.tokens.input ?? 0) + (cached.tokens.cache?.read ?? 0);
    const remainingTokens = Math.max(0, totalTokens - usedTokens);
    return {
      usedTokens,
      totalTokens,
      usagePercentage: usedTokens / totalTokens,
      remainingTokens,
    };
  }

  async function showWarning(
    _sessionID: string,
    threshold: number,
    title: string,
    message: string,
  ): Promise<void> {
    try {
      await ctx.client.tui.showToast({
        body: {
          title,
          message,
          variant:
            threshold >= HARD_LIMIT_THRESHOLD
              ? ("error" as const)
              : ("warning" as const),
          duration: TOAST_DURATION_MS,
        },
      });
    } catch (err) {
      log(`[token-budget] showToast failed: ${String(err)}`);
    }
  }

  const toolExecuteBefore = async (input: {
    tool: string;
    sessionID: string;
    callID: string;
  }): Promise<void> => {
    if (input.tool !== "compress") return;
    const { sessionID } = input;
    if (isCompacting(sessionID)) return;
    const usage = getTokenUsage(sessionID);
    if (!usage) return;
    if (usage.usagePercentage >= hardLimit) {
      const pct = (usage.usagePercentage * 100).toFixed(1);
      await showWarning(
        sessionID,
        hardLimit,
        "Token Budget Critical",
        `Context at ${pct}%. Compress may fail. Consider new session.`,
      );
    }
  };

  const toolExecuteAfter = async (
    input: { tool: string; sessionID: string; callID: string },
    output: { title: string; output: string; metadata: unknown },
  ): Promise<void> => {
    if (input.tool !== "compress") return;
    const usage = getTokenUsage(input.sessionID);
    if (!usage) return;
    if (usage.usagePercentage >= hardLimit) {
      const pct = (usage.usagePercentage * 100).toFixed(1);
      output.output += `\n\n[TURBO-BUDGET WARNING] Context window at ${pct}% - compress executed but context is critically high. Auto-recovery may trigger.`;
    } else if (
      usage.usagePercentage >= warn90 &&
      !tokenCache.get(input.sessionID)?.warned90
    ) {
      const pct = (usage.usagePercentage * 100).toFixed(1);
      output.output += `\n\n[TURBO-BUDGET] Context window at ${pct}%.`;
    }
  };

  const eventHandler = async ({
    event,
  }: {
    event: { type: string; properties?: unknown };
  }): Promise<void> => {
    const props = event.properties as Record<string, unknown> | undefined;
    if (event.type === "session.deleted") {
      const sessionInfo = props?.info as { id?: string } | undefined;
      if (sessionInfo?.id) tokenCache.delete(sessionInfo.id);
      return;
    }
    if (event.type === "message.updated") {
      const info = props?.info as
        | {
            role?: string;
            sessionID?: string;
            providerID?: string;
            modelID?: string;
            finish?: boolean;
            tokens?: TokenInfo;
          }
        | undefined;
      if (!info || info.role !== "assistant" || !info.finish || !info.sessionID)
        return;
      if (!info.providerID || !info.tokens) return;
      const existing = tokenCache.get(info.sessionID);
      const warned80 = existing?.warned80 ?? false;
      const warned90 = existing?.warned90 ?? false;
      tokenCache.set(info.sessionID, {
        providerID: info.providerID,
        modelID: info.modelID ?? "",
        tokens: info.tokens,
        warned80,
        warned90,
      });
      const totalTokens = resolveActualContextLimit(
        info.providerID,
        info.modelID ?? "",
        modelCacheState,
      );
      if (totalTokens === null) return;
      const usedTokens =
        (info.tokens.input ?? 0) + (info.tokens.cache?.read ?? 0);
      const usagePercentage = usedTokens / totalTokens;
      const cached = tokenCache.get(info.sessionID);
      if (!cached) return;
      if (usagePercentage >= warn90 && !cached.warned90) {
        cached.warned90 = true;
        await showWarning(
          info.sessionID,
          warn90,
          "Token Budget Warning (90%)",
          `Context at ${(usagePercentage * 100).toFixed(1)}%. Consider new session.`,
        );
      } else if (usagePercentage >= warn80 && !cached.warned80) {
        cached.warned80 = true;
        await showWarning(
          info.sessionID,
          warn80,
          "Token Budget Warning (80%)",
          `Context at ${(usagePercentage * 100).toFixed(1)}%. Auto-compaction may trigger.`,
        );
      }
    }
  };

  return {
    "tool.execute.before": toolExecuteBefore,
    "tool.execute.after": toolExecuteAfter,
    event: eventHandler,
  };
}

export type TokenBudgetHook = ReturnType<typeof createTokenBudgetHook>;
