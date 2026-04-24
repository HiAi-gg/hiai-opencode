/**
 * hiai-opencode config types
 */

export interface AgentConfig {
  model: string;
  description?: string;
}

// Canonical 12-agent model exposed by schema/default config.
export const CANONICAL_AGENT_NAMES = [
  "bob",
  "guard",
  "strategist",
  "critic",
  "coder",
  "designer",
  "sub",
  "researcher",
  "multimodal",
  "quality-guardian",
  "platform-manager",
  "brainstormer",
  "agent-skills",
] as const;

export type CanonicalAgentName = (typeof CANONICAL_AGENT_NAMES)[number];

// Backward-compatible input aliases. These should only be used at config boundaries.
export const LEGACY_AGENT_ALIAS_NAMES = [
  "general",
  "zoe",
  "build",
  "pre-plan",
  "manager",
  "vision",
  "logician",
  "librarian",
  "explore",
  "ui",
  "code-reviewer",
  "systematic-debugger",
  "mindmodel",
  "ledger-creator",
  "bootstrapper",
  "project-initializer",
] as const;

export type LegacyAgentAliasName = (typeof LEGACY_AGENT_ALIAS_NAMES)[number];

export const LEGACY_AGENT_ALIAS_TO_CANONICAL: Record<
  LegacyAgentAliasName,
  CanonicalAgentName
> = {
  general: "bob",
  zoe: "bob",
  build: "bob",
  "pre-plan": "strategist",
  manager: "platform-manager",
  vision: "multimodal",
  logician: "strategist",
  librarian: "researcher",
  explore: "researcher",
  ui: "multimodal",
  "code-reviewer": "critic",
  "systematic-debugger": "critic",
  mindmodel: "platform-manager",
  "ledger-creator": "platform-manager",
  bootstrapper: "platform-manager",
  "project-initializer": "platform-manager",
};

export type KnownAgentName = CanonicalAgentName | LegacyAgentAliasName;

export interface FallbackEntry {
  providers: string[];
  model: string;
  variant?: string;
  reasoningEffort?: string;
  temperature?: number;
  top_p?: number;
  maxTokens?: number;
  thinking?: { type: "enabled" | "disabled"; budgetTokens?: number };
}

export interface ModelRequirement {
  fallbackChain: FallbackEntry[];
  variant?: string;
  requiresModel?: string;
  requiresAnyModel?: boolean;
  requiresProvider?: string[];
}

// Keep extensibility for custom agent ids while surfacing canonical names in types.
export type AgentConfigMap = Partial<Record<KnownAgentName, AgentConfig>> &
  Record<string, AgentConfig>;
export type AgentRequirementMap = Partial<Record<KnownAgentName, ModelRequirement>> &
  Record<string, ModelRequirement>;

export interface HeuristicModelFamilyDefinition {
  family: string;
  includes?: string[];
  pattern?: string; // Stored as string in JSON, converted to RegExp in code
  variants?: string[];
  reasoningEfforts?: string[];
  supportsThinking?: boolean;
}

export interface CategoryConfig {
  model: string;
  variant?: string;
  description?: string;
  fallbackChain?: FallbackEntry[];
}

export interface McpServerConfig {
  enabled: boolean;
  type?: "remote" | "local";
  url?: string;
  headers?: Record<string, string>;
  command?: string[];
  timeout?: number;
  environment?: Record<string, string>;
}

export interface LspServerConfig {
  command: string[];
  extensions: string[];
  initialization?: Record<string, unknown>;
}

export interface Subtask2Config {
  replace_generic?: boolean;
  generic_return?: string | null;
}

export interface SkillsConfig {
  enabled?: boolean;
  disabled?: string[];
}

export interface SkillDiscoveryConfig {
  config_sources?: boolean;
  project_opencode?: boolean;
  global_opencode?: boolean;
  project_claude?: boolean;
  global_claude?: boolean;
  project_agents?: boolean;
  global_agents?: boolean;
}

export interface PermissionsConfig {
  read?: Record<string, string>;
  edit?: Record<string, string>;
  bash?: Record<string, string>;
  deny_paths?: string[];
}

export interface AuthKeys {
  googleSearch?: string;
  openai?: string;
  openrouter?: string;
  stitch?: string;
  firecrawl?: string;
  context7?: string;
}

export interface OllamaConfig {
  enabled: boolean;
  model: string;
  baseUrl?: string;
  purpose?: "verification" | "helper" | "fallback";
}

export interface HiaiOpencodeConfig {
  $schema?: string;
  agents?: AgentConfigMap;
  agentRequirements?: AgentRequirementMap;
  categories?: Record<string, CategoryConfig>;
  categoryRequirements?: Record<string, ModelRequirement>;
  modelFamilies?: HeuristicModelFamilyDefinition[];
  mcp?: Record<string, McpServerConfig>;
  lsp?: Record<string, LspServerConfig>;
  subtask2?: Subtask2Config;
  skills?: SkillsConfig;
  skill_discovery?: SkillDiscoveryConfig;
  permissions?: PermissionsConfig;
  auth?: AuthKeys;
  ollama?: OllamaConfig;
}
