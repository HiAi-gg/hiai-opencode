import { spawn } from "bun"
import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"

const INSTALL_TIMEOUT_MS = 60_000
const DOCTOR_TIMEOUT_MS = 30_000

function makeToolErrorHandler(toolName: string) {
  return (error: unknown): string => {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes("command not found") || message.includes("not found") || message.includes("ENOENT")) {
      if (toolName === "agent_browser_install") {
        return `agent-browser is not installed. Run the agent_browser_install tool to install it first.`
      }
      return `agent-browser is not installed or not in PATH. Install it with: npm install -g agent-browser@latest && agent-browser install`
    }
    return `Error: ${message}`
  }
}

export interface AgentBrowserIntegrationToolEntry {
  name: string
  tool: ToolDefinition
}

export function createAgentBrowserIntegrationTool(): AgentBrowserIntegrationToolEntry[] {
  const agent_browser_install: ToolDefinition = tool({
    description: "Install agent-browser globally via npm and run browser installation. Use this when agent-browser is not found or needs to be updated. Returns installation output and version check.",
    args: {},
    execute: async () => {
      try {
        const command = "npm install -g agent-browser@latest && agent-browser install"
        const [stdout, stderr, exitCode] = await executeWithTimeout(command, INSTALL_TIMEOUT_MS)

        if (exitCode !== 0) {
          const errorMsg = stderr.trim() || `Installation failed with exit code ${exitCode}`
          return `Error: ${errorMsg}`
        }

        const verifyProc = spawn(["agent-browser", "--version"], { stdout: "pipe", stderr: "pipe" })
        const [verifyStdout, , verifyExit] = await Promise.all([
          new Response(verifyProc.stdout).text(),
          new Response(verifyProc.stderr).text(),
          verifyProc.exited,
        ])

        if (verifyExit === 0) {
          return `Installation successful. Version: ${verifyStdout.trim()}`
        }
        return stdout || "Installation completed but version check failed."
      } catch (e) {
        return makeToolErrorHandler("agent_browser_install")(e)
      }
    },
  })

  const agent_browser_doctor: ToolDefinition = tool({
    description: "Run agent-browser health check in offline quick mode. Checks if the browser daemon is running, Chrome is installed, and configuration is valid. Returns doctor output with pass/fail status for each check.",
    args: {},
    execute: async () => {
      try {
        const command = "agent-browser doctor --offline --quick"
        const [stdout, stderr, exitCode] = await executeWithTimeout(command, DOCTOR_TIMEOUT_MS)

        if (exitCode !== 0) {
          const errorMsg = stderr.trim() || `Doctor check failed with exit code ${exitCode}`
          return `Error: ${errorMsg}`
        }

        return stdout || "Doctor check completed."
      } catch (e) {
        return makeToolErrorHandler("agent_browser_doctor")(e)
      }
    },
  })

  return [
    { name: "agent_browser_install", tool: agent_browser_install },
    { name: "agent_browser_doctor", tool: agent_browser_doctor },
  ]
}

async function executeWithTimeout(
  command: string,
  timeoutMs: number
): Promise<[stdout: string, stderr: string, exitCode: number]> {
  const proc = Bun.spawn(["sh", "-c", command], {
    stdout: "pipe",
    stderr: "pipe",
  })

  const timeoutPromise = new Promise<never>((_, reject) => {
    const id = setTimeout(() => {
      try {
        proc.kill()
      } catch {
        // Ignore kill errors
      }
      reject(new Error(`Timeout after ${timeoutMs}ms`))
    }, timeoutMs)

    proc.exited
      .then(() => clearTimeout(id))
      .catch(() => clearTimeout(id))
  })

  const [stdout, stderr, exitCode] = await Promise.race([
    Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]),
    timeoutPromise,
  ])

  return [stdout, stderr, exitCode]
}