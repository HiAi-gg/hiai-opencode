import type { HiaiOpenCodeConfig } from "../config"
import type {
  CategoryConfig as PlatformCategoryConfig,
  HiaiOpencodeConfig,
  LspServerConfig,
  McpServerConfig,
} from "../config"

type RuntimePluginConfig = HiaiOpenCodeConfig & {
  __platformDefaults?: HiaiOpencodeConfig
}

function mergeRecords<T extends Record<string, unknown>>(
  base: T | undefined,
  override: T | undefined,
): T | undefined {
  if (!base && !override) return undefined
  return {
    ...(base ?? {}),
    ...(override ?? {}),
  } as T
}

function toRuntimeCategory(
  category: PlatformCategoryConfig,
): Record<string, unknown> {
  return {
    description: category.description,
    model: category.model,
    variant: category.variant,
  }
}

function hydrateAgentDefaults(
  pluginConfig: HiaiOpenCodeConfig,
  platformDefaults: HiaiOpencodeConfig,
): HiaiOpenCodeConfig["agents"] {
  const platformAgents = Object.fromEntries(
    Object.entries(platformDefaults.agents ?? {}).map(([name, config]) => [
      name,
      {
        model: config.model,
        description: config.description,
      },
    ]),
  )

  return mergeRecords(
    platformAgents as HiaiOpenCodeConfig["agents"],
    pluginConfig.agents,
  )
}

function hydrateCategoryDefaults(
  pluginConfig: HiaiOpenCodeConfig,
  platformDefaults: HiaiOpencodeConfig,
): HiaiOpenCodeConfig["categories"] {
  const platformCategories = Object.fromEntries(
    Object.entries(platformDefaults.categories ?? {}).map(([name, config]) => [
      name,
      toRuntimeCategory(config),
    ]),
  )

  return mergeRecords(
    platformCategories as HiaiOpenCodeConfig["categories"],
    pluginConfig.categories,
  )
}

export function hydratePluginConfigWithPlatformDefaults(
  pluginConfig: HiaiOpenCodeConfig,
  platformDefaults: HiaiOpencodeConfig,
): RuntimePluginConfig {
  return {
    ...pluginConfig,
    agents: hydrateAgentDefaults(pluginConfig, platformDefaults),
    categories: hydrateCategoryDefaults(pluginConfig, platformDefaults),
    __platformDefaults: {
      ...platformDefaults,
      mcp: { ...(platformDefaults.mcp ?? {}) } as Record<string, McpServerConfig>,
    },
  }
}

export function getPlatformMcpDefaults(
  pluginConfig: HiaiOpenCodeConfig,
): Record<string, McpServerConfig> {
  return ((pluginConfig as RuntimePluginConfig).__platformDefaults?.mcp ??
    {}) as Record<string, McpServerConfig>
}

export function getPlatformLspDefaults(
  pluginConfig: HiaiOpenCodeConfig,
): Record<string, LspServerConfig> {
  return ((pluginConfig as RuntimePluginConfig).__platformDefaults?.lsp ??
    {}) as Record<string, LspServerConfig>
}
