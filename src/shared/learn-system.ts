import * as fs from "node:fs"
import * as path from "node:path"
import { getOmoOpenCodeCacheDir } from "./data-path.js"

export interface LearnEntry {
  id: string
  timestamp: string
  task: string
  outcome: "success" | "partial" | "failed"
  conventions: string[]
  successes: string[]
  failures: string[]
  gotchas: string[]
  commands: string[]
  agents: string[]
  mcpUsed: string[]
  tags: string[]
}

const LEARN_FILE = "learn-history.jsonl"
const MAX_ENTRIES = 1000

function getLearnPath(): string {
  return path.join(getOmoOpenCodeCacheDir(), LEARN_FILE)
}

export function captureLearn(entry: Omit<LearnEntry, "id" | "timestamp">): LearnEntry {
  const full: LearnEntry = {
    ...entry,
    id: `learn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    timestamp: new Date().toISOString(),
  }
  const filePath = getLearnPath()
  const dir = path.dirname(filePath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.appendFileSync(filePath, JSON.stringify(full) + "\n", "utf-8")
  pruneLearnHistory()
  return full
}

function pruneLearnHistory(): void {
  const filePath = getLearnPath()
  if (!fs.existsSync(filePath)) return
  const lines = fs.readFileSync(filePath, "utf-8").split("\n").filter(Boolean)
  if (lines.length <= MAX_ENTRIES) return
  const keep = lines.slice(-MAX_ENTRIES)
  fs.writeFileSync(filePath, keep.join("\n") + "\n", "utf-8")
}

export function getRelevantLearns(query: string, limit = 5): LearnEntry[] {
  const filePath = getLearnPath()
  if (!fs.existsSync(filePath)) return []
  const lines = fs.readFileSync(filePath, "utf-8").split("\n").filter(Boolean)
  const ql = query.toLowerCase()
  const scored = lines.map(line => {
    const entry: LearnEntry = JSON.parse(line)
    const score = [
      entry.task,
      ...entry.conventions,
      ...entry.successes,
      ...entry.failures,
      ...entry.gotchas,
      ...entry.tags,
    ].join(" ").toLowerCase().includes(ql)
      ? 1
      : 0
    return { entry, score }
  })
  return scored
    .filter(s => s.score > 0)
    .sort(() => Math.random() - 0.5)
    .slice(0, limit)
    .map(s => s.entry)
}

export function getRecentLearns(limit = 10): LearnEntry[] {
  const filePath = getLearnPath()
  if (!fs.existsSync(filePath)) return []
  const lines = fs.readFileSync(filePath, "utf-8").split("\n").filter(Boolean)
  return lines.slice(-limit).map(line => JSON.parse(line) as LearnEntry)
}

export function formatLearnEntriesForPrompt(learns: LearnEntry[]): string {
  if (!learns.length) return ""
  const blocks = learns.map(l => {
    const agents = l.agents.join(", ") || "unknown"
    const tags = l.tags.join(", ") || "general"
    const conventions = l.conventions.length ? `  Conventions: ${l.conventions.join("; ")}` : ""
    const gotchas = l.gotchas.length ? `  Gotchas: ${l.gotchas.join("; ")}` : ""
    const failures = l.failures.length ? `  Avoid: ${l.failures.join("; ")}` : ""
    return `[${tags}] ${l.task}\n  Outcome: ${l.outcome}${conventions}${gotchas}${failures}`
  })
  return `<relevant_learns>\n${blocks.join("\n\n")}\n</relevant_learns>`
}