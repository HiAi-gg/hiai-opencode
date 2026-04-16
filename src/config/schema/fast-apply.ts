import { z } from "zod"

export const FastApplyConfigSchema = z.object({
  /** Enable fast-apply via Ollama (default: false) */
  enabled: z.boolean().optional().default(false),
  /** Ollama API URL (default: http://localhost:11434) */
  ollama_url: z.string().optional().default("http://localhost:11434"),
  /** Model name for fast-apply (default: qwen3.5:9b) */
  model: z.string().optional().default("qwen3.5:9b"),
  /** Timeout in milliseconds for Ollama request (default: 30000) */
  timeout: z.number().int().positive().optional().default(30000),
})

export type FastApplyConfig = z.infer<typeof FastApplyConfigSchema>
