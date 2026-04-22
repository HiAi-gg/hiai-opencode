/**
 * hiai-opencode.json Zod schema validation
 */
import { z } from "zod";

export const AgentConfigSchema = z.object({
  model: z.string(),
  description: z.string().optional(),
});

export const FallbackEntrySchema = z.object({
  providers: z.array(z.string()),
  model: z.string(),
  variant: z.string().optional(),
  reasoningEffort: z.string().optional(),
  temperature: z.number().optional(),
  top_p: z.number().optional(),
  maxTokens: z.number().optional(),
  thinking: z.object({
    type: z.enum(["enabled", "disabled"]),
    budgetTokens: z.number().optional(),
  }).optional(),
});

export const ModelRequirementSchema = z.object({
  fallbackChain: z.array(FallbackEntrySchema),
  variant: z.string().optional(),
  requiresModel: z.string().optional(),
  requiresAnyModel: z.boolean().optional(),
  requiresProvider: z.array(z.string()).optional(),
});

export const CategoryConfigSchema = z.object({
  model: z.string(),
  variant: z.string().optional(),
  description: z.string().optional(),
  fallbackChain: z.array(FallbackEntrySchema).optional(),
});

export const McpServerConfigSchema = z.object({
  enabled: z.boolean().default(true),
  type: z.enum(["remote", "local"]).optional(),
  url: z.string().optional(),
  command: z.array(z.string()).optional(),
  timeout: z.number().optional(),
  environment: z.record(z.string(), z.string()).optional(),
});

export const LspServerConfigSchema = z.object({
  command: z.array(z.string()),
  extensions: z.array(z.string()),
  initialization: z.record(z.string(), z.unknown()).optional(),
});

export const Subtask2ConfigSchema = z.object({
  replace_generic: z.boolean().optional(),
  generic_return: z.string().nullable().optional(),
});

export const SkillsConfigSchema = z.object({
  enabled: z.boolean().optional(),
  disabled: z.array(z.string()).optional(),
});

export const PermissionsConfigSchema = z.object({
  read: z.record(z.string(), z.string()).optional(),
  edit: z.record(z.string(), z.string()).optional(),
  bash: z.record(z.string(), z.string()).optional(),
  deny_paths: z.array(z.string()).optional(),
  doom_loop: z.enum(["allow", "deny"]).optional(),
  question: z.enum(["allow", "deny"]).optional(),
  plan_enter: z.enum(["allow", "deny"]).optional(),
  plan_exit: z.enum(["allow", "deny"]).optional(),
  list: z.enum(["allow", "deny"]).optional(),
  glob: z.enum(["allow", "deny"]).optional(),
  grep: z.enum(["allow", "deny"]).optional(),
  skill: z.enum(["allow", "deny"]).optional(),
  task: z.enum(["allow", "deny"]).optional(),
  todoread: z.enum(["allow", "deny"]).optional(),
  todowrite: z.enum(["allow", "deny"]).optional(),
  webfetch: z.enum(["allow", "deny"]).optional(),
  websearch: z.enum(["allow", "deny"]).optional(),
  codesearch: z.enum(["allow", "deny"]).optional(),
  external_directory: z.record(z.string(), z.string()).optional(),
  ["*"]: z.record(z.string(), z.enum(["allow", "deny"])).optional(),
});

export const AuthKeysSchema = z.object({
  googleSearch: z.string().optional(),
  openai: z.string().optional(),
  openrouter: z.string().optional(),
  stitch: z.string().optional(),
  firecrawl: z.string().optional(),
});

export const OllamaConfigSchema = z.object({
  enabled: z.boolean().default(false),
  model: z.string().default("qwen3.5:4b"),
  baseUrl: z.string().default("http://localhost:11434"),
  purpose: z.enum(["verification", "helper", "fallback"]).default("helper"),
});

export const ModelFamilySchema = z.object({
  family: z.string(),
  includes: z.array(z.string()).optional(),
  pattern: z.string().optional(),
  variants: z.array(z.string()).optional(),
  reasoningEfforts: z.array(z.string()).optional(),
  supportsThinking: z.boolean().optional(),
});

