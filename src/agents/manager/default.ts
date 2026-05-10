// PROMPT_VERSION: 2026-05-10
// Manager prompt - Delegation Orchestrator
import { buildManagerPrompt } from "./shared-prompt"
import {
  DEFAULT_MANAGER_INTRO,
  DEFAULT_MANAGER_WORKFLOW,
  DEFAULT_MANAGER_PARALLEL_EXECUTION,
  DEFAULT_MANAGER_BOUNDARIES,
  DEFAULT_MANAGER_CRITICAL_RULES,
} from "./default-prompt-sections"

// Note: We no longer have verification rules in Manager prompts - that's Critic's job

export const MANAGER_SYSTEM_PROMPT = buildManagerPrompt({
  intro: DEFAULT_MANAGER_INTRO,
  workflow: DEFAULT_MANAGER_WORKFLOW,
  parallelExecution: DEFAULT_MANAGER_PARALLEL_EXECUTION,
  verificationRules: "", // Removed - Critic handles verification
  boundaries: DEFAULT_MANAGER_BOUNDARIES,
  criticalRules: DEFAULT_MANAGER_CRITICAL_RULES,
})

export function getDefaultManagerPrompt(): string {
  return MANAGER_SYSTEM_PROMPT
}
