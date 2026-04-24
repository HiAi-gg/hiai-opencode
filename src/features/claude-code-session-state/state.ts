import { getAgentConfigKey } from "../../shared/agent-display-names"

export const subagentSessions = new Set<string>()
export const syncSubagentSessions = new Set<string>()

let _mainSessionID: string | undefined

export function setMainSession(id: string | undefined) {
  _mainSessionID = id
}

export function getMainSessionID(): string | undefined {
  return _mainSessionID
}

const registeredAgentNames = new Set<string>()
const registeredAgentAliases = new Map<string, string>()

const ZERO_WIDTH_CHARACTERS_REGEX = /[\u200B\u200C\u200D\uFEFF]/g
const LEGACY_AGENT_KEY_TO_CANONICAL: Record<string, string> = {
  general: "bob",
  build: "bob",
  zoe: "bob",
  "pre-plan": "strategist",
  "plan-consultant": "strategist",
  explore: "researcher",
  librarian: "researcher",
  logician: "strategist",
  "code-reviewer": "critic",
  "systematic-debugger": "critic",
  "ledger-creator": "platform-manager",
  bootstrapper: "platform-manager",
  "project-initializer": "platform-manager",
  mindmodel: "platform-manager",
  subagent: "coder",
  ui: "multimodal",
}
const CANONICAL_AGENT_COMPATIBILITY_KEYS: Record<string, string[]> = {
  multimodal: ["ui"],
}

function normalizeRegisteredAgentName(name: string): string {
  return name.replace(ZERO_WIDTH_CHARACTERS_REGEX, "").toLowerCase()
}

function normalizeStoredAgentName(name: string): string {
  return name.replace(ZERO_WIDTH_CHARACTERS_REGEX, "")
}

function addRegisteredAlias(key: string, alias: string, force = false): void {
  if (!key) {
    return
  }
  registeredAgentNames.add(key)
  if (force || !registeredAgentAliases.has(key)) {
    registeredAgentAliases.set(key, alias)
  }
}

function canonicalizeAgentKey(agentKey: string): string {
  return LEGACY_AGENT_KEY_TO_CANONICAL[agentKey] ?? agentKey
}

function appendLookupKey(keys: string[], value: string): void {
  if (!value || keys.includes(value)) {
    return
  }
  keys.push(value)
}

function getAgentLookupKeys(name: string): string[] {
  const keys: string[] = []
  const normalizedName = normalizeRegisteredAgentName(name)
  const configKey = normalizeRegisteredAgentName(getAgentConfigKey(name))

  appendLookupKey(keys, normalizedName)
  appendLookupKey(keys, configKey)

  const canonicalFromName = canonicalizeAgentKey(normalizedName)
  const canonicalFromConfig = canonicalizeAgentKey(configKey)
  appendLookupKey(keys, canonicalFromName)
  appendLookupKey(keys, canonicalFromConfig)

  for (const key of [...keys]) {
    for (const compatibilityKey of CANONICAL_AGENT_COMPATIBILITY_KEYS[key] ?? []) {
      appendLookupKey(keys, compatibilityKey)
    }
  }

  return keys
}

export function registerAgentName(name: string): void {
  const normalizedName = normalizeRegisteredAgentName(name)
  const configKey = normalizeRegisteredAgentName(getAgentConfigKey(name))
  const canonicalConfigKey = canonicalizeAgentKey(configKey)
  const forceCanonicalAlias = canonicalConfigKey === configKey

  addRegisteredAlias(normalizedName, name)
  addRegisteredAlias(configKey, name)
  addRegisteredAlias(canonicalConfigKey, name, forceCanonicalAlias)
  for (const compatibilityKey of CANONICAL_AGENT_COMPATIBILITY_KEYS[canonicalConfigKey] ?? []) {
    addRegisteredAlias(compatibilityKey, name, forceCanonicalAlias)
  }
}

export function isAgentRegistered(name: string): boolean {
  return registeredAgentNames.has(normalizeRegisteredAgentName(name))
}

export function resolveRegisteredAgentName(name: string | undefined): string | undefined {
  if (typeof name !== "string") {
    return undefined
  }

  for (const lookupKey of getAgentLookupKeys(name)) {
    const aliasMatch = registeredAgentAliases.get(lookupKey)
    if (aliasMatch !== undefined) {
      return aliasMatch
    }
  }

  return normalizeStoredAgentName(name)
}

/** @internal For testing only */
export function _resetForTesting(): void {
  _mainSessionID = undefined
  subagentSessions.clear()
  syncSubagentSessions.clear()
  sessionAgentMap.clear()
  registeredAgentNames.clear()
  registeredAgentAliases.clear()
}

const sessionAgentMap = new Map<string, string>()

export function setSessionAgent(sessionID: string, agent: string): void {
  if (!sessionAgentMap.has(sessionID)) {
    sessionAgentMap.set(sessionID, normalizeStoredAgentName(agent))
  }
}

export function updateSessionAgent(sessionID: string, agent: string): void {
  sessionAgentMap.set(sessionID, normalizeStoredAgentName(agent))
}

export function getSessionAgent(sessionID: string): string | undefined {
  return sessionAgentMap.get(sessionID)
}

export function clearSessionAgent(sessionID: string): void {
  sessionAgentMap.delete(sessionID)
}