const AgentsConfigSchema = z.object({
  // Canonical 12 agents
  bob: AgentConfigSchema.optional(),
  guard: AgentConfigSchema.optional(),
  strategist: AgentConfigSchema.optional(),
  critic: AgentConfigSchema.optional(),
  coder: AgentConfigSchema.optional(),
  sub: AgentConfigSchema.optional(),
  researcher: AgentConfigSchema.optional(),
  multimodal: AgentConfigSchema.optional(),
  "quality-guardian": AgentConfigSchema.optional(),
  "platform-manager": AgentConfigSchema.optional(),
  brainstormer: AgentConfigSchema.optional(),
  "agent-skills": AgentConfigSchema.optional(),
  // Legacy aliases kept for config compatibility only
  general: AgentConfigSchema.optional(),
  zoe: AgentConfigSchema.optional(),
  build: AgentConfigSchema.optional(),
  "pre-plan": AgentConfigSchema.optional(),
  logician: AgentConfigSchema.optional(),
  librarian: AgentConfigSchema.optional(),
  explore: AgentConfigSchema.optional(),
  ui: AgentConfigSchema.optional(),
  "code-reviewer": AgentConfigSchema.optional(),
  "systematic-debugger": AgentConfigSchema.optional(),
  mindmodel: AgentConfigSchema.optional(),
  "ledger-creator": AgentConfigSchema.optional(),
  bootstrapper: AgentConfigSchema.optional(),
  "project-initializer": AgentConfigSchema.optional(),
}).catchall(AgentConfigSchema);

const AgentRequirementsConfigSchema = z.object({
  // Canonical 12 agents
  bob: ModelRequirementSchema.optional(),
  guard: ModelRequirementSchema.optional(),
  strategist: ModelRequirementSchema.optional(),
  critic: ModelRequirementSchema.optional(),
  coder: ModelRequirementSchema.optional(),
  sub: ModelRequirementSchema.optional(),
  researcher: ModelRequirementSchema.optional(),
  multimodal: ModelRequirementSchema.optional(),
  "quality-guardian": ModelRequirementSchema.optional(),
  "platform-manager": ModelRequirementSchema.optional(),
  brainstormer: ModelRequirementSchema.optional(),
  "agent-skills": ModelRequirementSchema.optional(),
  // Legacy aliases kept for config compatibility only
  general: ModelRequirementSchema.optional(),
  zoe: ModelRequirementSchema.optional(),
  build: ModelRequirementSchema.optional(),
  "pre-plan": ModelRequirementSchema.optional(),
  logician: ModelRequirementSchema.optional(),
  librarian: ModelRequirementSchema.optional(),
  explore: ModelRequirementSchema.optional(),
  ui: ModelRequirementSchema.optional(),
  "code-reviewer": ModelRequirementSchema.optional(),
  "systematic-debugger": ModelRequirementSchema.optional(),
  mindmodel: ModelRequirementSchema.optional(),
  "ledger-creator": ModelRequirementSchema.optional(),
  bootstrapper: ModelRequirementSchema.optional(),
  "project-initializer": ModelRequirementSchema.optional(),
}).catchall(ModelRequirementSchema);

export const HiaiOpencodeConfigSchema = z.object({
  $schema: z.string().optional(),
  agents: AgentsConfigSchema.optional(),
  agentRequirements: AgentRequirementsConfigSchema.optional(),
  categories: z.record(z.string(), CategoryConfigSchema).optional(),
  categoryRequirements: z.record(z.string(), ModelRequirementSchema).optional(),
  claudeModelAliases: z.record(z.string(), z.string()).optional(),
  modelFamilies: z.array(ModelFamilySchema).optional(),
  mcp: z.record(z.string(), McpServerConfigSchema).optional(),
  lsp: z.record(z.string(), LspServerConfigSchema).optional(),
  subtask2: Subtask2ConfigSchema.optional(),
  skills: SkillsConfigSchema.optional(),
  permissions: PermissionsConfigSchema.optional(),
  auth: AuthKeysSchema.optional(),
  ollama: OllamaConfigSchema.optional(),
});

export type HiaiOpencodeConfigValidated = z.infer<typeof HiaiOpencodeConfigSchema>;
