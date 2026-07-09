export type AgentMode = "primary" | "subagent" | "all";

export interface AgentConfig {
  name: string;
  description: string;
  mode: AgentMode;
  model?: string;
  prompt: string;
  hidden?: boolean;
  temperature?: number;
  thinking?: { type: string; budgetTokens?: number };
  delegate_to?: string[];
}

export interface AgentOverrides {
  model?: string;
  prompt_append?: string;
}

export interface CavemanConfig {
  enabled: boolean;
  level?: "minimal" | "balanced" | "full";
  bob_internal?: boolean;
  bob_to_agents?: boolean;
  agents_to_bob?: boolean;
  final_user_output?: "normal";
  target_agents?: string[];
  exclude_agents?: string[];
  min_messages_to_compress?: number;
}

export interface CompletionConfig {
  enabled: boolean;
  max_auto_continues: number;
  require_critic: boolean;
  ui_globs: string[];
  reset_on_user_message: boolean;
}

export interface LspServerConfig {
  enabled?: boolean;
  command?: string;
  args?: string[];
  initializationOptions?: Record<string, unknown>;
  env?: Record<string, string>;
}

export interface BobConfig {
  models?: Record<string, { model: string; recommended?: string }>;
  mcp?: Record<string, { enabled: boolean }>;
  lsp?: Record<string, LspServerConfig>;
  agent_restrictions?: Record<string, Record<string, boolean>>;
  hooks?: { disabled?: string[] };
  tools?: { disabled?: string[] };
  agent_overrides?: Record<string, AgentOverrides>;
  disabled_agents?: string[];
  disabled_hooks?: string[];
  auth?: Record<string, string>;
  background_manager?: {
    concurrency_limit?: number;
    stale_timeout_ms?: number;
    circuit_breaker?: {
      enabled?: boolean;
      max_tool_calls?: number;
      consecutive_threshold?: number;
    };
  };
  telemetry?: {
    enabled: boolean;
    endpoint?: string;
    serviceName?: string;
    sampleRate?: number;
  };
  completion?: CompletionConfig;
  caveman?: CavemanConfig;
  dream?: { auto?: boolean; interval_days?: number; model?: string };
  distill?: { auto?: boolean; interval_days?: number; model?: string };
}

export interface ClosureBlock {
  reasoning: string;
  evidence: string[];
  readiness: "accept" | "reject" | "done";
}

export type HookSet = import("@opencode-ai/plugin").Hooks;
