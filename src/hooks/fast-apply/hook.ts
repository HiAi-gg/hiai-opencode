import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import type { FastApplyConfig } from "../../config"
import { handleFastApplyToolExecuteBefore } from "./tool-execute-before-handler"

export function createFastApplyHook(config: FastApplyConfig): Hooks {
  return {
    "tool.execute.before": async (input, output) => {
      await handleFastApplyToolExecuteBefore({ input, output, config })
    },
  }
}
