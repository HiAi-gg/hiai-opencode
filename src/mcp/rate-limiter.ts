/**
 * MCP Rate Limiter with Circuit Breaker
 *
 * Provides per-MCP rate limiting with configurable:
 * - maxRequestsPerMinute
 * - maxTokensPerDay (approximated via request counting)
 *
 * Circuit breaker trips after 5 consecutive failures, resets after 60 seconds.
 */

export interface RateLimiterConfig {
  maxRequestsPerMinute: number;
  maxTokensPerDay?: number; // optional - approximated with request counting
  circuitBreakerThreshold?: number; // consecutive failures before tripping (default: 5)
  circuitBreakerResetMs?: number; // reset timeout in ms (default: 60000)
}

interface CircuitBreakerState {
  failures: number;
  isOpen: boolean;
  openedAt: number | null;
}

interface RequestRecord {
  timestamp: number;
}

export class McpRateLimiter {
  private requestLog = new Map<string, RequestRecord[]>();
  private circuitBreaker = new Map<string, CircuitBreakerState>();

  private readonly config: Required<RateLimiterConfig>;

  constructor(config: RateLimiterConfig) {
    this.config = {
      maxRequestsPerMinute: config.maxRequestsPerMinute,
      maxTokensPerDay: config.maxTokensPerDay ?? 0,
      circuitBreakerThreshold: config.circuitBreakerThreshold ?? 5,
      circuitBreakerResetMs: config.circuitBreakerResetMs ?? 60000,
    };
  }

  /**
   * Check if a request to the given MCP is allowed under rate limits.
   * Returns an object with allowed flag and reset time if not allowed.
   */
  canMakeRequest(mcpName: string): {
    allowed: boolean;
    resetAt?: number;
    retryAfterMs?: number;
  } {
    // Check circuit breaker first
    const cbState = this.getCircuitBreakerState(mcpName);
    if (cbState.isOpen) {
      const resetAt =
        (cbState.openedAt ?? 0) + this.config.circuitBreakerResetMs;
      const now = Date.now();

      if (now < resetAt) {
        return {
          allowed: false,
          resetAt,
          retryAfterMs: resetAt - now,
        };
      }

      // Reset circuit breaker after timeout
      this.circuitBreaker.set(mcpName, {
        failures: 0,
        isOpen: false,
        openedAt: null,
      });
    }

    // Check per-minute rate limit
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    const requests = this.requestLog.get(mcpName) ?? [];
    const recentRequests = requests.filter((r) => r.timestamp > oneMinuteAgo);

    if (recentRequests.length >= this.config.maxRequestsPerMinute) {
      // Find the oldest recent request to calculate reset time
      const oldestRecent = recentRequests[0];
      const resetAt = oldestRecent.timestamp + 60000;
      const retryAfterMs = Math.max(0, resetAt - now);

      return { allowed: false, resetAt, retryAfterMs };
    }

    return { allowed: true };
  }

  /**
   * Record a successful request to update rate tracking.
   */
  recordSuccess(mcpName: string): void {
    const now = Date.now();

    // Get or create request log
    let requests = this.requestLog.get(mcpName);
    if (!requests) {
      requests = [];
      this.requestLog.set(mcpName, requests);
    }

    // Add new request
    requests.push({ timestamp: now });

    // Prune old entries (older than 1 minute)
    const oneMinuteAgo = now - 60000;

    this.requestLog.set(
      mcpName,
      requests.filter((r) => r.timestamp > oneMinuteAgo),
    );

    // Reset circuit breaker on success
    const cb = this.circuitBreaker.get(mcpName);
    if (cb?.isOpen) {
      this.circuitBreaker.set(mcpName, {
        failures: 0,
        isOpen: false,
        openedAt: null,
      });
    }
  }

  /**
   * Record a failed request. After 5 consecutive failures, the circuit breaker trips.
   */
  recordFailure(mcpName: string): void {
    let cb = this.circuitBreaker.get(mcpName);

    if (!cb) {
      cb = { failures: 0, isOpen: false, openedAt: null };
    }

    cb.failures++;

    if (cb.failures >= this.config.circuitBreakerThreshold) {
      cb.isOpen = true;
      cb.openedAt = Date.now();
    }

    this.circuitBreaker.set(mcpName, cb);
  }

  /**
   * Get current rate limit status for an MCP.
   */
  getStatus(mcpName: string): {
    requestsLastMinute: number;
    limitPerMinute: number;
    circuitBreakerOpen: boolean;
    consecutiveFailures: number;
  } {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    const requests = this.requestLog.get(mcpName) ?? [];
    const recentCount = requests.filter(
      (r) => r.timestamp > oneMinuteAgo,
    ).length;

    const cb = this.circuitBreaker.get(mcpName);

    return {
      requestsLastMinute: recentCount,
      limitPerMinute: this.config.maxRequestsPerMinute,
      circuitBreakerOpen: cb?.isOpen ?? false,
      consecutiveFailures: cb?.failures ?? 0,
    };
  }

  /**
   * Build a clear quota exhaustion error message.
   */
  buildQuotaExhaustedError(
    mcpName: string,
    limitType: "rate" | "circuit_breaker",
  ): string {
    const status = this.getStatus(mcpName);

    switch (limitType) {
      case "circuit_breaker":
        return (
          `MCP "${mcpName}" circuit breaker is open due to ${status.consecutiveFailures} consecutive failures. ` +
          `The service will automatically reset in ${this.config.circuitBreakerResetMs / 1000} seconds. ` +
          `This may indicate a service outage or high error rate. ` +
          `Check the MCP server status before retrying.`
        );

      case "rate":
        return (
          `MCP "${mcpName}" rate limit exceeded. ` +
          `Current usage: ${status.requestsLastMinute}/${this.config.maxRequestsPerMinute} requests per minute. ` +
          `Wait before retrying or consider reducing request frequency.`
        );
    }
  }

  /**
   * Reset all rate limit state for an MCP.
   */
  reset(mcpName: string): void {
    this.requestLog.delete(mcpName);
    this.circuitBreaker.delete(mcpName);
  }

  /**
   * Reset all rate limiters globally.
   */
  resetAll(): void {
    this.requestLog.clear();
    this.circuitBreaker.clear();
  }

  private getCircuitBreakerState(mcpName: string): CircuitBreakerState {
    return (
      this.circuitBreaker.get(mcpName) ?? {
        failures: 0,
        isOpen: false,
        openedAt: null,
      }
    );
  }
}

// Default rate limiter instances for common MCPs
export const defaultRateLimiters = {
  // Default limits - can be overridden per MCP in hiai-opencode.json
  stitch: new McpRateLimiter({ maxRequestsPerMinute: 30 }),
  context7: new McpRateLimiter({ maxRequestsPerMinute: 60 }),
  grep_app: new McpRateLimiter({ maxRequestsPerMinute: 30 }),
  "sequential-thinking": new McpRateLimiter({ maxRequestsPerMinute: 120 }),
  mempalace: new McpRateLimiter({ maxRequestsPerMinute: 60 }),
};

// Factory function to create a rate limiter for any MCP
export function createMcpRateLimiter(
  _mcpName: string,
  config?: Partial<RateLimiterConfig>,
): McpRateLimiter {
  return new McpRateLimiter({
    maxRequestsPerMinute: config?.maxRequestsPerMinute ?? 60,
    maxTokensPerDay: config?.maxTokensPerDay,
    circuitBreakerThreshold: config?.circuitBreakerThreshold ?? 5,
    circuitBreakerResetMs: config?.circuitBreakerResetMs ?? 60000,
  });
}
