import { getAgentConfigKey, getAgentDisplayName } from "../../shared/agent-display-names"
import { log } from "../../shared/logger"

export const SUB_AGENT_CONFIG_KEY = "sub"
export const CODER_AGENT_CONFIG_KEY = "coder"
export const CRITIC_AGENT_CONFIG_KEY = "critic"

export const CANONICAL_DELEGATE_AGENT_KEYS = [
  "bob",
  "guard",
  "strategist",
  "critic",
  "coder",
  "sub",
  "researcher",
  "multimodal",
  "designer",
  "platform-manager",
  "brainstormer",
  "agent-skills",
] as const

type CanonicalDelegateAgentKey = (typeof CANONICAL_DELEGATE_AGENT_KEYS)[number]
export type { CanonicalDelegateAgentKey }
const CANONICAL_DELEGATE_AGENT_KEY_SET = new Set<string>(CANONICAL_DELEGATE_AGENT_KEYS)

const LEGACY_DELEGATE_AGENT_ALIASES: Record<string, CanonicalDelegateAgentKey> = {
  general: "bob",
  zoe: "bob",
  build: "bob",
  "plan-consultant": "strategist",
  "pre-plan": "strategist",
  "planner-bob": "strategist",
  "omo-plan": "strategist",
  plan: "strategist",
  logician: "strategist",
  athena: "strategist",
  "athena-junior": "strategist",
  librarian: "researcher",
  explore: "researcher",
  "code-reviewer": "critic",
  "systematic-debugger": "critic",
  "ledger-creator": "platform-manager",
  bootstrapper: "platform-manager",
  "project-initializer": "platform-manager",
  mindmodel: "platform-manager",
  ui: "multimodal",
  writer: "brainstormer",
  copywriter: "brainstormer",
  "content-writer": "brainstormer",
  subagent: "sub",
  "bob-junior": "sub",
  oracle: "strategist",
  hephaestus: "coder",
  metis: "strategist",
  momus: "critic",
  "sisyphus-junior": "sub",
  "multimodal-looker": "multimodal",
}

export function resolveCanonicalDelegateAgentKey(agentName: string): string {
  const configKey = getAgentConfigKey(agentName).trim().toLowerCase()
  if (!configKey) return configKey
  const resolved = LEGACY_DELEGATE_AGENT_ALIASES[configKey]
  if (resolved && resolved !== configKey) {
    log("[delegate-task] Legacy agent alias resolved", { from: configKey, to: resolved })
    return resolved
  }
  return configKey
}

export function isCanonicalDelegateAgentKey(agentName: string): boolean {
  return CANONICAL_DELEGATE_AGENT_KEY_SET.has(resolveCanonicalDelegateAgentKey(agentName))
}

export function getCanonicalDelegateAgentDisplayName(agentName: string): string {
  return getAgentDisplayName(resolveCanonicalDelegateAgentKey(agentName))
}

export const BOB_JUNIOR_AGENT = getAgentDisplayName(SUB_AGENT_CONFIG_KEY)
