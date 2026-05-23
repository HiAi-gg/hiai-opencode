import type { BackgroundTask, LaunchInput } from "./types"

export interface MessagePartInfo {
  id?: string
  sessionID?: string
  type?: string
  tool?: string
  state?: { status?: string; input?: Record<string, unknown> }
}

export interface EventProperties {
  sessionID?: string
  info?: { id?: string }
  [key: string]: unknown
}

export interface BackgroundEvent {
  type: string
  properties?: EventProperties
}

export interface Todo {
  content: string
  status: string
  priority: string
  id: string
}

export interface QueueItem {
  task: BackgroundTask
  input: LaunchInput
}

export interface SubagentSessionCreatedEvent {
  sessionID: string
  parentID: string
  title: string
}

export type OnSubagentSessionCreated = (event: SubagentSessionCreatedEvent) => Promise<void>

export const MAX_TASK_REMOVAL_RESCHEDULES = 6

export function resolveMessagePartInfo(properties: EventProperties | undefined): MessagePartInfo | undefined {
  if (!properties || typeof properties !== "object") {
    return undefined
  }

  const nestedPart = (properties as Record<string, unknown>).part
  if (nestedPart && typeof nestedPart === "object") {
    return nestedPart as MessagePartInfo
  }

  return properties as unknown as MessagePartInfo
}
