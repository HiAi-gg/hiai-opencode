import { z } from "zod"

export const McpNameSchema = z.enum([
  "playwright",
  "stitch",
  "sequential-thinking",
  "firecrawl",
  "rag",
  "context7",
  "mempalace",
  "websearch",
  "grep_app",
])

export type McpName = z.infer<typeof McpNameSchema>

export const AnyMcpNameSchema = z.string().min(1)

export type AnyMcpName = z.infer<typeof AnyMcpNameSchema>
