import type { CanonicalDelegateAgentKey } from "../tools/delegate-task/sub-agent"

export const MODE_TO_AGENT: Record<string, CanonicalDelegateAgentKey> = {
  quick: "sub",
  writing: "brainstormer",
  deep: "coder",
  ultrabrain: "strategist",
  "visual-engineering": "designer",
  artistry: "designer",
  git: "platform-manager",
  "git-ops": "platform-manager",
  bounded: "sub",
  "cross-module": "coder",
}

const LEGACY_MODE_ALIASES: Record<string, string> = {
  "unspecified-low": "bounded",
  "unspecified-high": "cross-module",
}

export type ModeName = keyof typeof MODE_TO_AGENT
export const MODE_NAMES = Object.keys(MODE_TO_AGENT) as ModeName[]

export function normalizeMode(modeName: string): string {
  return LEGACY_MODE_ALIASES[modeName] ?? modeName
}

export function resolveModeAgent(modeName: string): CanonicalDelegateAgentKey {
  return MODE_TO_AGENT[normalizeMode(modeName)] ?? "coder"
}