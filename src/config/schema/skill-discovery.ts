import { z } from "zod"

export const SkillDiscoveryConfigSchema = z.object({
  /**
   * Explicit skills.sources entries from hiai-opencode config.
   * Safe by default because the user intentionally configured them.
   */
  config_sources: z.boolean().default(true),
  /**
   * Project-local OpenCode skills: .opencode/skills and .opencode/skill.
   * Kept on by default because they are part of the current project contract.
   */
  project_opencode: z.boolean().default(true),
  /**
   * Global OpenCode skills from the user's OpenCode config directory.
   * Off by default to keep clean installs deterministic.
   */
  global_opencode: z.boolean().default(false),
  project_claude: z.boolean().default(false),
  global_claude: z.boolean().default(false),
  project_agents: z.boolean().default(false),
  global_agents: z.boolean().default(false),
})

export type SkillDiscoveryConfig = z.infer<typeof SkillDiscoveryConfigSchema>
