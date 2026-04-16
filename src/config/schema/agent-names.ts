import { z } from "zod"

export const BuiltinAgentNameSchema = z.enum([
  "bob",
  "coder",
  "strategist",
  "logician",
  "librarian",
  "explore",
  "ui",
  "pre-plan",
  "critic",
  "guard",
  "sub",
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
  "build",
  "plan",
  "bob",
  "coder",
  "sub",
  "OpenCode-Builder",
  "strategist",
  "pre-plan",
  "critic",
  "logician",
  "librarian",
  "explore",
  "ui",
  "guard",
])

export const AgentNameSchema = BuiltinAgentNameSchema
export type AgentName = z.infer<typeof AgentNameSchema>

export type BuiltinSkillName = z.infer<typeof BuiltinSkillNameSchema>
