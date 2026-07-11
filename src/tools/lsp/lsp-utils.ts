import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join as pathJoin, resolve } from "node:path";
import type {
  LSPDiagnostic,
  LSPEdit,
  LSPLocation,
  LSPSymbol,
} from "./lsp-client";

/** Format an LSP location as `file:line:col` (relative to root). */
export function formatLocation(loc: LSPLocation, root: string): string {
  const uri = loc.uri.startsWith("file://") ? loc.uri.slice(7) : loc.uri;
  const rel = uri.startsWith(root) ? uri.slice(root.length + 1) : uri;
  return `${rel}:${loc.range.start.line + 1}:${loc.range.start.character}`;
}

/** Format a single diagnostic as `[SEV] line:col — message`. */
export function formatDiagnostic(d: LSPDiagnostic, _root: string): string {
  const sev =
    d.severity === 1
      ? "ERROR"
      : d.severity === 2
        ? "WARN"
        : d.severity === 3
          ? "INFO"
          : "HINT";
  const pos = `${d.range.start.line + 1}:${d.range.start.character}`;
  return `[${sev}] ${pos} — ${d.message}`;
}

const SYMBOL_KINDS = [
  "",
  "File",
  "Module",
  "Namespace",
  "Package",
  "Class",
  "Method",
  "Property",
  "Field",
  "Constructor",
  "Enum",
  "Interface",
  "Function",
  "Variable",
  "Constant",
  "String",
  "Number",
  "Boolean",
  "Array",
  "Object",
  "Key",
  "Null",
  "EnumMember",
  "Struct",
  "Event",
  "Operator",
  "TypeParameter",
];

/** Format a symbol as `[Kind] name (line N)`. */
export function formatSymbol(s: LSPSymbol): string {
  const kind = SYMBOL_KINDS[s.kind] ?? "Unknown";
  const line = (s.location?.range ?? s.range).start.line + 1;
  return `[${kind}] ${s.name} (line ${line})`;
}

/**
 * Convert a severity filter string to an LSP severity number threshold.
 * Returns `undefined` when no filtering is needed.
 *
 * Severity levels (LSP): 1=Error, 2=Warning, 3=Info, 4=Hint.
 * A filter of "error" keeps only severity <= 1.
 * A filter of "warning" keeps only severity <= 2.
 */
export function severityFromFilter(filter?: string): number | undefined {
  if (!filter) return undefined;
  const f = filter.toLowerCase();
  if (f === "error") return 1;
  if (f === "warning" || f === "warn") return 2;
  if (f === "info") return 3;
  if (f === "hint") return 4;
  return undefined;
}

/** Filter diagnostics by a max-severity threshold (1=Error, 2=Warning …). */
export function filterDiagnosticsBySeverity(
  diagnostics: LSPDiagnostic[],
  maxSeverity: number,
): LSPDiagnostic[] {
  return diagnostics.filter((d) => (d.severity ?? 1) <= maxSeverity);
}

/**
 * Apply LSP workspace edits to disk files.
 * All target paths are sandbox-checked against `projectDir`.
 * Returns summary entries `{ file, edits }`.
 */
export function applyWorkspaceEdits(
  changes: Record<string, LSPEdit[]>,
  projectDir: string,
): { file: string; edits: number }[] {
  const resolvedProject = resolve(projectDir);
  const results: { file: string; edits: number }[] = [];

  for (const [uri, edits] of Object.entries(changes)) {
    const rawPath = uri.startsWith("file://") ? uri.slice(7) : uri;
    const filePath = resolve(rawPath);

    // Sandbox: reject paths outside the project directory
    if (!filePath.startsWith(resolvedProject)) {
      throw new Error(
        `Sandbox blocked: edit target "${rawPath}" is outside the project directory`,
      );
    }

    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const original = readFileSync(filePath, "utf-8");
    const modified = applyTextEdits(original, edits);
    writeFileSync(filePath, modified, "utf-8");

    const rel = rawPath.startsWith(projectDir)
      ? rawPath.slice(projectDir.length + 1)
      : rawPath;
    results.push({ file: rel, edits: edits.length });
  }

  return results;
}

/** Apply a list of LSP TextEdits to a string (sorted bottom-up for correctness). */
function applyTextEdits(text: string, edits: LSPEdit[]): string {
  // Apply in reverse order (bottom-to-top, right-to-left) to preserve positions
  const sorted = [...edits].sort((a, b) => {
    const lineDiff = b.range.start.line - a.range.start.line;
    if (lineDiff !== 0) return lineDiff;
    return b.range.start.character - a.range.start.character;
  });

  let result = text;
  for (const edit of sorted) {
    result = applySingleEdit(result, edit);
  }
  return result;
}

/**
 * Check whether a file URI/path is inside a project directory (sandbox filter).
 * Handles both `file://` prefixed and bare paths.
 */
export function isUriWithinDirectory(uri: string, directory: string): boolean {
  const rawPath = uri.startsWith("file://") ? uri.slice(7) : uri;
  const resolved = resolve(rawPath);
  return resolved.startsWith(resolve(directory));
}

/** Apply one LSP TextEdit to a string. */
export function applySingleEdit(text: string, edit: LSPEdit): string {
  const lines = text.split("\n");
  const { start, end } = edit.range;

  // Edits are 0-indexed for lines/character
  const startLine = start.line;
  const startChar = start.character;
  const endLine = end.line;
  const endChar = end.character;

  const newParts = edit.newText.split("\n");
  const result: string[] = [];

  // Lines before the edit region
  for (let i = 0; i < startLine; i++) {
    result.push(lines[i]);
  }

  // Start line: prefix before edit + first part of new text
  const startPrefix = lines[startLine]?.slice(0, startChar) ?? "";
  result.push(startPrefix + newParts[0]);

  // Middle lines of new text (if multi-line)
  for (let i = 1; i < newParts.length; i++) {
    result.push(newParts[i]);
  }

  // Last line: if newText was multi-line, appendsuffix to the last new part
  // If single-line, append to the already-written line
  const endSuffix = lines[endLine]?.slice(endChar) ?? "";
  if (newParts.length > 1) {
    result[result.length - 1] += endSuffix;
  } else {
    result[result.length - 1] += endSuffix;
  }

  // Lines after the edit region
  for (let i = endLine + 1; i < lines.length; i++) {
    result.push(lines[i]);
  }

  return result.join("\n");
}

/** Collect file paths in a directory matching given extensions (non-recursive). */
export function globFiles(dir: string, extensions: string[]): string[] {
  const files: string[] = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const full = pathJoin(dir, entry);
      try {
        if (statSync(full).isFile()) {
          const idx = full.lastIndexOf(".");
          const ext = idx >= 0 ? full.slice(idx) : "";
          if (extensions.length === 0 || extensions.includes(ext)) {
            files.push(full);
          }
        }
      } catch {
        // skip unreadable entries
      }
    }
  } catch {
    // skip unreadable directories
  }
  return files;
}

/**
 * Collect diagnostics for all matching files in a directory tree.
 * Returns a flat list with source file info.
 */
export function collectDirectoryDiagnostics(
  client: { diagnostics(filePath: string): Promise<LSPDiagnostic[]> },
  dir: string,
  extensions: string[],
): Promise<{ file: string; diagnostics: LSPDiagnostic[] }[]> {
  const files = globFiles(dir, extensions);
  return Promise.all(
    files.map(async (filePath) => {
      try {
        const diags = await client.diagnostics(filePath);
        return { file: filePath, diagnostics: diags };
      } catch {
        return { file: filePath, diagnostics: [] };
      }
    }),
  );
}
