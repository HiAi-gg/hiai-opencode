/**
 * hiai-opencode config barrel
 *
 * Re-exports config types and the hiai-opencode config schema.
 * The canonical config type is HiaiOpenCodeConfig.
 */

// Original platform config loading
export { loadConfig, resolveEnvVars, resolveMcpEnv } from "./loader.js";
export { HiaiOpencodeConfigSchema } from "./platform-schema.js";
export { defaultConfig } from "./defaults.js";
export type {
  HiaiOpencodeConfig,
  AgentConfig,
  CategoryConfig,
  McpServerConfig,
  LspServerConfig,
  Subtask2Config,
  SkillsConfig as PlatformSkillsConfig,
  PermissionsConfig as PlatformPermissionsConfig,
} from "./types.js";

// hiai-opencode config schema (canonical)
export { HiaiOpenCodeConfigSchema } from "./schema/hiai-opencode-config.js";
export type { HiaiOpenCodeConfig } from "./schema/hiai-opencode-config.js";

// Agent types
export type { AgentName } from "./schema/agent-names.js";
export type {
  AgentOverrideConfig,
  AgentOverrides,
} from "./schema/agent-overrides.js";
export type { BuiltinSkillName } from "./schema/agent-names.js";

// Hook types
export type { HookName } from "./schema/hooks.js";

// Category types
export type {
  CategoryConfig as OhMyCategoryConfig,
  CategoriesConfig,
  BuiltinCategoryName,
} from "./schema/categories.js";

// MCP types
export type { McpName, AnyMcpName } from "../mcp/types.js";

// Command types
export type { BuiltinCommandName } from "./schema/commands.js";

// Tmux types
export type { TmuxConfig, TmuxLayout, TmuxIsolation } from "./schema/tmux.js";

// Skill types
export type { SkillsConfig, SkillDefinition } from "./schema/skills.js";

// Other config sub-types
export type { BackgroundTaskConfig } from "./schema/background-task.js";
export type { BabysittingConfig } from "./schema/babysitting.js";
export type { ExperimentalConfig } from "./schema/experimental.js";
export type { NotificationConfig } from "./schema/notification.js";
export type { RuntimeFallbackConfig } from "./schema/runtime-fallback.js";
export type {
  FallbackModelObject,
  FallbackModels,
} from "./schema/fallback-models.js";
export type { BobAgentConfig } from "./schema/bob-agent.js";
export type { StartWorkConfig } from "./schema/start-work.js";
export type { RalphLoopConfig } from "./schema/ralph-loop.js";
export type { DynamicContextPruningConfig } from "./schema/dynamic-context-pruning.js";
export type { GitMasterConfig } from "./schema/git-master.js";
export type { ModelCapabilitiesConfig } from "./schema/model-capabilities.js";
export type { FastApplyConfig } from "./schema/fast-apply.js";
