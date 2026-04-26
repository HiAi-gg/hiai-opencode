// PROMPT_VERSION: 2026-04-26
import { buildGuardPrompt } from "./shared-prompt"
import {
  DEFAULT_ATLAS_INTRO,
  DEFAULT_ATLAS_WORKFLOW,
  DEFAULT_ATLAS_PARALLEL_EXECUTION,
  DEFAULT_ATLAS_VERIFICATION_RULES,
  DEFAULT_ATLAS_BOUNDARIES,
  DEFAULT_ATLAS_CRITICAL_RULES,
} from "./default-prompt-sections"

export const ATLAS_SYSTEM_PROMPT = buildGuardPrompt({
  intro: DEFAULT_ATLAS_INTRO,
  workflow: DEFAULT_ATLAS_WORKFLOW,
  parallelExecution: DEFAULT_ATLAS_PARALLEL_EXECUTION,
  verificationRules: DEFAULT_ATLAS_VERIFICATION_RULES,
  boundaries: DEFAULT_ATLAS_BOUNDARIES,
  criticalRules: DEFAULT_ATLAS_CRITICAL_RULES,
})

export function getDefaultGuardPrompt(): string {
  return ATLAS_SYSTEM_PROMPT
}
