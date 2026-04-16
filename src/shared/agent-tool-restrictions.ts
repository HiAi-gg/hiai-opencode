import { stripInvisibleAgentCharacters } from "./agent-display-names"

/**
 * Agent tool restrictions for session.prompt calls.
 * OpenCode SDK's session.prompt `tools` parameter expects boolean values.
 * true = tool allowed, false = tool denied.
 */

const EXPLORATION_AGENT_DENYLIST: Record<string, boolean> = {
  write: false,
  edit: false,
  task: false,
  call_omo_agent: false,
}

const AGENT_RESTRICTIONS: Record<string, Record<string, boolean>> = {
  explore: EXPLORATION_AGENT_DENYLIST,

  librarian: EXPLORATION_AGENT_DENYLIST,

  "logician": {
    write: false,
    edit: false,
    task: false,
    call_omo_agent: false,
  },

  "pre-plan": {
    write: false,
    edit: false,
    task: false,
  },

  "critic": {
    write: false,
    edit: false,
    task: false,
  },

  "ui": {
    read: true,
  },

  "sub": {
    task: false,
  },
}

export function getAgentToolRestrictions(agentName: string): Record<string, boolean> {
  // Custom/unknown agents get no restrictions (empty object), matching Claude Code's
  // trust model where project-registered agents retain full tool access including bash.
  const stripped = stripInvisibleAgentCharacters(agentName)
  return AGENT_RESTRICTIONS[stripped]
    ?? Object.entries(AGENT_RESTRICTIONS).find(([key]) => key.toLowerCase() === stripped.toLowerCase())?.[1]
    ?? {}
}

export function hasAgentToolRestrictions(agentName: string): boolean {
  const restrictions = getAgentToolRestrictions(agentName)
  return Object.keys(restrictions).length > 0
}
