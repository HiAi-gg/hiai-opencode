import type { HiaiOpenCodeConfig } from "../../config";
import { getAgentConfigKey } from "../../shared/agent-display-names";
import { getRawFallbackModels } from "../../hooks/runtime-fallback/fallback-models";
import { setSessionFallbackChain } from "../../hooks/model-fallback/hook";
import { buildFallbackChainFromModels } from "../../shared/fallback-chain-from-models";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeFallbackModelID(modelID: string): string {
  return modelID
    .replace(/-thinking$/i, "")
    .replace(/-max$/i, "")
    .replace(/-high$/i, "");
}

export function extractErrorName(error: unknown): string | undefined {
  if (isRecord(error) && typeof error.name === "string") return error.name;
  if (error instanceof Error) return error.name;
  return undefined;
}

export function extractErrorMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;

  if (isRecord(error)) {
    const candidates: unknown[] = [
      error,
      error.data,
      error.error,
      isRecord(error.data) ? error.data.error : undefined,
      error.cause,
    ];

    for (const candidate of candidates) {
      if (
        isRecord(candidate) &&
        typeof candidate.message === "string" &&
        candidate.message.length > 0
      ) {
        return candidate.message;
      }
    }
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function extractProviderModelFromErrorMessage(message: string): {
  providerID?: string;
  modelID?: string;
} {
  const lower = message.toLowerCase();

  const providerModel = lower.match(
    /model\s+not\s+found:\s*([a-z0-9_-]+)\s*\/\s*([a-z0-9._-]+)/i,
  );
  if (providerModel) {
    return {
      providerID: providerModel[1],
      modelID: providerModel[2],
    };
  }

  const modelOnly = lower.match(
    /unknown\s+provider\s+for\s+model\s+([a-z0-9._-]+)/i,
  );
  if (modelOnly) {
    return {
      modelID: modelOnly[1],
    };
  }

  return {};
}

export function applyUserConfiguredFallbackChain(
  sessionID: string,
  agentName: string,
  currentProviderID: string,
  pluginConfig: HiaiOpenCodeConfig,
): void {
  const agentKey = getAgentConfigKey(agentName);
  const rawFallbackModels = getRawFallbackModels(
    sessionID,
    agentKey,
    pluginConfig,
  );
  if (!rawFallbackModels || rawFallbackModels.length === 0) return;

  const fallbackChain = buildFallbackChainFromModels(
    rawFallbackModels,
    currentProviderID,
  );

  if (fallbackChain && fallbackChain.length > 0) {
    setSessionFallbackChain(sessionID, fallbackChain);
  }
}

export function isCompactionAgent(agent: string): boolean {
  return agent.toLowerCase() === "compaction";
}
