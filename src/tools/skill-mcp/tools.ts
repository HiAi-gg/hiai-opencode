import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import type { ToolContext } from "@opencode-ai/plugin/tool"
import { BUILTIN_MCP_TOOL_HINTS, SKILL_MCP_DESCRIPTION } from "./constants"
import type { McpServerConfig } from "../../config/types"
import type { SkillMcpArgs } from "./types"
import type { SkillMcpManager, SkillMcpClientInfo, SkillMcpServerContext } from "../../features/skill-mcp-manager"
import type { ClaudeCodeMcpServer } from "../../features/claude-code-mcp-loader/types"
import type { LoadedSkill } from "../../features/opencode-skill-loader/types"

interface SkillMcpToolOptions {
  manager: SkillMcpManager
  getLoadedSkills: () => LoadedSkill[]
  getSessionID?: () => string | undefined
  builtinMcp?: Record<string, McpServerConfig>
}

type OperationType = { type: "tool" | "resource" | "prompt"; name: string }

function validateOperationParams(args: SkillMcpArgs): OperationType {
  const operations: OperationType[] = []
  if (args.tool_name) operations.push({ type: "tool", name: args.tool_name })
  if (args.resource_name) operations.push({ type: "resource", name: args.resource_name })
  if (args.prompt_name) operations.push({ type: "prompt", name: args.prompt_name })

  if (operations.length === 0) {
    throw new Error(
      `Missing operation. Exactly one of tool_name, resource_name, or prompt_name must be specified.\n\n` +
        `Examples:\n` +
        `  skill_mcp(mcp_name="sqlite", tool_name="query", arguments='{"sql": "SELECT * FROM users"}')\n` +
        `  skill_mcp(mcp_name="memory", resource_name="memory://notes")\n` +
        `  skill_mcp(mcp_name="helper", prompt_name="summarize", arguments='{"text": "..."}')`,
    )
  }

  if (operations.length > 1) {
    const provided = [
      args.tool_name && `tool_name="${args.tool_name}"`,
      args.resource_name && `resource_name="${args.resource_name}"`,
      args.prompt_name && `prompt_name="${args.prompt_name}"`,
    ]
      .filter(Boolean)
      .join(", ")

    throw new Error(
      `Multiple operations specified. Exactly one of tool_name, resource_name, or prompt_name must be provided.\n\n` +
        `Received: ${provided}\n\n` +
        `Use separate calls for each operation.`,
    )
  }

  return operations[0]
}

function findMcpServer(
  mcpName: string,
  skills: LoadedSkill[],
): { skill: LoadedSkill; config: NonNullable<LoadedSkill["mcpConfig"]>[string] } | null {
  for (const skill of skills) {
    if (skill.mcpConfig && mcpName in skill.mcpConfig) {
      return { skill, config: skill.mcpConfig[mcpName] }
    }
  }
  return null
}

function convertBuiltinMcpConfig(config: McpServerConfig): ClaudeCodeMcpServer | null {
  if (config.enabled === false) return null

  if (config.type === "remote") {
    return {
      type: "http",
      url: config.url,
      headers: config.headers,
    }
  }

  const [command, ...args] = config.command ?? []
  if (!command) return null

  return {
    type: "stdio",
    command,
    args,
    env: config.environment,
  }
}

function formatAvailableMcps(skills: LoadedSkill[]): string {
  const mcps: string[] = []
  for (const skill of skills) {
    if (skill.mcpConfig) {
      for (const serverName of Object.keys(skill.mcpConfig)) {
        mcps.push(`  - "${serverName}" from skill "${skill.name}"`)
      }
    }
  }
  return mcps.length > 0 ? mcps.join("\n") : "  (none found)"
}

function formatAvailableBuiltinMcps(builtinMcp: Record<string, McpServerConfig> | undefined): string {
  const names = Object.entries(builtinMcp ?? {})
    .filter(([, config]) => config.enabled !== false)
    .map(([name]) => `  - "${name}" from hiai-opencode config`)

  return names.length > 0 ? names.join("\n") : "  (none found)"
}

function formatBuiltinMcpHint(mcpName: string): string | null {
  const nativeTools = BUILTIN_MCP_TOOL_HINTS[mcpName]
  if (!nativeTools) return null
  return (
    `"${mcpName}" is a builtin MCP, not a skill MCP.\n` +
    `Use the native tools directly:\n` +
    nativeTools.map((toolName) => `  - ${toolName}`).join("\n")
  )
}

