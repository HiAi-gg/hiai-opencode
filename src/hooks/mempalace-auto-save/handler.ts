import type { SkillMcpManager } from "../../features/skill-mcp-manager"
import type { PluginInput } from "@opencode-ai/plugin"
import { log } from "../../shared/logger"

import { HOOK_NAME } from "./constants"
import type { MemPalaceAutoSaveOptions, MemPalaceAutoSaveState } from "./types"

const DEFAULT_DEBOUNCE_MS = 60_000

interface ExtendedMemPalaceAutoSaveState extends MemPalaceAutoSaveState {
  planSaved: boolean
  reviewSaved: boolean
  designSaved: boolean
  workStartedSaved: boolean
}

export function createMemPalaceAutoSaveHandler(args: {
  ctx: PluginInput
  skillMcpManager: SkillMcpManager
  options?: MemPalaceAutoSaveOptions
}): (input: { event: { type: string; properties?: unknown } }) => Promise<void> {
  const { ctx, skillMcpManager, options } = args
  const debounceMs = options?.debounceMs ?? DEFAULT_DEBOUNCE_MS
  const enabled = options?.enabled ?? true

  const sessionStates = new Map<string, ExtendedMemPalaceAutoSaveState>()

  const getState = (sessionID: string): ExtendedMemPalaceAutoSaveState => {
    if (!sessionStates.has(sessionID)) {
      sessionStates.set(sessionID, {
        savedTodos: new Set<string>(),
        sessionEndSaved: false,
        planSaved: false,
        reviewSaved: false,
        designSaved: false,
        workStartedSaved: false,
      })
    }
    return sessionStates.get(sessionID)!
  }

  const canSave = (sessionID: string): boolean => {
    const state = getState(sessionID)
    if (!state.lastSaveAt) return true
    return Date.now() - state.lastSaveAt >= debounceMs
  }

  const markSaved = (sessionID: string): void => {
    const state = getState(sessionID)
    state.lastSaveAt = Date.now()
  }

  const saveToMemPalace = async (params: {
    wing: string
    room: string
    content: string
    agent_name?: string
    topic?: string
    entry?: string
  }): Promise<void> => {
    try {
      const info = {
        serverName: "mempalace",
        skillName: "hiai-opencode",
        sessionID: "system",
        scope: "user" as const,
      }
      const context = {
        config: { type: "stdio" as const, command: "echo", args: ["dummy"] },
        skillName: "hiai-opencode",
      }

      await skillMcpManager.callTool(
        info,
        context,
        "mempalace_diary_write",
        {
          agent_name: params.agent_name ?? "system",
          entry: params.entry ?? params.content,
          topic: params.topic ?? "general",
        }
      )
      log(`[${HOOK_NAME}] MemPalace save success`)
    } catch (error) {
      log(`[${HOOK_NAME}] Failed to save to MemPalace:`, error)
    }
  }

  return async ({ event }: { event: { type: string; properties?: unknown } }): Promise<void> => {
    if (!enabled) return

    const props = event.properties as Record<string, unknown> | undefined
    const sessionID = props?.sessionID as string | undefined

    if (event.type === "session.created" && sessionID) {
      const state = getState(sessionID)
      if (!state.workStartedSaved && canSave(sessionID)) {
        const sessionInfo = props?.info as { id?: string; title?: string } | undefined
        await saveToMemPalace({
          wing: "hiai-opencode",
          room: "plans",
          content: `Plan started: ${sessionInfo?.title ?? sessionID}`,
          agent_name: "strategist",
          entry: `PLAN|${sessionID}|started|${sessionInfo?.title ?? sessionID}`,
          topic: "plan-started",
        })
        state.workStartedSaved = true
        markSaved(sessionID)
      }
    }

    if (event.type === "session.idle" && sessionID) {
      try {
        const todosResp = await ctx.client.session.todo({ path: { id: sessionID } })
        const todos = (todosResp as { todos?: Array<{ id?: string; content?: string; status?: string }> })?.todos ?? []

        const state = getState(sessionID)
        const completedTodos = todos.filter((t) => t.status === "completed" && t.id && !state.savedTodos.has(t.id))

        if (completedTodos.length > 0 && canSave(sessionID)) {
          for (const todo of completedTodos) {
            if (todo.id) {
              state.savedTodos.add(todo.id)
              const content = todo.content ?? "unnamed todo"
              let room = "tasks"
              let agent_name = "coder"
              if (content.toLowerCase().includes("plan")) {
                room = "plans"
                agent_name = "strategist"
              } else if (content.toLowerCase().includes("review") || content.toLowerCase().includes("critic") || content.toLowerCase().includes("approve")) {
                room = "reviews"
                agent_name = "critic"
              } else if (content.toLowerCase().includes("design") || content.toLowerCase().includes("stitch") || content.toLowerCase().includes("handoff")) {
                room = "designs"
                agent_name = "designer"
              }
              await saveToMemPalace({
                wing: "hiai-opencode",
                room,
                content: `Completed: ${content}`,
                agent_name,
                entry: `TODO|${todo.id}|done|${content}`,
                topic: room.slice(0, -1),
              })
            }
          }
          markSaved(sessionID)
        }
      } catch (error) {
        log(`[${HOOK_NAME}] Failed to check todos on session.idle:`, error)
      }
    }

    if (event.type === "session.deleted" && sessionID) {
      const state = getState(sessionID)
      if (!state.sessionEndSaved && canSave(sessionID)) {
        state.sessionEndSaved = true
        const sessionInfo = props?.info as { id?: string; title?: string } | undefined
        await saveToMemPalace({
          wing: "hiai-opencode",
          room: "sessions",
          content: `Session ended: ${sessionInfo?.title ?? sessionID}`,
          agent_name: "system",
          entry: `SESSION|${sessionID}|handoff|${sessionInfo?.title ?? sessionID}`,
          topic: "session",
        })
        markSaved(sessionID)
        sessionStates.delete(sessionID)
      }
    }

    if (event.type === "session.compacted" && sessionID) {
      const state = getState(sessionID)
      if (canSave(sessionID)) {
        const sessionInfo = props?.info as { id?: string; title?: string } | undefined
        if (!state.reviewSaved) {
          await saveToMemPalace({
            wing: "hiai-opencode",
            room: "reviews",
            content: `Review/design cycle completed: ${sessionInfo?.title ?? sessionID}`,
            agent_name: "critic",
            entry: `REVIEW|${sessionID}|complete|${sessionInfo?.title ?? sessionID}`,
            topic: "review-complete",
          })
          state.reviewSaved = true
        }
        if (!state.designSaved) {
          await saveToMemPalace({
            wing: "hiai-opencode",
            room: "designs",
            content: `Design handoff completed: ${sessionInfo?.title ?? sessionID}`,
            agent_name: "designer",
            entry: `DESIGN|${sessionID}|complete|${sessionInfo?.title ?? sessionID}`,
            topic: "design-complete",
          })
          state.designSaved = true
        }
        markSaved(sessionID)
      }
    }

    if (event.type === "session.error" && sessionID) {
      const error = props?.error as { name?: string; message?: string } | undefined
      const errorDesc = error ? `${error.name ?? "Unknown error"}: ${error.message ?? "No message"}` : "Session error"
      if (canSave(sessionID)) {
        await saveToMemPalace({
          wing: "hiai-opencode",
          room: "errors",
          content: `Session error: ${errorDesc}`,
          agent_name: "system",
          entry: `ERROR|${errorDesc}`,
          topic: "errors",
        })
        markSaved(sessionID)
      }
    }
  }
}