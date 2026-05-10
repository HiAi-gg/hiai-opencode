import { z } from "zod"

export const BrowserAutomationProviderSchema = z.enum([
  "agent-browser",
  "dev-browser",
])

export const BrowserAutomationConfigSchema = z.object({
  /**
   * Browser automation provider to use for browser automation.
   * - "agent-browser": Uses Vercel's agent-browser CLI (default, requires: npm i -g agent-browser && agent-browser install)
   * - "dev-browser": Uses dev-browser skill with persistent browser state
   */
  provider: BrowserAutomationProviderSchema.default("agent-browser"),
})

export type BrowserAutomationProvider = z.infer<
  typeof BrowserAutomationProviderSchema
>
export type BrowserAutomationConfig = z.infer<typeof BrowserAutomationConfigSchema>
