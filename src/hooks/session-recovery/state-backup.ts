import type { PluginInput } from "@opencode-ai/plugin";
import { log } from "../../shared/logger";

export interface SessionStateSnapshot {
  sessionID: string;
  timestamp: number;
  agent?: string;
  model?: {
    providerID: string;
    modelID: string;
    variant?: string;
  };
  tools?: Record<string, boolean>;
  todoSnapshot?: Array<{
    id: string;
    content: string;
    status: string;
  }>;
  activePlanName?: string;
  continuationState?: {
    failureCount: number;
    lastInjectedAt?: number;
    stagnationCount: number;
  };
  sessionTitle?: string;
}

const SNAPSHOT_VERSION = 1;

/**
 * Manages durable session state backups for recovery scenarios.
 * Snapshots are written to the filesystem so they survive process restarts.
 */
export class SessionStateBackupManager {
  private snapshots = new Map<string, SessionStateSnapshot>();
  private backupDir: string;

  constructor(ctx: PluginInput) {
    this.backupDir = `${ctx.directory}/.opencode/session-backups`;
  }

  /**
   * Capture a comprehensive snapshot of the current session state.
   * This is designed to be called before error-prone operations.
   */
  async capture(
    sessionID: string,
    options?: {
      agent?: string;
      model?: { providerID: string; modelID: string; variant?: string };
      tools?: Record<string, boolean>;
      todoSnapshot?: Array<{ id: string; content: string; status: string }>;
      activePlanName?: string;
      continuationState?: {
        failureCount: number;
        lastInjectedAt?: number;
        stagnationCount: number;
      };
      sessionTitle?: string;
    },
  ): Promise<void> {
    const snapshot: SessionStateSnapshot = {
      sessionID,
      timestamp: Date.now(),
      agent: options?.agent,
      model: options?.model,
      tools: options?.tools,
      todoSnapshot: options?.todoSnapshot,
      activePlanName: options?.activePlanName,
      continuationState: options?.continuationState,
      sessionTitle: options?.sessionTitle,
    };

    this.snapshots.set(sessionID, snapshot);
    await this.persistSnapshot(sessionID, snapshot);
    log(`[session-state-backup] Captured snapshot for session ${sessionID}`, {
      hasAgent: !!snapshot.agent,
      hasModel: !!snapshot.model,
      todoCount: snapshot.todoSnapshot?.length ?? 0,
      hasPlan: !!snapshot.activePlanName,
    });
  }

  /**
   * Retrieve a snapshot for a session if one exists.
   */
  getSnapshot(sessionID: string): SessionStateSnapshot | undefined {
    return this.snapshots.get(sessionID);
  }

  /**
   * Clear a snapshot after successful recovery or when no longer needed.
   */
  clearSnapshot(sessionID: string): void {
    this.snapshots.delete(sessionID);
    this.deletePersistedSnapshot(sessionID);
    log(`[session-state-backup] Cleared snapshot for session ${sessionID}`);
  }

  /**
   * Check if a recent snapshot exists for a session.
   */
  hasRecentSnapshot(sessionID: string, maxAgeMs = 300_000): boolean {
    const snapshot = this.snapshots.get(sessionID);
    if (!snapshot) return false;
    return Date.now() - snapshot.timestamp < maxAgeMs;
  }

  private async persistSnapshot(
    sessionID: string,
    snapshot: SessionStateSnapshot,
  ): Promise<void> {
    try {
      const { writeFileAtomically } = await import(
        "../../shared/write-file-atomically"
      );
      const fileName = `${this.backupDir}/snapshot-${sessionID}.json`;
      const content = JSON.stringify(
        { version: SNAPSHOT_VERSION, snapshot },
        null,
        2,
      );
      writeFileAtomically(fileName, content);
    } catch (err) {
      log(`[session-state-backup] Failed to persist snapshot`, {
        sessionID,
        error: String(err),
      });
    }
  }

  private deletePersistedSnapshot(sessionID: string): void {
    try {
      const fs = require("node:fs");
      const filePath = `${this.backupDir}/snapshot-${sessionID}.json`;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (err) {
      log(`[session-state-backup] Failed to delete persisted snapshot`, {
        sessionID,
        error: String(err),
      });
    }
  }
}

/**
 * Creates a session state backup manager for the plugin.
 */
export function createSessionStateBackupManager(
  ctx: PluginInput,
): SessionStateBackupManager {
  return new SessionStateBackupManager(ctx);
}
