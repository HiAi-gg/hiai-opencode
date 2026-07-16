import type { PluginInput } from "@opencode-ai/plugin";
import { logger } from "../../util/log";

interface SessionProgress {
  toolCalls: number;
  lastSignature?: string;
  consecutiveCount: number;
}

export interface CircuitBreakerConfig {
  concurrency_limit?: number;
  stale_timeout_ms?: number;
  circuit_breaker?: {
    enabled?: boolean;
    max_tool_calls?: number;
    consecutive_threshold?: number;
  };
}

function stable(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stable);
  return Object.fromEntries(
    Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => [key, stable((value as Record<string, unknown>)[key])]),
  );
}

/**
 * Circuit-breaker state only. Native OpenCode Task owns background lifecycle,
 * so this class intentionally has no task registry, polling or parent prompts.
 */
export class BackgroundManager {
  private client: PluginInput["client"] | null = null;
  private sessions = new Map<string, SessionProgress>();
  private circuitBreaker = {
    enabled: true,
    maxToolCalls: 4000,
    consecutiveThreshold: 20,
  };

  constructor(config?: CircuitBreakerConfig) {
    if (
      config?.concurrency_limit !== undefined ||
      config?.stale_timeout_ms !== undefined
    ) {
      logger.warn(
        "[hiai-opencode] background_manager.concurrency_limit and stale_timeout_ms are deprecated no-ops; native OpenCode Task manages background work",
      );
    }
    if (config?.circuit_breaker) {
      this.circuitBreaker = {
        enabled: config.circuit_breaker.enabled ?? this.circuitBreaker.enabled,
        maxToolCalls:
          config.circuit_breaker.max_tool_calls ??
          this.circuitBreaker.maxToolCalls,
        consecutiveThreshold:
          config.circuit_breaker.consecutive_threshold ??
          this.circuitBreaker.consecutiveThreshold,
      };
    }
  }

  setClient(client: PluginInput["client"]): void {
    this.client = client;
  }

  recordSessionToolCall(
    sessionID: string,
    toolName: string,
    toolInput?: Record<string, unknown>,
  ): void {
    if (!this.circuitBreaker.enabled || !sessionID) return;
    const signature = `${toolName}::${JSON.stringify(stable(toolInput ?? {}))}`;
    const state = this.sessions.get(sessionID) ?? {
      toolCalls: 0,
      consecutiveCount: 0,
    };
    state.toolCalls += 1;
    state.consecutiveCount =
      state.lastSignature === signature ? state.consecutiveCount + 1 : 1;
    state.lastSignature = signature;
    this.sessions.set(sessionID, state);

    const reason =
      state.toolCalls >= this.circuitBreaker.maxToolCalls
        ? `Circuit breaker: ${state.toolCalls} total tool calls`
        : state.consecutiveCount >= this.circuitBreaker.consecutiveThreshold
          ? `Circuit breaker: ${state.consecutiveCount} consecutive ${toolName} calls`
          : undefined;
    if (!reason) return;
    logger.log(
      `[hiai-opencode] [circuit-breaker] aborting ${sessionID.slice(0, 8)} — ${reason}`,
    );
    this.sessions.delete(sessionID);
    this.client?.session.abort({ path: { id: sessionID } }).catch(() => {});
  }

  getSessionProgress(sessionID: string): Readonly<SessionProgress> | undefined {
    return this.sessions.get(sessionID);
  }
  dispose(): void {
    this.sessions.clear();
    this.client = null;
  }
}
