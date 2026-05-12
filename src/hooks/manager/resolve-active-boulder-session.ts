import type { PluginInput } from "@opencode-ai/plugin"
import { getPlanProgress, findPlanNameForSession, readBoulderForPlan } from "../../features/boulder-state"
import type { BoulderState, PlanProgress } from "../../features/boulder-state"

/**
 * Resolve active boulder session using registry-aware lookup.
 * Uses findPlanNameForSession to locate which plan owns this session,
 * then reads the plan-specific boulder state from registry.
 */
export async function resolveActiveBoulderSession(input: {
  client: PluginInput["client"]
  directory: string
  sessionID: string
}): Promise<{
  boulderState: BoulderState
  progress: PlanProgress
  appendedSession: boolean
} | null> {
  // Find which plan owns this session via registry lookup
  const planName = findPlanNameForSession(input.directory, input.sessionID)
  if (!planName) {
    return null
  }

  const boulderState = readBoulderForPlan(input.directory, planName)
  if (!boulderState) {
    return null
  }

  if (!boulderState.session_ids.includes(input.sessionID)) {
    return null
  }

  const progress = getPlanProgress(boulderState.active_plan)
  if (progress.isComplete) {
    return { boulderState, progress, appendedSession: false }
  }

  return { boulderState, progress, appendedSession: false }
}
