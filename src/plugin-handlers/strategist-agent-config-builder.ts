import type { CategoryConfig } from "../config/schema";
import { PROMETHEUS_PERMISSION, getStrategistPrompt } from "../agents/strategist";
import { resolvePromptAppend } from "../agents/builtin-agents/resolve-file-uri";
import { AGENT_MODEL_REQUIREMENTS } from "../shared/model-requirements";
import type { FallbackEntry } from "../shared/model-requirements";
import {
  fetchAvailableModels,
  readConnectedProvidersCache,
  resolveModelPipeline,
} from "../shared";
import { resolveCategoryConfig } from "./category-config-resolver";
import { CLOSURE_SCHEMA_PROMPT } from "../shared/closure-protocol";

type StrategistOverride = Record<string, unknown> & {
  category?: string;
  model?: string;
  variant?: string;
  reasoningEffort?: string;
  textVerbosity?: string;
  thinking?: { type: string; budgetTokens?: number };
  temperature?: number;
  top_p?: number;
  maxTokens?: number;
  prompt_append?: string;
};

function isModelInFallbackChain(
  model: string | undefined,
  fallbackChain: FallbackEntry[] | undefined,
): boolean {
  if (!model || !fallbackChain || fallbackChain.length === 0) {
    return false;
  }

  const modelParts = model.split("/");
  const modelName = modelParts.length >= 2 ? modelParts.slice(1).join("/") : model;

  return fallbackChain.some((entry) => entry.model === modelName);
}

export async function buildStrategistAgentConfig(params: {
  configAgentPlan: Record<string, unknown> | undefined;
  pluginStrategistOverride: StrategistOverride | undefined;
  userCategories: Record<string, CategoryConfig> | undefined;
  currentModel: string | undefined;
  disabledTools?: readonly string[];
}): Promise<Record<string, unknown>> {
  const categoryConfig = params.pluginStrategistOverride?.category
    ? resolveCategoryConfig(params.pluginStrategistOverride.category, params.userCategories)
    : undefined;

  const requirement = AGENT_MODEL_REQUIREMENTS["strategist"];
  const connectedProviders = readConnectedProvidersCache();
  const availableModels = await fetchAvailableModels(undefined, {
    connectedProviders: connectedProviders ?? undefined,
  });

  const configuredStrategistModel =
    params.pluginStrategistOverride?.model ?? categoryConfig?.model;

  const shouldUseCurrentModel = isModelInFallbackChain(
    params.currentModel,
    requirement?.fallbackChain,
  );

  const modelResolution = resolveModelPipeline({
    intent: {
      uiSelectedModel: configuredStrategistModel
        ? undefined
        : shouldUseCurrentModel
          ? params.currentModel
          : undefined,
      userModel: params.pluginStrategistOverride?.model,
      categoryDefaultModel: categoryConfig?.model,
    },
    constraints: { availableModels },
    policy: {
      fallbackChain: requirement?.fallbackChain,
      systemDefaultModel: undefined,
    },
  });

  const resolvedModel = modelResolution?.model;
  const resolvedVariant = modelResolution?.variant;

  const variantToUse = params.pluginStrategistOverride?.variant ?? resolvedVariant;
  const reasoningEffortToUse =
    params.pluginStrategistOverride?.reasoningEffort ?? categoryConfig?.reasoningEffort;
  const textVerbosityToUse =
    params.pluginStrategistOverride?.textVerbosity ?? categoryConfig?.textVerbosity;
  const thinkingToUse = params.pluginStrategistOverride?.thinking ?? categoryConfig?.thinking;
  const temperatureToUse =
    params.pluginStrategistOverride?.temperature ?? categoryConfig?.temperature;
  const topPToUse = params.pluginStrategistOverride?.top_p ?? categoryConfig?.top_p;
  const maxTokensToUse =
    params.pluginStrategistOverride?.maxTokens ?? categoryConfig?.maxTokens;

  const base: Record<string, unknown> = {
    ...(resolvedModel ? { model: resolvedModel } : {}),
    ...(variantToUse ? { variant: variantToUse } : {}),
    mode: "primary",
    prompt: getStrategistPrompt(resolvedModel, params.disabledTools) + "\n\n" + CLOSURE_SCHEMA_PROMPT,
    permission: PROMETHEUS_PERMISSION,
    description: `${(params.configAgentPlan?.description as string) ?? "Plan agent"} (Strategist - HiaiOpenCode)`,
    color: (params.configAgentPlan?.color as string) ?? "#FF5722",
    ...(temperatureToUse !== undefined ? { temperature: temperatureToUse } : {}),
    ...(topPToUse !== undefined ? { top_p: topPToUse } : {}),
    ...(maxTokensToUse !== undefined ? { maxTokens: maxTokensToUse } : {}),
    ...(categoryConfig?.tools ? { tools: categoryConfig.tools } : {}),
    ...(thinkingToUse ? { thinking: thinkingToUse } : {}),
    ...(reasoningEffortToUse !== undefined
      ? { reasoningEffort: reasoningEffortToUse }
      : {}),
    ...(textVerbosityToUse !== undefined
      ? { textVerbosity: textVerbosityToUse }
      : {}),
  };

  const override = params.pluginStrategistOverride;
  if (!override) return base;

  const { prompt_append, ...restOverride } = override;
  const merged = { ...base, ...restOverride };
  if (prompt_append && typeof merged.prompt === "string") {
    merged.prompt = merged.prompt + "\n" + resolvePromptAppend(prompt_append);
  }
  return merged;
}
