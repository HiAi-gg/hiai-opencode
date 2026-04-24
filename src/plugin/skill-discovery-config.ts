import type { HiaiOpenCodeConfig } from "../config"
import type { SkillDiscoveryConfig } from "../config/schema"

export type ResolvedSkillDiscoveryConfig = Required<SkillDiscoveryConfig>

const DEFAULT_SKILL_DISCOVERY: ResolvedSkillDiscoveryConfig = {
  config_sources: true,
  project_opencode: true,
  global_opencode: false,
  project_claude: false,
  global_claude: false,
  project_agents: false,
  global_agents: false,
}

export function resolveSkillDiscoveryConfig(
  pluginConfig: HiaiOpenCodeConfig,
): ResolvedSkillDiscoveryConfig {
  const resolved: ResolvedSkillDiscoveryConfig = {
    ...DEFAULT_SKILL_DISCOVERY,
    ...(pluginConfig.skill_discovery ?? {}),
  }

  // Compatibility switch: historically this only controlled Claude-style skills.
  // Keep that meaning, but make it stronger for those two sources.
  if (pluginConfig.claude_code?.skills === false) {
    resolved.project_claude = false
    resolved.global_claude = false
  }

  return resolved
}
