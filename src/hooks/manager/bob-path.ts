/**
 * Cross-platform check if a path is inside .bob/ directory.
 * Handles both forward slashes (Unix) and backslashes (Windows).
 * Uses path segment matching (not substring) to avoid false positives like "not-bob/file.txt"
 */
export function isBobPath(filePath: string): boolean {
  return /\.bob[/\\]/.test(filePath)
}
