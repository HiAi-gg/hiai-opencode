/**
 * Prompt size snapshot — runs the public agent prompt builders with stub
 * inputs and writes a sorted line-per-agent file to dist/prompt-snapshots/.
 *
 * Goal: detect prompt regressions in PR review (size jumps, accidental loss
 * of sections). Not a perfect render — uses empty agent/skill/category lists
 * — but catches the bulk of structural changes.
 *
 * Run: bun run prompts:measure
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { createBobAgent } from "../src/agents/bob"
import { createCoderAgent } from "../src/agents/coder/agent"
import { createBobJuniorAgentWithOverrides } from "../src/agents/sub/agent"
import { createGuardAgent } from "../src/agents/guard/agent"
import { getStrategistPrompt } from "../src/agents/strategist/system-prompt"
import { createResearcherAgent } from "../src/agents/researcher"
import { createDesignerAgent } from "../src/agents/designer"
import { createBrainstormerAgent } from "../src/agents/brainstormer"
import { createPlatformManagerAgent } from "../src/agents/platform-manager"
import { createMultimodalLookerAgent } from "../src/agents/ui"
import { createCriticAgent } from "../src/agents/critic/agent"
import { createQualityGuardianAgent } from "../src/agents/quality-guardian"

interface Snapshot {
  agent: string
  bytes: number
  lines: number
}

function snapshot(agent: string, prompt: string): Snapshot {
  return {
    agent,
    bytes: Buffer.byteLength(prompt, "utf8"),
    lines: prompt.split("\n").length,
  }
}

function asPrompt(cfg: { prompt?: string }): string {
  return cfg.prompt ?? ""
}

const stubModel = "openrouter/anthropic/claude-sonnet-4-20250514"

const snapshots: Snapshot[] = [
  snapshot("bob", asPrompt(createBobAgent(stubModel, [], [], [], [], false))),
  snapshot("coder", asPrompt(createCoderAgent(stubModel, [], [], [], [], false))),
  snapshot("sub", asPrompt(createBobJuniorAgentWithOverrides(undefined, stubModel, false))),
  snapshot("guard", asPrompt(createGuardAgent({ model: stubModel }))),
  snapshot("strategist", getStrategistPrompt(stubModel)),
  snapshot("researcher", asPrompt(createResearcherAgent(stubModel))),
  snapshot("designer", asPrompt(createDesignerAgent(stubModel))),
  snapshot("brainstormer", asPrompt(createBrainstormerAgent(stubModel))),
  snapshot("platform-manager", asPrompt(createPlatformManagerAgent(stubModel))),
  snapshot("vision", asPrompt(createMultimodalLookerAgent(stubModel))),
  snapshot("critic", asPrompt(createCriticAgent(stubModel))),
  snapshot("quality-guardian", asPrompt(createQualityGuardianAgent(stubModel))),
]

snapshots.sort((a, b) => a.agent.localeCompare(b.agent))

const outDir = join(process.cwd(), "dist", "prompt-snapshots")
mkdirSync(outDir, { recursive: true })

const summary = snapshots
  .map((s) => `${s.agent.padEnd(20)} ${String(s.bytes).padStart(7)} bytes  ${String(s.lines).padStart(5)} lines`)
  .join("\n")

const total = snapshots.reduce((sum, s) => sum + s.bytes, 0)
const totalLine = `\n${"TOTAL".padEnd(20)} ${String(total).padStart(7)} bytes`

writeFileSync(join(outDir, "summary.txt"), summary + totalLine + "\n", "utf8")

console.log(summary)
console.log(totalLine.trim())
console.log(`\nWrote: ${join(outDir, "summary.txt")}`)
