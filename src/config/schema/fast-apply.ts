import { z } from "zod"

export const FastApplyConfigSchema = z.object({
  /** Enable fast-apply via Ollama (default: false) */
  enabled: z.boolean().optional().default(false),
  /** Ollama API URL. Configure in hiai-opencode.json. */
  ollama_url: z.string().optional().default(""),
  /** Model name for fast-apply. Configure in hiai-opencode.json. */
  model: z.string().optional().default(""),
  /** Timeout in milliseconds for Ollama request (default: 30000) */
  timeout: z.number().int().positive().optional().default(30000),
})

export type FastApplyConfig = z.infer<typeof FastApplyConfigSchema>
