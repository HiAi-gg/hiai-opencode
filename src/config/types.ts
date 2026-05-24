/**
 * hiai-opencode config types
 */

export interface AgentConfig {
  model: string;
  description?: string;
}

export type ModelRecommendation =
  | "xhigh"
  | "high"
  | "middle"
  | "fast"
  | "vision"
  | "writing"
  | "design";

export type ModelSlotConfig =
  | string
  | {
      model: string;
      recommended?: ModelRecommendation;
    };

export interface ModelSlotsConfig {
  bob?: ModelSlotConfig;
  coder?: ModelSlotConfig;
  strategist?: ModelSlotConfig;
  manager?: ModelSlotConfig;  // formerly "manager" - orchestrator/delegate role
  critic?: ModelSlotConfig;
  designer?: ModelSlotConfig;
  researcher?: ModelSlotConfig;
  writer?: ModelSlotConfig;   // formerly "brainstormer" - copy/content/SEO
  vision?: ModelSlotConfig;
  sub?: ModelSlotConfig;
}

// Canonical 12-agent model exposed by schema/default config.
// Note: "guard" renamed to "manager", "brainstormer" renamed to "writer"
export const CANONICAL_AGENT_NAMES = [
  "bob",
  "manager",
  "strategist",
  "critic",
  "coder",
  "designer",
  "sub",
  "researcher",
  "vision",
  "quality-guardian",
  "writer",
  "agent-skills",
] as const;

export type CanonicalAgentName = (typeof CANONICAL_AGENT_NAMES)[number];

// Backward-compatible input aliases. These should only be used at config boundaries.
export const LEGACY_AGENT_ALIAS_NAMES = [
  "general",
  "zoe",
  "build",
  "pre-plan",
  "multimodal",
  "ui",
  "logician",
  "librarian",
  "explore",
  "code-reviewer",
  "systematic-debugger",
  "mindmodel",
  "ledger-creator",
  "bootstrapper",
  "project-initializer",
  // Legacy agent name renames
  "guard",
  "brainstormer",
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
  multimodal: "vision",
  ui: "vision",
  logician: "strategist",
  librarian: "researcher",
  explore: "researcher",
  "code-reviewer": "critic",
  "systematic-debugger": "critic",
  mindmodel: "researcher",
  "ledger-creator": "researcher",
  bootstrapper: "researcher",
  "project-initializer": "researcher",
  // Legacy renames
  guard: "manager",
  brainstormer: "writer",
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
  model?: string;
  variant?: string;
  description?: string;
  fallbackChain?: FallbackEntry[];
}

export interface McpServerConfig {
  enabled: boolean;
  type?: "remote" | "local";
  provider?: "exa" | "tavily";
  url?: string;
  headers?: Record<string, string>;
  command?: string[];
  timeout?: number;
  environment?: Record<string, string>;
  pythonPath?: string;
  // CLI tool notes: agentBrowser and firecrawl-cli are CLI tools surfaced via skill system,
  // not traditional MCP servers. They appear in mcp config for display/control purposes.
  autoInstall?: boolean;
  sessionPrefix?: string;
  maxBatchCommands?: number;
}

export interface LspServerConfig {
  enabled?: boolean;
  command?: string[];
  extensions?: string[];
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
  models?: ModelSlotsConfig;
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
