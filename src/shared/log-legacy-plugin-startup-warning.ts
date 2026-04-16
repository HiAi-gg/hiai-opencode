import { checkForLegacyPluginEntry } from "./legacy-plugin-warning"
import { log } from "./logger"
import { migrateLegacyPluginEntry } from "./migrate-legacy-plugin-entry"
import { toCanonicalEntry } from "./plugin-entry-migrator"
import { LEGACY_PLUGIN_NAME, PLUGIN_NAME } from "./plugin-identity"

type LogLegacyPluginStartupWarningDeps = {
  checkForLegacyPluginEntry?: typeof checkForLegacyPluginEntry
  log?: typeof log
  migrateLegacyPluginEntry?: typeof migrateLegacyPluginEntry
}

export function logLegacyPluginStartupWarning(deps: LogLegacyPluginStartupWarningDeps = {}): void {
  const checkForLegacyPluginEntryFn = deps.checkForLegacyPluginEntry ?? checkForLegacyPluginEntry
  const logFn = deps.log ?? log
  const migrateLegacyPluginEntryFn = deps.migrateLegacyPluginEntry ?? migrateLegacyPluginEntry

  const result = checkForLegacyPluginEntryFn()
  if (!result.hasLegacyEntry) {
    return
  }

  const suggestedEntries = result.legacyEntries.map(toCanonicalEntry)

  logFn("[HiaiOpenCodePlugin] Legacy plugin entry detected in OpenCode config", {
    legacyEntries: result.legacyEntries,
    suggestedEntries,
    hasCanonicalEntry: result.hasCanonicalEntry,
  })

  console.warn(
    `[hiai-opencode] WARNING: Your opencode.json uses the legacy package name "${LEGACY_PLUGIN_NAME}".`
    + ` The package has been renamed to "${PLUGIN_NAME}".`
    + ` Attempting auto-migration...`,
  )

  const migrated = migrateLegacyPluginEntryFn(result.configPath!)
  if (migrated) {
    console.warn(`[hiai-opencode] Auto-migrated opencode.json: ${result.legacyEntries.join(", ")} -> ${suggestedEntries.join(", ")}`)
  } else {
    console.warn(
      `[hiai-opencode] Could not auto-migrate. Please manually update your opencode.json:`
      + ` ${result.legacyEntries.map((e, i) => `"${e}" -> "${suggestedEntries[i]}"`).join(", ")}`,
    )
  }
}
