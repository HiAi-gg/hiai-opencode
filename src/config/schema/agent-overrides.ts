import { z } from "zod"
import { FallbackModelsSchema } from "./fallback-models"
import { AgentPermissionSchema } from "./internal/permission"

export const AgentOverrideConfigSchema = z.object({
  /** @deprecated Use `category` instead. Model is inherited from category defaults. */
  model: z.string().optional(),
  fallback_models: FallbackModelsSchema.optional(),
  variant: z.string().optional(),
  /** Category name to inherit model and other settings from CategoryConfig */
  category: z.string().optional(),
  /** Skill names to inject into agent prompt */
  skills: z.array(z.string()).optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  prompt: z.string().optional(),
  /** Text to append to agent prompt. Supports file:// URIs (file:///abs, file://./rel, file://~/home) */
  prompt_append: z.string().optional(),
  tools: z.record(z.string(), z.boolean()).optional(),
  disable: z.boolean().optional(),
  description: z.string().optional(),
  mode: z.enum(["subagent", "primary", "all"]).optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  permission: AgentPermissionSchema.optional(),
  /** Maximum tokens for response. Passed directly to OpenCode SDK. */
  maxTokens: z.number().optional(),
  /** Extended thinking configuration (Anthropic). Overrides category and default settings. */
  thinking: z
    .object({
      type: z.enum(["enabled", "disabled"]),
      budgetTokens: z.number().optional(),
    })
    .optional(),
  /** Reasoning effort level (OpenAI). Overrides category and default settings. */
  reasoningEffort: z.enum(["none", "minimal", "low", "medium", "high", "xhigh"]).optional(),
  /** Text verbosity level. */
  textVerbosity: z.enum(["low", "medium", "high"]).optional(),
  /** Provider-specific options. Passed directly to OpenCode SDK. */
  providerOptions: z.record(z.string(), z.unknown()).optional(),
  /** Per-message ultrawork override model/variant when ultrawork keyword is detected. */
  ultrawork: z
    .object({
      model: z.string().optional(),
      variant: z.string().optional(),
    })
    .optional(),
  compaction: z
    .object({
      model: z.string().optional(),
      variant: z.string().optional(),
    })
    .optional(),
})

export const AgentOverridesSchema = z.object({
  // Canonical 12 agents
  "bob": AgentOverrideConfigSchema.optional(),
  "guard": AgentOverrideConfigSchema.optional(),
  "strategist": AgentOverrideConfigSchema.optional(),
  "critic": AgentOverrideConfigSchema.optional(),
  "coder": AgentOverrideConfigSchema.extend({
    allow_non_gpt_model: z.boolean().optional(),
  }).optional(),
  "designer": AgentOverrideConfigSchema.optional(),
  "sub": AgentOverrideConfigSchema.optional(),
  researcher: AgentOverrideConfigSchema.optional(),
  "multimodal": AgentOverrideConfigSchema.optional(),
  "quality-guardian": AgentOverrideConfigSchema.optional(),
  "platform-manager": AgentOverrideConfigSchema.optional(),
  brainstormer: AgentOverrideConfigSchema.optional(),
  "agent-skills": AgentOverrideConfigSchema.optional(),
  // Compatibility aliases
  build: AgentOverrideConfigSchema.optional(),
  plan: AgentOverrideConfigSchema.optional(),
  "OpenCode-Builder": AgentOverrideConfigSchema.optional(),
  general: AgentOverrideConfigSchema.optional(),
  zoe: AgentOverrideConfigSchema.optional(),
  "pre-plan": AgentOverrideConfigSchema.optional(),
  manager: AgentOverrideConfigSchema.optional(),
  vision: AgentOverrideConfigSchema.optional(),
  "logician": AgentOverrideConfigSchema.optional(),
  librarian: AgentOverrideConfigSchema.optional(),
  explore: AgentOverrideConfigSchema.optional(),
  ui: AgentOverrideConfigSchema.optional(),
  "code-reviewer": AgentOverrideConfigSchema.optional(),
  "systematic-debugger": AgentOverrideConfigSchema.optional(),
  mindmodel: AgentOverrideConfigSchema.optional(),
  "ledger-creator": AgentOverrideConfigSchema.optional(),
  bootstrapper: AgentOverrideConfigSchema.optional(),
  "project-initializer": AgentOverrideConfigSchema.optional(),
})

export type AgentOverrideConfig = z.infer<typeof AgentOverrideConfigSchema>
export type AgentOverrides = z.infer<typeof AgentOverridesSchema>
