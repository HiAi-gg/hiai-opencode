// PROMPT_VERSION: 2026-04-26
import { buildGuardPrompt } from "./shared-prompt"
import {
  GPT_ATLAS_INTRO,
  GPT_ATLAS_WORKFLOW,
  GPT_ATLAS_PARALLEL_EXECUTION,
  GPT_ATLAS_VERIFICATION_RULES,
  GPT_ATLAS_BOUNDARIES,
  GPT_ATLAS_CRITICAL_RULES,
} from "./gpt-prompt-sections"

export const ATLAS_GPT_SYSTEM_PROMPT = buildGuardPrompt({
  intro: GPT_ATLAS_INTRO,
  workflow: GPT_ATLAS_WORKFLOW,
  parallelExecution: GPT_ATLAS_PARALLEL_EXECUTION,
  verificationRules: GPT_ATLAS_VERIFICATION_RULES,
  boundaries: GPT_ATLAS_BOUNDARIES,
  criticalRules: GPT_ATLAS_CRITICAL_RULES,
})

export function getGptGuardPrompt(): string {
  return ATLAS_GPT_SYSTEM_PROMPT
}
