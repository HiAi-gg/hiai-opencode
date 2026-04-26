import { existsSync } from "fs"

import { CLI_LANGUAGES } from "./language-support"
import { getSgCliPath } from "./sg-cli-path"

export interface EnvironmentCheckResult {
	cli: {
		available: boolean
		path: string
		error?: string
	}
}

/**
 * Check if ast-grep CLI is available.
 * Call this at startup to provide early feedback about missing dependencies.
 */
export function checkEnvironment(): EnvironmentCheckResult {
	const cliPath = getSgCliPath()
	const result: EnvironmentCheckResult = {
		cli: {
			available: false,
			path: cliPath ?? "not found",
		},
	}

	if (cliPath && existsSync(cliPath)) {
		result.cli.available = true
	} else if (!cliPath) {
		result.cli.error = "ast-grep binary not found. Install with: bun add -D @ast-grep/cli"
	} else {
		result.cli.error = `Binary not found: ${cliPath}`
	}

	return result
}

/**
 * Format environment check result as user-friendly message.
 */
export function formatEnvironmentCheck(result: EnvironmentCheckResult): string {
	const lines: string[] = ["ast-grep Environment Status:", ""]

	// CLI status
	if (result.cli.available) {
		lines.push(`[OK] CLI: Available (${result.cli.path})`)
	} else {
		lines.push("[X] CLI: Not available")
		if (result.cli.error) {
			lines.push(`  Error: ${result.cli.error}`)
		}
		lines.push("  Install: bun add -D @ast-grep/cli")
	}

	lines.push("")
	lines.push(`CLI supports ${CLI_LANGUAGES.length} languages`)

	return lines.join("\n")
}
