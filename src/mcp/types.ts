import { z } from "zod";

export const McpNameSchema = z.enum([
  "stitch",
  "sequential-thinking",
  "context7",
  "mempalace",
  "grep_app",
]);

export type McpName = z.infer<typeof McpNameSchema>;

export const AnyMcpNameSchema = z.string().min(1);

export type AnyMcpName = z.infer<typeof AnyMcpNameSchema>;
