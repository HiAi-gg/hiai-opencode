// up.mjs — Launch/stop opencode server + web UI under one command.
//
// Cline bridge: cline/cline2 are OpenCode provider entries (configured in
// opencode.jsonc or bob.json), NOT separate processes. This script ensures the
// plugin + providers are present in the resolved config and starts the
// headless server (opencode serve) plus the web frontend (opencode web).
//
// State: PIDs + ports are written to $HOME/.hiai-opencode/run/ so `down` and
// `status` can manage the spawned processes.

import { spawn } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { dirname, join } from "node:path"
import { homedir } from "node:os"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const PACKAGE_ROOT = join(__dirname, "..", "..")

const RUN_DIR = join(homedir(), ".hiai-opencode", "run")
const STATE_FILE = join(RUN_DIR, "opencode-stack.json")

const DEFAULT_SERVE_PORT = Number(process.env.HIAI_OPENCODE_SERVE_PORT) || 4096
const DEFAULT_WEB_PORT = Number(process.env.HIAI_OPENCODE_WEB_PORT) || 4097
const HOSTNAME = process.env.HIAI_OPENCODE_HOSTNAME || "127.0.0.1"

function parseJsonc(text) {
  const stripped = text.replace(
    /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\/\/.*$|\/\*[\s\S]*?\*\/|,(?=\s*[}\]])/gm,
    (_m, str) => (str !== undefined ? str : ""),
  )
  try {
    return JSON.parse(stripped)
  } catch {
    return null
  }
}

function findOpenCodeConfig() {
  const candidates = [
    join(homedir(), ".config", "opencode", "opencode.jsonc"),
    join(homedir(), ".config", "opencode", "opencode.json"),
    join(process.cwd(), ".opencode", "opencode.jsonc"),
    join(process.cwd(), ".opencode", "opencode.json"),
    join(process.cwd(), "opencode.jsonc"),
    join(process.cwd(), "opencode.json"),
  ]
  for (const path of candidates) {
    if (existsSync(path)) return path
  }
  return null
}

function hasPlugin(path) {
  if (!path) return false
  const parsed = parseJsonc(readFileSync(path, "utf-8")) ?? {}
  const plugins = Array.isArray(parsed?.plugin) ? parsed.plugin : []
  return plugins.some((p) => String(p).includes("@hiai-gg/hiai-opencode"))
}

function resolveOpencodeBinary() {
  const candidates = [
    process.env.OPENCODE_BIN,
    join(homedir(), ".bun", "bin", "opencode"),
    "opencode",
  ].filter(Boolean)
  for (const bin of candidates) {
    const res = spawnSync("command", ["-v", bin], { stdio: "ignore" })
    if (res.status === 0) return bin
  }
  return "opencode"
}

function loadState() {
  if (!existsSync(STATE_FILE)) return null
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf-8"))
  } catch {
    return null
  }
}

function saveState(state) {
  if (!existsSync(RUN_DIR)) mkdirSync(RUN_DIR, { recursive: true })
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

function isAlive(pid) {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function parseArgs(argv) {
  const args = { servePort: DEFAULT_SERVE_PORT, webPort: DEFAULT_WEB_PORT }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--serve-port") args.servePort = Number(argv[++i]) || args.servePort
    else if (a === "--web-port") args.webPort = Number(argv[++i]) || args.webPort
    else if (a === "--host") HOSTNAME_OVERRIDE = argv[++i]
  }
  return args
}

let HOSTNAME_OVERRIDE

export async function up(argv = []) {
  const args = parseArgs(argv)
  const host = HOSTNAME_OVERRIDE || HOSTNAME
  const bin = resolveOpencodeBinary()

  const configPath = findOpenCodeConfig()
  const pluginOk = hasPlugin(configPath)
  if (!pluginOk) {
    console.warn(
      `⚠️  @hiai-gg/hiai-opencode not found in ${configPath || "any opencode config"}. ` +
        "Install it with: opencode plugin @hiai-gg/hiai-opencode@latest --global",
    )
  }

  const existing = loadState()
  if (existing) {
    const serveAlive = isAlive(existing.servePid)
    const webAlive = isAlive(existing.webPid)
    if (serveAlive || webAlive) {
      console.log("ℹ️  Stack already running:")
      if (serveAlive)
        console.log(`   serve  pid=${existing.servePid}  http://${host}:${existing.servePort}`)
      if (webAlive)
        console.log(`   web    pid=${existing.webPid}  http://${host}:${existing.webPort}`)
      console.log("   Run `hiai-opencode down` first to restart.")
      return
    }
  }

  console.log(`Starting opencode serve on ${host}:${args.servePort} ...`)
  const serve = spawn(
    bin,
    ["serve", "--port", String(args.servePort), "--hostname", host],
    { stdio: "ignore", detached: true },
  )
  serve.unref()

  console.log(`Starting opencode web on ${host}:${args.webPort} ...`)
  const web = spawn(
    bin,
    ["web", "--port", String(args.webPort), "--hostname", host],
    { stdio: "ignore", detached: true },
  )
  web.unref()

  saveState({
    servePid: serve.pid,
    webPid: web.pid,
    servePort: args.servePort,
    webPort: args.webPort,
    host,
    startedAt: new Date().toISOString(),
    bin,
  })

  console.log("✅ Stack launched:")
  console.log(`   serve  pid=${serve.pid}  http://${host}:${args.servePort}`)
  console.log(`   web    pid=${web.pid}  http://${host}:${args.webPort}`)
  console.log("\nManage with: hiai-opencode status | hiai-opencode down")
}

export async function down() {
  const state = loadState()
  if (!state) {
    console.log("ℹ️  No running stack found.")
    return
  }

  let killed = 0
  for (const key of ["servePid", "webPid"]) {
    const pid = state[key]
    if (pid && isAlive(pid)) {
      try {
        process.kill(pid, "SIGTERM")
        killed++
      } catch {
        // already gone
      }
    }
  }

  rmSync(STATE_FILE, { force: true })
  if (killed > 0) console.log(`✅ Stopped ${killed} process(es).`)
  else console.log("ℹ️  No live processes to stop (stale state cleared).")
}

export async function status() {
  const state = loadState()
  if (!state) {
    console.log("ℹ️  Stack is down. Run `hiai-opencode up` to start.")
    return
  }

  const serveAlive = isAlive(state.servePid)
  const webAlive = isAlive(state.webPid)
  const host = state.host || HOSTNAME

  console.log("hiai-opencode stack status:")
  console.log(
    `   serve  ${serveAlive ? "● running" : "○ stopped"}  pid=${state.servePid ?? "-"}  http://${host}:${state.servePort}`,
  )
  console.log(
    `   web    ${webAlive ? "● running" : "○ stopped"}  pid=${state.webPid ?? "-"}  http://${host}:${state.webPort}`,
  )
  console.log(`   started: ${state.startedAt ?? "unknown"}`)

  if (!serveAlive && !webAlive) {
    console.log("\nℹ️  Stale state — run `hiai-opencode down` to clean up.")
  }
}