function parseArguments(argsJson: string | Record<string, unknown> | undefined): Record<string, unknown> {
  if (!argsJson) return {}
  if (typeof argsJson === "object" && argsJson !== null) {
    return argsJson
  }
  try {
    // Strip outer single quotes if present (common in LLM output)
    const jsonStr = argsJson.startsWith("'") && argsJson.endsWith("'") ? argsJson.slice(1, -1) : argsJson

    const parsed = JSON.parse(jsonStr)
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("Arguments must be a JSON object")
    }
    return parsed as Record<string, unknown>
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    throw new Error(
      `Invalid arguments JSON: ${errorMessage}\n\n` +
        `Expected a valid JSON object, e.g.: '{"key": "value"}'\n` +
        `Received: ${argsJson}`,
    )
  }
}

export function applyGrepFilter(output: string, pattern: string | undefined): string {
  if (!pattern) return output
  try {
    const regex = new RegExp(pattern, "i")
    const lines = output.split("\n")
    const filtered = lines.filter((line) => regex.test(line))
    return filtered.length > 0 ? filtered.join("\n") : `[grep] No lines matched pattern: ${pattern}`
  } catch {
    return output
  }
}

export function createSkillMcpTool(options: SkillMcpToolOptions): ToolDefinition {
  const { manager, getLoadedSkills, getSessionID, builtinMcp } = options

  return tool({
    description: SKILL_MCP_DESCRIPTION,
    args: {
      mcp_name: tool.schema.string().describe("Name of the MCP server from skill config"),
      tool_name: tool.schema.string().optional().describe("MCP tool to call"),
      resource_name: tool.schema.string().optional().describe("MCP resource URI to read"),
      prompt_name: tool.schema.string().optional().describe("MCP prompt to get"),
      arguments: tool.schema
        .union([tool.schema.string(), tool.schema.object({})])
        .optional()
        .describe("JSON string or object of arguments"),
      grep: tool.schema
        .string()
        .optional()
        .describe("Regex pattern to filter output lines (only matching lines returned)"),
    },
    async execute(args: SkillMcpArgs, toolContext: ToolContext) {
      const operation = validateOperationParams(args)
      const skills = getLoadedSkills()
      const found = findMcpServer(args.mcp_name, skills)
      const builtinConfig = builtinMcp?.[args.mcp_name]
      const convertedBuiltinConfig = builtinConfig ? convertBuiltinMcpConfig(builtinConfig) : null

      if (!found && !convertedBuiltinConfig) {
        const builtinHint = formatBuiltinMcpHint(args.mcp_name)
        if (builtinHint) {
          throw new Error(builtinHint)
        }

        throw new Error(
          `MCP server "${args.mcp_name}" not found.\n\n` +
            `Available MCP servers in loaded skills:\n` +
            formatAvailableMcps(skills) +
            `\n\n` +
            `Available MCP servers in hiai-opencode config:\n` +
            formatAvailableBuiltinMcps(builtinMcp) +
            `\n\n` +
            `Hint: Load the skill first for skill-embedded MCPs. Builtin hiai-opencode MCPs can be called directly when enabled in hiai-opencode.json.`,
        )
      }

      const sessionID = toolContext.sessionID || getSessionID?.()
      if (!sessionID) {
        throw new Error("No active session available for skill MCP call.")
      }

      const info: SkillMcpClientInfo = {
        serverName: args.mcp_name,
        skillName: found?.skill.name ?? "hiai-opencode",
        sessionID,
        scope: found?.skill.scope ?? "user",
      }

      const context: SkillMcpServerContext = {
        config: found?.config ?? convertedBuiltinConfig!,
        skillName: found?.skill.name ?? "hiai-opencode",
      }

      const parsedArgs = parseArguments(args.arguments)

      let output: string
      switch (operation.type) {
        case "tool": {
          const result = await manager.callTool(info, context, operation.name, parsedArgs)
          output = JSON.stringify(result, null, 2)
          break
        }
        case "resource": {
          const result = await manager.readResource(info, context, operation.name)
          output = JSON.stringify(result, null, 2)
          break
        }
        case "prompt": {
          const stringArgs: Record<string, string> = {}
          for (const [key, value] of Object.entries(parsedArgs)) {
            stringArgs[key] = String(value)
          }
          const result = await manager.getPrompt(info, context, operation.name, stringArgs)
          output = JSON.stringify(result, null, 2)
          break
        }
      }
      return applyGrepFilter(output, args.grep)
    },
  })
}
