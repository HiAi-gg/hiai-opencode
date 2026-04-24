import { z } from "zod"

export const BuiltinAgentNameSchema = z.enum([
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
])

export const BuiltinSkillNameSchema = z.enum([
  "playwright",
  "agent-browser",
  "dev-browser",
  "frontend-ui-ux",
  "git-master",
  "review-work",
  "ai-slop-remover",
])

export const OverridableAgentNameSchema = z.enum([
  // Canonical 12 agents
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
  // Compatibility aliases
  "build",
  "plan",
  "OpenCode-Builder",
  "pre-plan",
  "general",
  "zoe",
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
])

export const AgentNameSchema = BuiltinAgentNameSchema
export type AgentName = z.infer<typeof AgentNameSchema>

export type BuiltinSkillName = z.infer<typeof BuiltinSkillNameSchema>
