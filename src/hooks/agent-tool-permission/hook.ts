import type { PluginInput } from "@opencode-ai/plugin"
import { HOOK_NAME, BLOCK_MESSAGE_PREFIX } from "./constants"
import { getAgentFromSession } from "../strategist-md-only/agent-resolution"
import { getAgentToolRestrictions, hasAgentToolRestrictions } from "../../shared/agent-tool-restrictions"
import { log } from "../../shared/logger"

function normalizeToolName(value: string): string {
  return value.trim().toLowerCase()
}

function isToolDenied(restrictions: Record<string, boolean>, toolName: string): boolean {
  const normalized = normalizeToolName(toolName)
  for (const key of Object.keys(restrictions)) {
    if (normalizeToolName(key) === normalized) {
      return restrictions[key] === false
    }
  }
  return false
}

export function createAgentToolPermissionHook(ctx: PluginInput) {
  return {
    "tool.execute.before": async (
      input: { tool: string; sessionID: string; callID: string },
      _output: { args: Record<string, unknown>; message?: string }
    ): Promise<void> => {
      const agentName = await getAgentFromSession(input.sessionID, ctx.directory, ctx.client)
      if (!agentName) {
        return
      }

      if (!hasAgentToolRestrictions(agentName)) {
        return
      }

      const restrictions = getAgentToolRestrictions(agentName)
      if (!isToolDenied(restrictions, input.tool)) {
        return
      }

      log(`[${HOOK_NAME}] Blocked tool for agent`, {
        sessionID: input.sessionID,
        tool: input.tool,
        agent: agentName,
      })

      throw new Error(
        `${BLOCK_MESSAGE_PREFIX}\n\n` +
        `Agent "${agentName}" is not allowed to use tool "${input.tool}".\n\n` +
        `Delegation policy: orchestrator/planner agents must delegate mutation and research work to specialist subagents.\n` +
        `Allowed approach: delegate via task(subagent_type="coder", ...) or task(subagent_type="researcher", ...).`
      )
    },
  }
}
