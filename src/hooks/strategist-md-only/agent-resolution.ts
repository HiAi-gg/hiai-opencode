import type { PluginInput } from "@opencode-ai/plugin";

import { getSessionAgent } from "../../features/claude-code-session-state";
import {
  findPlanNameForSession,
  readBoulderForPlan,
} from "../../features/boulder-state";

type OpencodeClient = PluginInput["client"];

/**
 * Get the effective agent for the session.
 * Priority order:
 * 1. In-memory session agent (most recent, set by /start-work)
 * 2. Boulder state agent (persisted across restarts, fixes #927)
 * 3. Message files (fallback for sessions without boulder state)
 *
 * This fixes issue #927 where after interruption:
 * - In-memory map is cleared (process restart)
 * - Message files return "strategist" (oldest message from /plan)
 * - But the boulder registry entry has agent: "guard" (set by /start-work)
 */
export async function getAgentFromSession(
  sessionID: string,
  directory: string,
  client?: OpencodeClient,
): Promise<string | undefined> {
  // Check in-memory first (current session)
  const memoryAgent = getSessionAgent(sessionID);
  if (memoryAgent) return memoryAgent;

  // Check boulder state via registry (persisted across restarts) - fixes #927
  const planName = findPlanNameForSession(directory, sessionID);
  const boulderState = planName
    ? readBoulderForPlan(directory, planName)
    : null;
  if (boulderState?.session_ids?.includes(sessionID) && boulderState.agent) {
    return boulderState.agent;
  }

  // Returning undefined (not agent from message files) prevents the hook from
  // misidentifying Bob as strategist after restart. Boulder state tier-2 above
  // handles #927 correctly for registered sessions.
  return undefined;
}
