import type { InteractiveBashSessionState } from "./types";
import { loadInteractiveBashSessionState } from "./storage";
import { OMO_SESSION_PREFIX } from "./constants";
import { spawnWithWindowsHide } from "../../shared/spawn-with-windows-hide";
import { logWarn } from "../../shared/logger";

export function getOrCreateState(
  sessionID: string,
  sessionStates: Map<string, InteractiveBashSessionState>,
): InteractiveBashSessionState {
  if (!sessionStates.has(sessionID)) {
    const persisted = loadInteractiveBashSessionState(sessionID);
    const state: InteractiveBashSessionState = persisted ?? {
      sessionID,
      tmuxSessions: new Set<string>(),
      updatedAt: Date.now(),
    };
    sessionStates.set(sessionID, state);
  }
  return sessionStates.get(sessionID)!;
}

export function isOmoSession(sessionName: string | null): boolean {
  return !!sessionName?.startsWith(OMO_SESSION_PREFIX);
}

export async function killAllTrackedSessions(
  state: InteractiveBashSessionState,
): Promise<void> {
  for (const sessionName of state.tmuxSessions) {
    try {
      const proc = spawnWithWindowsHide(
        ["tmux", "kill-session", "-t", sessionName],
        {
          stdout: "ignore",
          stderr: "ignore",
        },
      );
      await proc.exited;
    } catch (error) {
      // Best-effort teardown during session shutdown. tmux may already be
      // gone, the server may be unreachable, or kill-session may be unsupported.
      // Continue with the remaining tracked sessions regardless.
      logWarn("[interactive-bash] failed to kill tracked tmux session", {
        sessionName,
        error: String(error),
      });
    }
  }
}
