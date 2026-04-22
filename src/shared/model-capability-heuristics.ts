import { normalizeModelID } from "./model-normalization"
import type { HeuristicModelFamilyDefinition, HiaiOpencodeConfig } from "../config/types"

let HEURISTIC_MODEL_FAMILY_REGISTRY: Array<HeuristicModelFamilyDefinition & { _patternObj?: RegExp }> = [];

/**
 * Initializes the model family heuristics from configuration.
 */
export function initializeModelHeuristics(config: HiaiOpencodeConfig) {
  if (config.modelFamilies) {
    HEURISTIC_MODEL_FAMILY_REGISTRY = config.modelFamilies.map(def => ({
      ...def,
      _patternObj: def.pattern ? new RegExp(def.pattern) : undefined
    }));
  }
}

export function detectHeuristicModelFamily(modelID: string): HeuristicModelFamilyDefinition | undefined {
  const normalizedModelID = normalizeModelID(modelID).toLowerCase()

  for (const definition of HEURISTIC_MODEL_FAMILY_REGISTRY) {
    if (definition._patternObj?.test(normalizedModelID)) {
      return definition
    }

    if (definition.includes?.some((value) => normalizedModelID.includes(value.toLowerCase()))) {
      return definition
    }
  }

  return undefined
}
