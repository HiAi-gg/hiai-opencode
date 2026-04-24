import { homedir } from "node:os"
import { join, resolve } from "node:path"

function resolveAgentsDir(pathValue: string): string {
  return resolve(pathValue)
}

export function getAgentsConfigDir(): string {
  const explicitDir =
    process.env.AGENTS_CONFIG_DIR?.trim() ||
    process.env.OPENCODE_AGENTS_DIR?.trim()

  if (explicitDir) {
    return resolveAgentsDir(explicitDir)
  }

  const opencodeConfigDir = process.env.OPENCODE_CONFIG_DIR?.trim()
  if (opencodeConfigDir) {
    return resolveAgentsDir(join(opencodeConfigDir, ".agents"))
  }

  return resolveAgentsDir(join(homedir(), ".agents"))
}
