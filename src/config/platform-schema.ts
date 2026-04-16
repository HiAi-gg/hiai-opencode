/**
 * hiai-opencode.json Zod schema validation
 */
import { z } from "zod";

export const AgentConfigSchema = z.object({
  model: z.string(),
  description: z.string().optional(),
});

export const CategoryConfigSchema = z.object({
  model: z.string(),
  variant: z.string().optional(),
  description: z.string().optional(),
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

export const HiaiOpencodeConfigSchema = z.object({
  $schema: z.string().optional(),
  agents: z.record(z.string(), AgentConfigSchema).optional(),
  categories: z.record(z.string(), CategoryConfigSchema).optional(),
  mcp: z.record(z.string(), McpServerConfigSchema).optional(),
  lsp: z.record(z.string(), LspServerConfigSchema).optional(),
  subtask2: Subtask2ConfigSchema.optional(),
  skills: SkillsConfigSchema.optional(),
  permissions: PermissionsConfigSchema.optional(),
  auth: AuthKeysSchema.optional(),
  ollama: OllamaConfigSchema.optional(),
});

export type HiaiOpencodeConfigValidated = z.infer<typeof HiaiOpencodeConfigSchema>;
