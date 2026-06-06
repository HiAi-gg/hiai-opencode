import { createBobAgent } from "../src/agents/bob"
import { createCoderAgent } from "../src/agents/coder/agent"
import { createBobJuniorAgentWithOverrides } from "../src/agents/sub/agent"
import { createManagerAgent } from "../src/agents/manager/agent"
import { getStrategistPrompt } from "../src/agents/strategist/index"
import { createResearcherAgent } from "../src/agents/researcher"
import { createDesignerAgent } from "../src/agents/designer"
import { createWriterAgent } from "../src/agents/writer"
import { createMultimodalLookerAgent } from "../src/agents/ui"
import { createCriticAgent } from "../src/agents/critic/agent"
import { createQualityGuardianAgent } from "../src/agents/quality-guardian"
import { mkdirSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const TEST_MODEL = "test-model/snapshot"
const SNAPSHOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "tests", "snapshots", "snapshots")

interface Entry { name: string; factory: () => string }
const AGENTS: Entry[] = [
  { name: "bob", factory: () => createBobAgent(TEST_MODEL, [], [], [], [], false).prompt ?? "" },
  { name: "coder", factory: () => createCoderAgent(TEST_MODEL, [], [], [], [], false).prompt ?? "" },
  { name: "sub", factory: () => createBobJuniorAgentWithOverrides(undefined, TEST_MODEL, false).prompt ?? "" },
  { name: "manager", factory: () => createManagerAgent({ model: TEST_MODEL }).prompt ?? "" },
  { name: "researcher", factory: () => createResearcherAgent(TEST_MODEL).prompt ?? "" },
  { name: "designer", factory: () => createDesignerAgent(TEST_MODEL).prompt ?? "" },
  { name: "writer", factory: () => createWriterAgent(TEST_MODEL).prompt ?? "" },
  { name: "vision", factory: () => createMultimodalLookerAgent(TEST_MODEL).prompt ?? "" },
  { name: "critic", factory: () => createCriticAgent(TEST_MODEL).prompt ?? "" },
  { name: "quality-guardian", factory: () => createQualityGuardianAgent(TEST_MODEL).prompt ?? "" },
]

mkdirSync(SNAPSHOT_DIR, { recursive: true })
for (const { name, factory } of AGENTS) {
  const prompt = factory()
  const bytes = Buffer.byteLength(prompt, "utf8")
  const lines = prompt.split("\n").length
  const content = `// Auto-generated snapshot - do not edit manually
// Agent: ${name}
// Generated: ${new Date().toISOString()}
// Size: ${bytes} bytes, ${lines} lines

export const SNAPSHOT = {
  name: "${name}",
  prompt: ${JSON.stringify(prompt)},
  bytes: ${bytes},
  lines: ${lines},
} as const

export default SNAPSHOT
`
  const path = join(SNAPSHOT_DIR, `${name}.snap.ts`)
  writeFileSync(path, content, "utf8")
  console.log(`${name.padEnd(20)} ${bytes.toString().padStart(6)} bytes  ${lines.toString().padStart(4)} lines`)
}
