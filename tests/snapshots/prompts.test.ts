/**
 * Snapshot test for agent prompts.
 * Verifies that agent prompts don't regress by comparing against stored snapshots.
 *
 * Run with: bun test tests/snapshots/prompts.test.ts
 * First run creates baseline snapshots in tests/snapshots/snapshots/
 */

import { describe, it, expect, beforeAll } from "bun:test"
import { mkdirSync, writeFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { createBobAgent } from "../../src/agents/bob"
import { createCoderAgent } from "../../src/agents/coder/agent"
import { createBobJuniorAgentWithOverrides } from "../../src/agents/sub/agent"
import { createManagerAgent } from "../../src/agents/manager/agent"
import { getStrategistPrompt } from "../../src/agents/strategist/index"
import { createResearcherAgent } from "../../src/agents/researcher"
import { createDesignerAgent } from "../../src/agents/designer"
import { createWriterAgent } from "../../src/agents/writer"
import { createMultimodalLookerAgent } from "../../src/agents/ui"
import { createCriticAgent } from "../../src/agents/critic/agent"
import { createQualityGuardianAgent } from "../../src/agents/quality-guardian"

const TEST_MODEL = "test-model/snapshot"
const SNAPSHOT_DIR = join(dirname(fileURLToPath(import.meta.url)), "snapshots")

interface AgentSnapshot {
  name: string
  prompt: string
  bytes: number
  lines: number
}

type AgentFactory = () => string

const AGENTS: { name: string; factory: AgentFactory }[] = [
  { name: "bob", factory: () => createBobAgent(TEST_MODEL, [], [], [], [], false).prompt ?? "" },
  { name: "coder", factory: () => createCoderAgent(TEST_MODEL, [], [], [], [], false).prompt ?? "" },
  { name: "sub", factory: () => createBobJuniorAgentWithOverrides(undefined, TEST_MODEL, false).prompt ?? "" },
  { name: "manager", factory: () => createManagerAgent({ model: TEST_MODEL }).prompt ?? "" },
  { name: "strategist", factory: () => getStrategistPrompt(TEST_MODEL) },
  { name: "researcher", factory: () => createResearcherAgent(TEST_MODEL).prompt ?? "" },
  { name: "designer", factory: () => createDesignerAgent(TEST_MODEL).prompt ?? "" },
  { name: "writer", factory: () => createWriterAgent(TEST_MODEL).prompt ?? "" },
  { name: "vision", factory: () => createMultimodalLookerAgent(TEST_MODEL).prompt ?? "" },
  { name: "critic", factory: () => createCriticAgent(TEST_MODEL).prompt ?? "" },
  { name: "quality-guardian", factory: () => createQualityGuardianAgent(TEST_MODEL).prompt ?? "" },
]

function asPrompt(cfg: { prompt?: string }): string {
  return cfg.prompt ?? ""
}

function captureSnapshot(name: string, factory: () => string): AgentSnapshot {
  const prompt = factory()
  return {
    name,
    prompt,
    bytes: Buffer.byteLength(prompt, "utf8"),
    lines: prompt.split("\n").length,
  }
}

function getSnapshotPath(agentName: string): string {
  return join(SNAPSHOT_DIR, `${agentName}.snap.ts`)
}

async function loadSnapshot(agentName: string): Promise<AgentSnapshot | null> {
  const path = getSnapshotPath(agentName)
  if (!existsSync(path)) return null

  try {
    const mod = await import(path)
    return mod.SNAPSHOT as AgentSnapshot
  } catch {
    return null
  }
}

function saveSnapshot(snapshot: AgentSnapshot): void {
  mkdirSync(SNAPSHOT_DIR, { recursive: true })
  const path = getSnapshotPath(snapshot.name)

  const content = `// Auto-generated snapshot - do not edit manually
// Agent: ${snapshot.name}
// Generated: ${new Date().toISOString()}
// Size: ${snapshot.bytes} bytes, ${snapshot.lines} lines

export const SNAPSHOT = {
  name: "${snapshot.name}",
  prompt: ${JSON.stringify(snapshot.prompt)},
  bytes: ${snapshot.bytes},
  lines: ${snapshot.lines},
} as const

export default SNAPSHOT
`

  writeFileSync(path, content, "utf8")
}

// Load all snapshots
async function loadAllSnapshots(): Promise<Map<string, AgentSnapshot>> {
  const snapshots = new Map()
  for (const { name } of AGENTS) {
    const snap = await loadSnapshot(name)
    if (snap) snapshots.set(name, snap)
  }
  return snapshots
}

describe("Agent prompt snapshots", () => {
  let currentSnapshots: Map<string, AgentSnapshot>

  beforeAll(async () => {
    // Capture current state of all agent prompts
    const captured = new Map<string, AgentSnapshot>()
    for (const agent of AGENTS) {
      const snapshot = captureSnapshot(agent.name, agent.factory)
      captured.set(agent.name, snapshot)
    }
    currentSnapshots = captured

    // Ensure snapshot directory exists
    mkdirSync(SNAPSHOT_DIR, { recursive: true })
  })

  describe("Snapshot creation", () => {
    it("creates baseline snapshots for all agents on first run", async () => {
      // This test runs once to bootstrap snapshots
      // In CI/normal runs, snapshots should already exist

      const missing: string[] = []
      for (const { name } of AGENTS) {
        const snap = await loadSnapshot(name)
        if (!snap) missing.push(name)
      }

      if (missing.length > 0) {
        if (process.env.CI) {
          throw new Error(`Snapshot file missing: ${missing.join(", ")}. Run tests locally to generate.`);
        }
        // First run: create baseline snapshots
        console.log(`[snapshot] Creating baseline for: ${missing.join(", ")}`)
        for (const name of missing) {
          const snap = currentSnapshots.get(name)
          if (snap) saveSnapshot(snap)
        }
      }

      // Verify all snapshots now exist
      const allSnapshots = await loadAllSnapshots()
      expect(allSnapshots.size).toBe(AGENTS.length)
    })
  })

  describe("Prompt regression detection", () => {
    it("bob prompt matches snapshot", async () => {
      const snap = await loadSnapshot("bob")
      const current = currentSnapshots.get("bob")!

      if (!snap) {
        if (process.env.CI) {
          throw new Error(`Snapshot file missing: ${getSnapshotPath(current.name)}. Run tests locally to generate.`);
        }
        // First run - create snapshot
        saveSnapshot(current)
        return
      }

      expect(current.prompt).toBe(snap.prompt)
      expect(current.bytes).toBe(snap.bytes)
    })

    it("coder prompt matches snapshot", async () => {
      const snap = await loadSnapshot("coder")
      const current = currentSnapshots.get("coder")!

      if (!snap) {
        if (process.env.CI) {
          throw new Error(`Snapshot file missing: ${getSnapshotPath(current.name)}. Run tests locally to generate.`);
        }
        saveSnapshot(current)
        return
      }

      expect(current.prompt).toBe(snap.prompt)
      expect(current.bytes).toBe(snap.bytes)
    })

    it("sub prompt matches snapshot", async () => {
      const snap = await loadSnapshot("sub")
      const current = currentSnapshots.get("sub")!

      if (!snap) {
        if (process.env.CI) {
          throw new Error(`Snapshot file missing: ${getSnapshotPath(current.name)}. Run tests locally to generate.`);
        }
        saveSnapshot(current)
        return
      }

      expect(current.prompt).toBe(snap.prompt)
      expect(current.bytes).toBe(snap.bytes)
    })

    it("manager prompt matches snapshot", async () => {
      const snap = await loadSnapshot("manager")
      const current = currentSnapshots.get("manager")!

      if (!snap) {
        if (process.env.CI) {
          throw new Error(`Snapshot file missing: ${getSnapshotPath(current.name)}. Run tests locally to generate.`);
        }
        saveSnapshot(current)
        return
      }

      expect(current.prompt).toBe(snap.prompt)
      expect(current.bytes).toBe(snap.bytes)
    })

    it.skip("strategist prompt matches snapshot", async () => {
      const snap = await loadSnapshot("strategist")
      const current = currentSnapshots.get("strategist")!

      if (!snap) {
        if (process.env.CI) {
          throw new Error(`Snapshot file missing: ${getSnapshotPath(current.name)}. Run tests locally to generate.`);
        }
        saveSnapshot(current)
        return
      }

      expect(current.prompt).toBe(snap.prompt)
      expect(current.bytes).toBe(snap.bytes)
    })

    it("researcher prompt matches snapshot", async () => {
      const snap = await loadSnapshot("researcher")
      const current = currentSnapshots.get("researcher")!

      if (!snap) {
        if (process.env.CI) {
          throw new Error(`Snapshot file missing: ${getSnapshotPath(current.name)}. Run tests locally to generate.`);
        }
        saveSnapshot(current)
        return
      }

      expect(current.prompt).toBe(snap.prompt)
      expect(current.bytes).toBe(snap.bytes)
    })

    it("designer prompt matches snapshot", async () => {
      const snap = await loadSnapshot("designer")
      const current = currentSnapshots.get("designer")!

      if (!snap) {
        if (process.env.CI) {
          throw new Error(`Snapshot file missing: ${getSnapshotPath(current.name)}. Run tests locally to generate.`);
        }
        saveSnapshot(current)
        return
      }

      expect(current.prompt).toBe(snap.prompt)
      expect(current.bytes).toBe(snap.bytes)
    })

    it("writer prompt matches snapshot", async () => {
      const snap = await loadSnapshot("writer")
      const current = currentSnapshots.get("writer")!

      if (!snap) {
        if (process.env.CI) {
          throw new Error(`Snapshot file missing: ${getSnapshotPath(current.name)}. Run tests locally to generate.`);
        }
        saveSnapshot(current)
        return
      }

      expect(current.prompt).toBe(snap.prompt)
      expect(current.bytes).toBe(snap.bytes)
    })

    it("vision prompt matches snapshot", async () => {
      const snap = await loadSnapshot("vision")
      const current = currentSnapshots.get("vision")!

      if (!snap) {
        if (process.env.CI) {
          throw new Error(`Snapshot file missing: ${getSnapshotPath(current.name)}. Run tests locally to generate.`);
        }
        saveSnapshot(current)
        return
      }

      expect(current.prompt).toBe(snap.prompt)
      expect(current.bytes).toBe(snap.bytes)
    })

    it("critic prompt matches snapshot", async () => {
      const snap = await loadSnapshot("critic")
      const current = currentSnapshots.get("critic")!

      if (!snap) {
        if (process.env.CI) {
          throw new Error(`Snapshot file missing: ${getSnapshotPath(current.name)}. Run tests locally to generate.`);
        }
        saveSnapshot(current)
        return
      }

      expect(current.prompt).toBe(snap.prompt)
      expect(current.bytes).toBe(snap.bytes)
    })

    it("quality-guardian prompt matches snapshot", async () => {
      const snap = await loadSnapshot("quality-guardian")
      const current = currentSnapshots.get("quality-guardian")!

      if (!snap) {
        if (process.env.CI) {
          throw new Error(`Snapshot file missing: ${getSnapshotPath(current.name)}. Run tests locally to generate.`);
        }
        saveSnapshot(current)
        return
      }

      expect(current.prompt).toBe(snap.prompt)
      expect(current.bytes).toBe(snap.bytes)
    })
  })

  describe("Snapshot metadata", () => {
    it("all snapshots have expected structure", async () => {
      for (const { name } of AGENTS) {
        const snap = await loadSnapshot(name)
        expect(snap).not.toBeNull()
        expect(snap!.name).toBe(name)
        expect(typeof snap!.prompt).toBe("string")
        expect(snap!.bytes).toBeGreaterThan(0)
        expect(snap!.lines).toBeGreaterThan(0)
      }
    })

    it("snapshot sizes are reasonable", async () => {
      for (const { name } of AGENTS) {
        const snap = await loadSnapshot(name)
        if (snap) {
          // Basic sanity checks
          expect(snap.bytes).toBeGreaterThan(100) // At least some content
          expect(snap.lines).toBeGreaterThan(10) // At least some lines
        }
      }
    })
  })
})

describe("Prompt measurement consistency", () => {
  it("bob produces expected line count", () => {
    const prompt = asPrompt(createBobAgent(TEST_MODEL, [], [], [], [], false))
    const lines = prompt.split("\n").length
    // Bob is the largest prompt - should be substantial
    expect(lines).toBeGreaterThan(200)
  })

  it("coder produces expected line count", () => {
    const prompt = asPrompt(createCoderAgent(TEST_MODEL, [], [], [], [], false))
    const lines = prompt.split("\n").length
    expect(lines).toBeGreaterThan(150)
  })

  it("manager produces expected line count", () => {
    const prompt = asPrompt(createManagerAgent({ model: TEST_MODEL }))
    const lines = prompt.split("\n").length
    expect(lines).toBeGreaterThan(500)
  })
})