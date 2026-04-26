import { MODE_TO_AGENT } from "../shared/mode-routing"

const WRITE_CAPABLE_AGENTS = new Set(["coder", "sub", "designer", "brainstormer"])

const WRITE_MODES = new Set([
  "quick",
  "bounded",
  "deep",
  "cross-module",
  "visual-engineering",
  "artistry",
  "writing",
])

const READONLY_MODES = new Set(["ultrabrain", "git", "git-ops"])

export function lintModeAgentCapabilities(): void {
  for (const [mode, agent] of Object.entries(MODE_TO_AGENT)) {
    if (WRITE_MODES.has(mode) && !WRITE_CAPABLE_AGENTS.has(agent)) {
      console.warn(`[startup-lint] Mode "${mode}" targets agent "${agent}" which cannot write/edit. Tasks using this mode may fail when attempting file operations.`)
    }

    if (READONLY_MODES.has(mode) && WRITE_CAPABLE_AGENTS.has(agent)) {
      console.warn(`[startup-lint] Mode "${mode}" targets agent "${agent}" which can write. Consider verifying this is intentional.`)
    }
  }
}