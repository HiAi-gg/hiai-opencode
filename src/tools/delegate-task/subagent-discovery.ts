import { getAgentConfigKey, getAgentDisplayName, stripAgentListSortPrefix } from "../../shared/agent-display-names"
import { loadUserAgents, loadProjectAgents } from "../../features/claude-code-agent-loader"
import {
  getCanonicalDelegateAgentDisplayName,
  isCanonicalDelegateAgentKey,
  resolveCanonicalDelegateAgentKey,
} from "./sub-agent"

export type AgentMode = "subagent" | "primary" | "all" | undefined

export type AgentInfo = {
  name: string
  mode?: "subagent" | "primary" | "all"
  model?: string | { providerID: string; modelID: string }
}

export function sanitizeSubagentType(subagentType: string): string {
  return subagentType.trim().replace(/^[\\\/"']+|[\\\/"']+$/g, "").trim()
}

export function mergeWithClaudeCodeAgents(
  serverAgents: AgentInfo[],
  directory: string | undefined,
): AgentInfo[] {
  const userAgentsRecord = loadUserAgents()
  const projectAgentsRecord = loadProjectAgents(directory)

  const toAgentInfoList = (record: Record<string, { mode?: string; model?: AgentInfo["model"] }>): AgentInfo[] =>
    Object.entries(record).map(([name, config]) => ({
      name,
      mode: config.mode as AgentInfo["mode"],
      model: config.model,
    }))

  const mergedAgentMap = new Map<string, AgentInfo>()
  const addIfAbsent = (agent: AgentInfo): void => {
    const key = stripAgentListSortPrefix(agent.name).trim().toLowerCase()
    if (!mergedAgentMap.has(key)) {
      mergedAgentMap.set(key, agent)
    }
  }

  for (const agent of serverAgents) addIfAbsent(agent)
  for (const agent of toAgentInfoList(projectAgentsRecord)) addIfAbsent(agent)
  for (const agent of toAgentInfoList(userAgentsRecord)) addIfAbsent(agent)

  return Array.from(mergedAgentMap.values())
}

function normalizeComparableName(agentName: string): string {
  return stripAgentListSortPrefix(agentName).trim().toLowerCase()
}

function getCanonicalKey(agentName: string): string {
  return resolveCanonicalDelegateAgentKey(agentName).trim().toLowerCase()
}

function buildComparableNames(agentName: string): Set<string> {
  return new Set([
    agentName,
    getAgentDisplayName(agentName),
    getAgentConfigKey(agentName),
    resolveCanonicalDelegateAgentKey(agentName),
    getCanonicalDelegateAgentDisplayName(agentName),
  ].map(normalizeComparableName))
}

function matchesRequestedAgent(agent: AgentInfo, requestedAgentName: string): boolean {
  const comparableNames = buildComparableNames(requestedAgentName)
  const listedAgentName = normalizeComparableName(agent.name)
  const listedAgentConfigKey = normalizeComparableName(getAgentConfigKey(agent.name))
  const listedCanonicalKey = getCanonicalKey(agent.name)

  return comparableNames.has(listedAgentName)
    || comparableNames.has(listedAgentConfigKey)
    || comparableNames.has(listedCanonicalKey)
}

export function isTaskCallableAgentMode(mode: AgentMode): boolean {
  return mode === "all" || mode === "subagent"
}

function selectPreferredAgentMatch(
  agents: AgentInfo[],
  requestedAgentName: string,
  modeMatcher: (mode: AgentMode) => boolean,
): AgentInfo | undefined {
  const candidates = agents.filter(
    (agent) => modeMatcher(agent.mode) && matchesRequestedAgent(agent, requestedAgentName)
  )
  if (candidates.length === 0) {
    return undefined
  }

  const requestedCanonicalKey = getCanonicalKey(requestedAgentName)
  const canonicalCandidates = candidates.filter(
    (agent) => getCanonicalKey(agent.name) === requestedCanonicalKey
  )
  if (canonicalCandidates.length === 0) {
    return candidates[0]
  }

  // Prefer canonical runtime agent names over legacy aliases when both exist.
  const preferredCanonical = canonicalCandidates.find((agent) =>
    isCanonicalDelegateAgentKey(getAgentConfigKey(agent.name))
  )
  return preferredCanonical ?? canonicalCandidates[0]
}

export function findPrimaryAgentMatch(
  agents: AgentInfo[],
  requestedAgentName: string,
): AgentInfo | undefined {
  return selectPreferredAgentMatch(
    agents,
    requestedAgentName,
    (mode) => mode === "primary",
  )
}

export function findCallableAgentMatch(
  agents: AgentInfo[],
  requestedAgentName: string,
): AgentInfo | undefined {
  return selectPreferredAgentMatch(
    agents,
    requestedAgentName,
    (mode) => isTaskCallableAgentMode(mode),
  )
}

export function listCallableAgentNames(agents: AgentInfo[]): string {
  const uniqueNames = new Map<string, string>()

  for (const agent of agents) {
    if (!isTaskCallableAgentMode(agent.mode)) {
      continue
    }
    const canonicalKey = resolveCanonicalDelegateAgentKey(agent.name)
    const displayName = isCanonicalDelegateAgentKey(canonicalKey)
      ? getAgentDisplayName(canonicalKey)
      : stripAgentListSortPrefix(agent.name)
    const lookupKey = displayName.toLowerCase()
    if (!uniqueNames.has(lookupKey)) {
      uniqueNames.set(lookupKey, displayName)
    }
  }

  return Array.from(uniqueNames.values())
    .sort()
    .join(", ")
}
