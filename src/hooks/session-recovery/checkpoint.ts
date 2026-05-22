import type { PluginInput } from "@opencode-ai/plugin";
import { log } from "../../shared/logger";

const RECOVERY_CHECKPOINT_VERSION = 1;

export interface RecoveryCheckpoint {
  version: number;
  sessionID: string;
  timestamp: number;
  phase:
    | "pre_compaction"
    | "pre_tool_execution"
    | "pre_continuation"
    | "pre_model_switch";
  context: {
    agent?: string;
    model?: { providerID: string; modelID: string; variant?: string };
    tools?: Record<string, boolean>;
    messageCount?: number;
  };
}

/**
 * Creates a recovery checkpoint before error-prone operations.
 * This allows the system to restore context if a subsequent operation fails.
 */
export class RecoveryCheckpointManager {
  private checkpoints = new Map<string, RecoveryCheckpoint>();
  private backupDir: string;

  constructor(ctx: PluginInput) {
    this.backupDir = `${ctx.directory}/.opencode/recovery-checkpoints`;
  }

  /**
   * Create a checkpoint before an operation that could fail.
   */
  async checkpoint(
    sessionID: string,
    phase: RecoveryCheckpoint["phase"],
    context?: RecoveryCheckpoint["context"],
  ): Promise<void> {
    const checkpoint: RecoveryCheckpoint = {
      version: RECOVERY_CHECKPOINT_VERSION,
      sessionID,
      timestamp: Date.now(),
      phase,
      context: context ?? {},
    };

    this.checkpoints.set(sessionID, checkpoint);
    await this.persistCheckpoint(sessionID, checkpoint);
    log(
      `[recovery-checkpoint] Created ${phase} checkpoint for session ${sessionID}`,
    );
  }

  /**
   * Get the last checkpoint for a session.
   */
  getLastCheckpoint(sessionID: string): RecoveryCheckpoint | undefined {
    return this.checkpoints.get(sessionID);
  }

  /**
   * Clear the checkpoint after successful operation completion.
   */
  clearCheckpoint(sessionID: string): void {
    this.checkpoints.delete(sessionID);
    this.deletePersistedCheckpoint(sessionID);
    log(`[recovery-checkpoint] Cleared checkpoint for session ${sessionID}`);
  }

  /**
   * Check if a recent checkpoint exists for a session.
   */
  hasRecentCheckpoint(sessionID: string, maxAgeMs = 120_000): boolean {
    const checkpoint = this.checkpoints.get(sessionID);
    if (!checkpoint) return false;
    return Date.now() - checkpoint.timestamp < maxAgeMs;
  }

  private async persistCheckpoint(
    sessionID: string,
    checkpoint: RecoveryCheckpoint,
  ): Promise<void> {
    try {
      const { writeFileAtomically } = await import(
        "../../shared/write-file-atomically"
      );
      const fileName = `${this.backupDir}/checkpoint-${sessionID}.json`;
      const content = JSON.stringify(checkpoint, null, 2);
      writeFileAtomically(fileName, content);
    } catch (err) {
      log(`[recovery-checkpoint] Failed to persist checkpoint`, {
        sessionID,
        error: String(err),
      });
    }
  }

  private deletePersistedCheckpoint(sessionID: string): void {
    try {
      const fs = require("node:fs");
      const filePath = `${this.backupDir}/checkpoint-${sessionID}.json`;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {
      // Non-critical cleanup failure
    }
  }
}

/**
 * Creates a recovery checkpoint manager.
 */
export function createRecoveryCheckpointManager(
  ctx: PluginInput,
): RecoveryCheckpointManager {
  return new RecoveryCheckpointManager(ctx);
}
