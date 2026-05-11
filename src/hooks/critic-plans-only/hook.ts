import type { PluginInput } from "@opencode-ai/plugin"
import { HOOK_NAME, BLOCKED_TOOLS } from "./constants"
import { log } from "../../shared/logger"
import { getAgentFromSession } from "../strategist-md-only/agent-resolution"
import { isCriticAgent } from "./agent-matcher"
import { isAllowedFile } from "./path-policy"

const EDIT_TOOLS = ["edit", "Edit"]

export function createCriticPlansOnlyHook(ctx: PluginInput) {
  return {
    "tool.execute.before": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { args: Record<string, unknown>; message?: string }
    ): Promise<void> => {
      const agentName = await getAgentFromSession(input.sessionID, ctx.directory, ctx.client)
      if (!isCriticAgent(agentName)) return

      const toolName = input.tool

      if (BLOCKED_TOOLS.includes(toolName)) {
        log(`[${HOOK_NAME}] Blocked: Critic cannot use ${toolName}`, {
          sessionID: input.sessionID, tool: toolName, agent: agentName,
        })
        throw new Error(
          `[${HOOK_NAME}] Critic is a review agent. Tool '${toolName}' is forbidden. ` +
          `Critic may ONLY use 'edit' on .bob/plans/*.md files to mark checkboxes.`
        )
      }

      if (EDIT_TOOLS.includes(toolName)) {
        const filePath = (output.args.filePath ?? output.args.path ?? output.args.file) as string | undefined
        if (!filePath) {
          throw new Error(
            `[${HOOK_NAME}] Critic edit requires a filePath. Only .bob/plans/*.md plan files are editable.`
          )
        }
        if (!isAllowedFile(filePath, ctx.directory)) {
          log(`[${HOOK_NAME}] Blocked: path outside .bob/plans/`, {
            sessionID: input.sessionID, tool: toolName, filePath, agent: agentName,
          })
          throw new Error(
            `[${HOOK_NAME}] Critic can ONLY edit .bob/plans/*.md files. ` +
            `Attempted: ${filePath}. Use task(subagent_type="coder", ...) for implementation.`
          )
        }
        log(`[${HOOK_NAME}] Allowed: plan edit permitted`, {
          sessionID: input.sessionID, tool: toolName, filePath, agent: agentName,
        })
      }
    },
  }
}