import type { HiaiOpencodeConfig, ModelRequirement } from "../config/types.js";

export type { FallbackEntry, ModelRequirement } from "../config/types.js";

/**
 * Model requirements for agents. Initialized at runtime from configuration.
 */
export let AGENT_MODEL_REQUIREMENTS: Record<string, ModelRequirement> = {};

/**
 * Model requirements for categories. Initialized at runtime from configuration.
 */
export let CATEGORY_MODEL_REQUIREMENTS: Record<string, ModelRequirement> = {};

/**
 * Initializes the model requirements from the provided configuration.
 * Should be called once during plugin startup.
 */
export function initializeModelRequirements(config: HiaiOpencodeConfig) {
  if (config.agentRequirements) {
    AGENT_MODEL_REQUIREMENTS = config.agentRequirements;
  }
  if (config.categoryRequirements) {
    CATEGORY_MODEL_REQUIREMENTS = config.categoryRequirements;
  }
}
