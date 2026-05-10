import type { PluginInput } from "@opencode-ai/plugin"
import type { SkillMcpManager } from "../../features/skill-mcp-manager"
import { HOOK_NAME } from "./constants"
import { createMemPalaceAutoSaveHandler } from "./handler"
import type { MemPalaceAutoSaveOptions, MemPalaceAutoSaveState } from "./types"

export const HOOK_NAME_MEMPALACE_AUTO_SAVE = HOOK_NAME

export interface MemPalaceAutoSave {
  handler: (input: { event: { type: string; properties?: unknown } }) => Promise<void>
  dispose: () => void
}

export function createMemPalaceAutoSave(
  ctx: PluginInput,
  skillMcpManager: SkillMcpManager,
  options?: MemPalaceAutoSaveOptions
): MemPalaceAutoSave {
  const handler = createMemPalaceAutoSaveHandler({ ctx, skillMcpManager, options })

  return {
    handler,
    dispose: () => {},
  }
}

export type { MemPalaceAutoSaveState, MemPalaceAutoSaveOptions }
