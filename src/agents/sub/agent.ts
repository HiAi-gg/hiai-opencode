/**
 * SubAgent - Focused Task Executor
 *
 * Executes delegated tasks directly without spawning other agents.
 * Category-spawned executor with domain-specific configurations.
 *
 * Single unified prompt across all models. Runtime knobs (reasoningEffort,
 * thinking, blocked tools) remain conditional per model family.
 */

import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentMode } from "../types"
import { isGlmModel, isGptModel } from "../types"
import type { AgentOverrideConfig } from "../../config/schema"
import {
  createAgentToolRestrictions,
  type PermissionValue,
} from "../../shared/permission-compat"
import { getGptApplyPatchPermission } from "../gpt-apply-patch-guard"
import { CLOSURE_SCHEMA_PROMPT } from "../../shared/closure-protocol"
import { buildDefaultBobJuniorPrompt } from "./default"

const MODE: AgentMode = "subagent"

// Core tools that SubAgent must NEVER have access to
// Note: call_omo_agent is ALLOWED so subagents can spawn Researcher
const BLOCKED_TOOLS = ["task"]
const GPT_BLOCKED_TOOLS = ["task", "apply_patch"]

export const BOB_JUNIOR_DEFAULTS = {
  temperature: 0.1,
} as const

export type BobJuniorPromptSource = "default"

export function getBobJuniorPromptSource(_model?: string): BobJuniorPromptSource {
  return "default"
}

/**
 * Builds the SubAgent prompt. Unified across models.
 */
export function buildBobJuniorPrompt(
  _model: string | undefined,
  useTaskSystem: boolean,
  promptAppend?: string
): string {
  return buildDefaultBobJuniorPrompt(useTaskSystem, promptAppend)
}

export function createBobJuniorAgentWithOverrides(
  override: AgentOverrideConfig | undefined,
  systemDefaultModel?: string,
  useTaskSystem = false
): AgentConfig {
  if (override?.disable) {
    override = undefined
  }

  const overrideModel = (override as { model?: string } | undefined)?.model
  const model = overrideModel ?? systemDefaultModel ?? ""
  const temperature = override?.temperature ?? BOB_JUNIOR_DEFAULTS.temperature

  const promptAppend = override?.prompt_append
  const prompt = buildBobJuniorPrompt(model, useTaskSystem, promptAppend) + "\n\n" + CLOSURE_SCHEMA_PROMPT
  const blockedTools = isGptModel(model) ? GPT_BLOCKED_TOOLS : BLOCKED_TOOLS

  const baseRestrictions = createAgentToolRestrictions(blockedTools)

  const userPermission = (override?.permission ?? {}) as Record<string, PermissionValue>
  const basePermission = baseRestrictions.permission
  const merged: Record<string, PermissionValue> = { ...userPermission }
  for (const tool of blockedTools) {
    merged[tool] = "deny"
  }
  merged.call_omo_agent = "allow"
  const toolsConfig = { permission: { ...merged, ...basePermission } as Record<string, PermissionValue> }
  const permission: Record<string, PermissionValue> = {
    ...toolsConfig.permission,
    ...getGptApplyPatchPermission(model),
  }

  const base: AgentConfig = {
    description: override?.description ??
      "Cheap bounded executor. Same discipline, no delegation. (SubAgent - HiaiOpenCode)",
    mode: MODE,
    model,
    temperature,
    maxTokens: 64000,
    prompt,
    color: override?.color ?? "#20B2AA",
    permission,
  }

  if (override?.top_p !== undefined) {
    base.top_p = override.top_p
  }

  if (isGptModel(model)) {
    return { ...base, reasoningEffort: "medium" } as AgentConfig
  }

  if (isGlmModel(model)) {
    return base as AgentConfig
  }

  return {
    ...base,
    thinking: { type: "enabled", budgetTokens: 32000 },
  } as AgentConfig
}

createBobJuniorAgentWithOverrides.mode = MODE
