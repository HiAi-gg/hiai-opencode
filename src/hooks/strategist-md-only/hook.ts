import type { PluginInput } from "@opencode-ai/plugin"
import {
  HOOK_NAME,
  BLOCKED_EXECUTION_CATEGORIES,
  BLOCKED_EXECUTION_COMMANDS,
  BLOCKED_EXECUTION_SKILLS,
  BLOCKED_TOOLS,
  PLANNING_CONSULT_WARNING,
  STRATEGIST_EXECUTION_BLOCK_MESSAGE,
  STRATEGIST_WORKFLOW_REMINDER,
  UNCONDITIONAL_BLOCKED_TOOLS,
  ALLOWED_PLANNING_SUBAGENTS,
} from "./constants"
import { log } from "../../shared/logger"
import { SYSTEM_DIRECTIVE_PREFIX } from "../../shared/system-directive"
import { getAgentFromSession } from "./agent-resolution"
import { isStrategistAgent } from "./agent-matcher"
import { isAllowedFile } from "./path-policy"
import { resolveCanonicalDelegateAgentKey } from "../../tools/delegate-task/sub-agent"

const TASK_TOOLS = ["task", "call_hiai_agent"]

function normalizeName(value: string): string {
  return value.trim().replace(/^\//, "").toLowerCase()
}

function hasBlockedSkill(loadSkills: unknown): string | null {
  if (!Array.isArray(loadSkills)) {
    return null
  }

  for (const entry of loadSkills) {
    if (typeof entry !== "string") continue
    const normalized = normalizeName(entry)
    if (BLOCKED_EXECUTION_SKILLS.includes(normalized)) {
      return normalized
    }
  }

  return null
}

export function createStrategistMdOnlyHook(ctx: PluginInput) {
  return {
    "tool.execute.before": async (
      input: { tool: string; sessionID: string; callID: string },
      output: { args: Record<string, unknown>; message?: string }
    ): Promise<void> => {
      const agentName = await getAgentFromSession(input.sessionID, ctx.directory, ctx.client)

      if (!isStrategistAgent(agentName)) {
        return
      }

      const toolName = input.tool

      if (toolName === "skill") {
        const name = typeof output.args.name === "string" ? normalizeName(output.args.name) : ""
        if (BLOCKED_EXECUTION_SKILLS.includes(name) || BLOCKED_EXECUTION_COMMANDS.includes(name)) {
          log(`[${HOOK_NAME}] Blocked strategist execution skill/command`, {
            sessionID: input.sessionID,
            tool: toolName,
            name,
            agent: agentName,
          })
          throw new Error(
            `${STRATEGIST_EXECUTION_BLOCK_MESSAGE}\n\nBlocked skill/command: ${name}. ` +
            `Strategist must stop at plan handoff and tell the user to run /start-work.`
          )
        }
        return
      }

      // Inject planning-only warning for allowed planning task tools called by Strategist
      if (TASK_TOOLS.includes(toolName)) {
        const category = typeof output.args.category === "string" ? normalizeName(output.args.category) : undefined
        const subagentType = typeof output.args.subagent_type === "string"
          ? resolveCanonicalDelegateAgentKey(output.args.subagent_type)
          : undefined
        const blockedSkill = hasBlockedSkill(output.args.load_skills)

        if (category && BLOCKED_EXECUTION_CATEGORIES.includes(category)) {
          log(`[${HOOK_NAME}] Blocked strategist execution category`, {
            sessionID: input.sessionID,
            tool: toolName,
            category,
            agent: agentName,
          })
          throw new Error(
            `${STRATEGIST_EXECUTION_BLOCK_MESSAGE}\n\nBlocked execution category: ${category}. ` +
            `Strategist may plan and research, but Bob must start execution via /start-work.`
          )
        }

        if (subagentType && !ALLOWED_PLANNING_SUBAGENTS.includes(subagentType)) {
          log(`[${HOOK_NAME}] Blocked strategist execution subagent`, {
            sessionID: input.sessionID,
            tool: toolName,
            subagentType,
            agent: agentName,
          })
          throw new Error(
            `${STRATEGIST_EXECUTION_BLOCK_MESSAGE}\n\nBlocked execution subagent: ${subagentType}. ` +
            `Allowed planning helpers: ${ALLOWED_PLANNING_SUBAGENTS.join(", ")}.`
          )
        }

        if (blockedSkill) {
          log(`[${HOOK_NAME}] Blocked strategist execution skill in delegation`, {
            sessionID: input.sessionID,
            tool: toolName,
            blockedSkill,
            agent: agentName,
          })
          throw new Error(
            `${STRATEGIST_EXECUTION_BLOCK_MESSAGE}\n\nBlocked execution skill: ${blockedSkill}.`
          )
        }

        const prompt = output.args.prompt as string | undefined
        if (prompt && !prompt.includes(SYSTEM_DIRECTIVE_PREFIX)) {
          output.args.prompt = PLANNING_CONSULT_WARNING + prompt
          log(`[${HOOK_NAME}] Injected planning warning to ${toolName}`, {
            sessionID: input.sessionID,
            tool: toolName,
            agent: agentName,
          })
        }
        return
      }

      if (!BLOCKED_TOOLS.includes(toolName)) {
        return
      }

      if (UNCONDITIONAL_BLOCKED_TOOLS.includes(toolName)) {
        log(`[${HOOK_NAME}] Blocked strategist mutation/shell tool`, {
          sessionID: input.sessionID,
          tool: toolName,
          agent: agentName,
        })
        throw new Error(
          `${STRATEGIST_EXECUTION_BLOCK_MESSAGE}\n\nBlocked tool: ${toolName}. ` +
          `Strategist cannot run shell, tmux, or patching tools.`
        )
      }

      const filePath = (output.args.filePath ?? output.args.path ?? output.args.file) as string | undefined
      if (!filePath) {
        throw new Error(
          `${STRATEGIST_EXECUTION_BLOCK_MESSAGE}\n\nBlocked tool: ${toolName}. Missing file target does not make it safe.`
        )
      }

       if (!isAllowedFile(filePath, ctx.directory)) {
         log(`[${HOOK_NAME}] Blocked: Strategist can only write to .bob/*.md`, {
           sessionID: input.sessionID,
           tool: toolName,
           filePath,
           agent: agentName,
         })
         throw new Error(
           `[${HOOK_NAME}] Strategist is a planning agent. File operations restricted to .bob/*.md plan files only. Use /start-work for execution handoff after planning. ` +
           `Attempted to modify: ${filePath}. ` +
           `APOLOGIZE TO THE USER, REMIND OF YOUR PLAN WRITING PROCESSES, TELL USER WHAT YOU WILL GOING TO DO AS THE PROCESS, WRITE THE PLAN`
         )
       }

      const normalizedPath = filePath.toLowerCase().replace(/\\/g, "/")
      if (normalizedPath.includes(".bob/plans/") || normalizedPath.includes(".bob\\plans\\")) {
        log(`[${HOOK_NAME}] Injecting workflow reminder for plan write`, {
          sessionID: input.sessionID,
          tool: toolName,
          filePath,
          agent: agentName,
        })
        output.message = (output.message || "") + STRATEGIST_WORKFLOW_REMINDER
      }

      log(`[${HOOK_NAME}] Allowed: .bob/*.md write permitted`, {
        sessionID: input.sessionID,
        tool: toolName,
        filePath,
        agent: agentName,
      })
    },
  }
}
