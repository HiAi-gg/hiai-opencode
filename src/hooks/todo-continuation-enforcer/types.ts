import type { BackgroundManager } from "../../features/background-agent"
import type { ToolPermission } from "../../features/hook-message-injector"

export interface TodoContinuationEnforcerOptions {
  backgroundManager?: BackgroundManager
  skipAgents?: string[]
  isContinuationStopped?: (sessionID: string) => boolean
  /**
   * If set to N >= 1, the enforcer will auto-start ralph-loop on a session that
   * has N or more open todos and no active loop. 0/undefined disables.
   */
  autoLoopThreshold?: number
  /**
   * Lazy callback to start ralph-loop. Lazy because ralph-loop is created
   * after the enforcer in the plugin wiring.
   */
  startRalphLoop?: (
    sessionID: string,
    prompt: string,
    options?: { ultrawork?: boolean },
  ) => boolean
  /**
   * Lazy callback returning true if ralph-loop is currently active for the
   * session. Used to avoid double-injection.
   */
  isRalphLoopActive?: (sessionID: string) => boolean
}

export interface TodoContinuationEnforcer {
  handler: (input: { event: { type: string; properties?: unknown } }) => Promise<void>
  markRecovering: (sessionID: string) => void
  markRecoveryComplete: (sessionID: string) => void
  cancelAllCountdowns: () => void
  dispose: () => void
}

export interface Todo {
  content: string;
  status: string;
  priority: string;
  id?: string;
}

export interface SessionState {
  countdownTimer?: ReturnType<typeof setTimeout>
  countdownInterval?: ReturnType<typeof setInterval>
  isRecovering?: boolean
  wasCancelled?: boolean
  tokenLimitDetected?: boolean
  countdownStartedAt?: number
  abortDetectedAt?: number
  lastIncompleteCount?: number
  lastInjectedAt?: number
  awaitingPostInjectionProgressCheck?: boolean
  inFlight?: boolean
  stagnationCount: number
  consecutiveFailures: number
  recentCompactionAt?: number
  recentCompactionEpoch?: number
  acknowledgedCompactionEpoch?: number
  autoLoopStarted?: boolean
}

export interface MessageInfo {
  id?: string
  role?: string
  error?: { name?: string; data?: unknown }
  agent?: string
  model?: { providerID: string; modelID: string; variant?: string }
  providerID?: string
  modelID?: string
  tools?: Record<string, ToolPermission>
}

export interface MessageWithInfo {
  info?: MessageInfo
  parts?: Array<{ type?: string }>
}

export interface ResolvedMessageInfo {
  agent?: string
  model?: { providerID: string; modelID: string; variant?: string }
  tools?: Record<string, ToolPermission>
}

export interface ResolveLatestMessageInfoResult {
  resolvedInfo?: ResolvedMessageInfo
  encounteredCompaction: boolean
  latestMessageWasCompaction: boolean
}

export interface ContinuationProgressOptions {
  allowActivityProgress?: boolean
}
