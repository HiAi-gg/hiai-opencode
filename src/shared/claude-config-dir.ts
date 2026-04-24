import { homedir } from "node:os"
import { join } from "node:path"

export function getClaudeConfigDir(): string {
  const envConfigDir = process.env.CLAUDE_CONFIG_DIR
  if (envConfigDir) {
    return envConfigDir
  }

  const opencodeConfigDir = process.env.OPENCODE_CONFIG_DIR
  if (opencodeConfigDir) {
    return opencodeConfigDir
  }
  
  return join(homedir(), ".claude")
}
