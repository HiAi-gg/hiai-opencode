import { existsSync, readdirSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { tool } from "@opencode-ai/plugin";
import { LSPManager } from "./lsp-manager";
import {
  applyWorkspaceEdits,
  filterDiagnosticsBySeverity,
  formatDiagnostic,
  formatLocation,
  formatSymbol,
  severityFromFilter,
} from "./lsp-utils";
import { findServerForExtension } from "./server-definitions";

const manager = new LSPManager();

async function getClientForFile(filePath: string, directory: string) {
  const resolved = filePath.startsWith("/")
    ? filePath
    : join(directory, filePath);
  const ext = extname(resolved);
  const match = findServerForExtension(ext);
  if (!match) return { client: null, resolved, serverId: null };
  const client = await manager.getClient(directory, match.id);
  return { client, resolved, serverId: match.id };
}

function sandboxCheck(filePath: string, projectDir: string): string {
  const resolved = resolve(filePath);
  if (!resolved.startsWith(resolve(projectDir))) {
    throw new Error(
      `Access denied: ${filePath} is outside the project directory`,
    );
  }
  return resolved;
}

export const lspDiagnosticsTool = tool({
  description:
    "Get language diagnostics (errors/warnings) for a file or directory using LSP. Supports TypeScript, Svelte, Python, and more.",
  args: {
    filePath: tool.schema
      .string()
      .optional()
      .describe("Path to the file to check (omit when scanning a directory)"),
    directory: tool.schema
      .string()
      .optional()
      .describe("Scan all files in this directory instead of a single file"),
    severityFilter: tool.schema
      .string()
      .optional()
      .describe(
        'Minimum severity to show: "error", "warning"/"warn", "info", "hint" (default: all)',
      ),
  },
  async execute(input, ctx) {
    const maxSev = severityFromFilter(input.severityFilter);

    // Directory scan mode
    if (input.directory && !input.filePath) {
      const dir = input.directory.startsWith("/")
        ? input.directory
        : join(ctx.directory, input.directory);
      sandboxCheck(dir, ctx.directory);

      if (!existsSync(dir) || !statSync(dir).isDirectory()) {
        return {
          title: "Invalid directory",
          output: `Directory not found: ${dir}`,
        };
      }

      const results: string[] = [];
      const seenServers = new Set<string>();

      try {
        const entries = readdirSync(dir);
        for (const entry of entries) {
          const fullPath = join(dir, entry);
          try {
            if (!statSync(fullPath).isFile()) continue;
          } catch {
            continue;
          }

          const { client, resolved, serverId } = await getClientForFile(
            fullPath,
            ctx.directory,
          );
          if (!client || !serverId) continue;
          seenServers.add(serverId);

          try {
            const diagnostics = await client.diagnostics(resolved);
            const filtered = maxSev
              ? filterDiagnosticsBySeverity(diagnostics, maxSev)
              : diagnostics;
            if (filtered.length === 0) continue;

            const rel = fullPath.startsWith(ctx.directory)
              ? fullPath.slice(ctx.directory.length + 1)
              : fullPath;
            results.push(`--- ${rel} (${filtered.length}) ---`);
            results.push(
              ...filtered.map((d) => formatDiagnostic(d, ctx.directory)),
            );
          } catch {
            // skip file-level errors
          } finally {
            if (serverId) await manager.releaseClient(ctx.directory, serverId);
          }
        }
      } catch (err) {
        return {
          title: "Directory scan failed",
          output: `Error: ${err instanceof Error ? err.message : String(err)}`,
        };
      }

      if (results.length === 0) {
        return {
          title: "No diagnostics",
          output: `No diagnostics found in ${results.length} file(s) across ${seenServers.size} server(s).`,
        };
      }
      return {
        title: `Directory scan (${results.length} files)`,
        output: results.join("\n"),
      };
    }

    // Single-file mode (original behaviour)
    const filePath = input.filePath;
    if (!filePath) {
      return {
        title: "Missing parameter",
        output: "Provide either filePath (single file) or directory (scan)",
      };
    }

    const resolvedPath = filePath.startsWith("/")
      ? filePath
      : join(ctx.directory, filePath);
    sandboxCheck(resolvedPath, ctx.directory);

    if (!existsSync(resolvedPath)) {
      return {
        title: "File not found",
        output: `File not found: ${resolvedPath}`,
      };
    }

    try {
      const { client, resolved, serverId } = await getClientForFile(
        resolvedPath,
        ctx.directory,
      );
      try {
        if (!client) {
          return {
            title: "Unsupported file type",
            output: `No LSP server available for: ${extname(resolved)} files`,
          };
        }

        const diagnostics = await client.diagnostics(resolved);
        const filtered = maxSev
          ? filterDiagnosticsBySeverity(diagnostics, maxSev)
          : diagnostics;

        if (filtered.length === 0) {
          return {
            title: "No diagnostics",
            output: "No errors or warnings found.",
          };
        }

        const output = filtered
          .map((d) => formatDiagnostic(d, ctx.directory))
          .join("\n");

        return { title: `${filtered.length} diagnostic(s)`, output };
      } finally {
        if (serverId) {
          await manager.releaseClient(ctx.directory, serverId);
        }
      }
    } catch (err) {
      return {
        title: "Diagnostics failed",
        output: `Error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
});

export const lspGotoDefinitionTool = tool({
  description:
    "Go to the definition of a symbol at a given position using LSP.",
  args: {
    filePath: tool.schema.string().describe("Path to the file"),
    line: tool.schema.number().describe("Line number (1-based)"),
    character: tool.schema.number().describe("Column number (0-based)"),
  },
  async execute(input, ctx) {
    const filePath = input.filePath.startsWith("/")
      ? input.filePath
      : join(ctx.directory, input.filePath);
    sandboxCheck(filePath, ctx.directory);

    if (!existsSync(filePath)) {
      return { title: "File not found", output: `File not found: ${filePath}` };
    }

    try {
      const { client, resolved, serverId } = await getClientForFile(
        filePath,
        ctx.directory,
      );
      try {
        if (!client) {
          return {
            title: "Unsupported",
            output: `No LSP server available for: ${extname(resolved)} files`,
          };
        }

        const result = await client.definition(
          resolved,
          input.line,
          input.character,
        );

        if (!result) {
          return {
            title: "No definition",
            output: "No definition found at this position.",
          };
        }

        const locations = Array.isArray(result) ? result : [result];
        if (locations.length === 0) {
          return {
            title: "No definition",
            output: "No definition found at this position.",
          };
        }

        const output = locations
          .map((loc) => formatLocation(loc, ctx.directory))
          .join("\n");
        return { title: `${locations.length} definition(s)`, output };
      } finally {
        if (serverId) {
          await manager.releaseClient(ctx.directory, serverId);
        }
      }
    } catch (err) {
      return {
        title: "Definition lookup failed",
        output: `Error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
});

export const lspFindReferencesTool = tool({
  description: "Find all references to a symbol at a given position using LSP.",
  args: {
    filePath: tool.schema.string().describe("Path to the file"),
    line: tool.schema.number().describe("Line number (1-based)"),
    character: tool.schema.number().describe("Column number (0-based)"),
  },
  async execute(input, ctx) {
    const filePath = input.filePath.startsWith("/")
      ? input.filePath
      : join(ctx.directory, input.filePath);
    sandboxCheck(filePath, ctx.directory);

    if (!existsSync(filePath)) {
      return { title: "File not found", output: `File not found: ${filePath}` };
    }

    try {
      const { client, resolved, serverId } = await getClientForFile(
        filePath,
        ctx.directory,
      );
      try {
        if (!client) {
          return {
            title: "Unsupported",
            output: `No LSP server available for: ${extname(resolved)} files`,
          };
        }

        const refs = await client.references(
          resolved,
          input.line,
          input.character,
        );

        if (refs.length === 0) {
          return { title: "No references", output: "No references found." };
        }

        const output = refs
          .map((loc) => formatLocation(loc, ctx.directory))
          .join("\n");
        return { title: `${refs.length} reference(s)`, output };
      } finally {
        if (serverId) {
          await manager.releaseClient(ctx.directory, serverId);
        }
      }
    } catch (err) {
      return {
        title: "Reference lookup failed",
        output: `Error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
});

export const lspSymbolsTool = tool({
  description:
    "List symbols in a file or search workspace symbols. Supports document-level and workspace-level queries.",
  args: {
    filePath: tool.schema
      .string()
      .optional()
      .describe("Path to the file (required for scope=document)"),
    query: tool.schema
      .string()
      .optional()
      .describe(
        "Search query for workspace symbols (used with scope=workspace)",
      ),
    scope: tool.schema
      .string()
      .optional()
      .default("document")
      .describe(
        'Scope: "document" for symbols in a single file, "workspace" for project-wide symbol search',
      ),
    serverId: tool.schema
      .string()
      .optional()
      .describe(
        'LSP server to use for workspace query (default: "typescript"). See server-definitions.ts for available servers.',
      ),
  },
  async execute(input, ctx) {
    const scope = input.scope ?? "document";

    // ── Workspace symbols ──
    if (scope === "workspace") {
      if (!input.query) {
        return {
          title: "Missing query",
          output: "A query string is required for workspace symbol search.",
        };
      }
      const serverId = input.serverId ?? "typescript";
      try {
        const client = await manager.getClient(ctx.directory, serverId);
        try {
          const symbols = await client.workspaceSymbols(input.query);
          if (symbols.length === 0) {
            return {
              title: "No symbols found",
              output: `No workspace symbols matching "${input.query}" found via ${serverId}.`,
            };
          }
          const output = symbols.map((s) => formatSymbol(s)).join("\n");
          return {
            title: `${symbols.length} workspace symbol(s) for "${input.query}"`,
            output,
          };
        } finally {
          await manager.releaseClient(ctx.directory, serverId);
        }
      } catch (err) {
        return {
          title: "Workspace symbol search failed",
          output: `Error: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    // ── Document symbols (original behaviour) ──
    if (!input.filePath) {
      return {
        title: "Missing filePath",
        output: "filePath is required for document-scope symbol listing.",
      };
    }

    const filePath = input.filePath.startsWith("/")
      ? input.filePath
      : join(ctx.directory, input.filePath);
    sandboxCheck(filePath, ctx.directory);

    if (!existsSync(filePath)) {
      return { title: "File not found", output: `File not found: ${filePath}` };
    }

    try {
      const { client, resolved, serverId } = await getClientForFile(
        filePath,
        ctx.directory,
      );
      try {
        if (!client) {
          return {
            title: "Unsupported",
            output: `No LSP server available for: ${extname(resolved)} files`,
          };
        }

        const symbols = await client.symbols(resolved);

        if (symbols.length === 0) {
          return {
            title: "No symbols",
            output: "No symbols found in this file.",
          };
        }

        const output = symbols.map((s) => formatSymbol(s)).join("\n");
        return { title: `${symbols.length} symbol(s)`, output };
      } finally {
        if (serverId) {
          await manager.releaseClient(ctx.directory, serverId);
        }
      }
    } catch (err) {
      return {
        title: "Symbol lookup failed",
        output: `Error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
});

export const lspPrepareRenameTool = tool({
  description:
    "Prepare a rename operation — checks if the symbol at the position can be renamed.",
  args: {
    filePath: tool.schema.string().describe("Path to the file"),
    line: tool.schema.number().describe("Line number (1-based)"),
    character: tool.schema.number().describe("Column number (0-based)"),
  },
  async execute(input, ctx) {
    const filePath = input.filePath.startsWith("/")
      ? input.filePath
      : join(ctx.directory, input.filePath);
    sandboxCheck(filePath, ctx.directory);

    if (!existsSync(filePath)) {
      return { title: "File not found", output: `File not found: ${filePath}` };
    }

    try {
      const { client, resolved, serverId } = await getClientForFile(
        filePath,
        ctx.directory,
      );
      try {
        if (!client) {
          return {
            title: "Unsupported",
            output: `No LSP server available for: ${extname(resolved)} files`,
          };
        }

        const result = await client.prepareRename(
          resolved,
          input.line,
          input.character,
        );

        if (!result) {
          return {
            title: "Cannot rename",
            output: "Symbol at this position cannot be renamed.",
          };
        }

        return {
          title: "Rename ready",
          output: `Can rename. Placeholder: "${result.placeholder}"\nRange: ${result.range.start.line + 1}:${result.range.start.character} — ${result.range.end.line + 1}:${result.range.end.character}`,
        };
      } finally {
        if (serverId) {
          await manager.releaseClient(ctx.directory, serverId);
        }
      }
    } catch (err) {
      return {
        title: "Prepare rename failed",
        output: `Error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
});

export const lspRenameTool = tool({
  description:
    "Rename a symbol across all files that reference it using LSP. Optionally apply changes to disk.",
  args: {
    filePath: tool.schema.string().describe("Path to the file"),
    line: tool.schema.number().describe("Line number (1-based)"),
    character: tool.schema.number().describe("Column number (0-based)"),
    newName: tool.schema.string().describe("New name for the symbol"),
    apply: tool.schema
      .boolean()
      .optional()
      .default(false)
      .describe(
        "When true, apply the rename edits to disk (default: preview only)",
      ),
  },
  async execute(input, ctx) {
    const filePath = input.filePath.startsWith("/")
      ? input.filePath
      : join(ctx.directory, input.filePath);
    sandboxCheck(filePath, ctx.directory);

    if (!existsSync(filePath)) {
      return { title: "File not found", output: `File not found: ${filePath}` };
    }

    try {
      const { client, resolved, serverId } = await getClientForFile(
        filePath,
        ctx.directory,
      );
      try {
        if (!client) {
          return {
            title: "Unsupported",
            output: `No LSP server available for: ${extname(resolved)} files`,
          };
        }

        const changes = await client.rename(
          resolved,
          input.line,
          input.character,
          input.newName,
        );

        if (!changes) {
          return {
            title: "Rename failed",
            output: "Could not rename symbol. Server returned no changes.",
          };
        }

        const totalEdits = Object.values(changes).reduce(
          (sum, e) => sum + e.length,
          0,
        );
        const files = Object.keys(changes);

        // Apply to disk when requested
        if (input.apply) {
          try {
            const applied = applyWorkspaceEdits(changes, ctx.directory);
            const fileList = applied
              .sort((a, b) => a.file.localeCompare(b.file))
              .map((a) => `  ${a.file} (${a.edits} edit(s))`)
              .join("\n");
            return {
              title: `Applied rename to "${input.newName}"`,
              output: [
                `Applied ${totalEdits} edit(s) across ${files.length} file(s):`,
                "",
                fileList,
              ].join("\n"),
            };
          } catch (applyErr) {
            return {
              title: "Apply rename failed",
              output: `Preview succeeded but applying edits failed:\n${
                applyErr instanceof Error ? applyErr.message : String(applyErr)
              }`,
            };
          }
        }

        // Preview only (default)
        const output = [
          `Renaming "${input.newName}" would affect ${totalEdits} edit(s) across ${files.length} file(s):`,
          "",
          ...files.map((f) => {
            const rel = f.startsWith("file://") ? f.slice(7) : f;
            const short = rel.startsWith(ctx.directory)
              ? rel.slice(ctx.directory.length + 1)
              : rel;
            const edits = changes[f];
            return `  ${short}:\n${edits.map((e) => `    L${e.range.start.line + 1}: ${e.newText}`).join("\n")}`;
          }),
        ].join("\n");

        return { title: `Preview rename to "${input.newName}"`, output };
      } finally {
        if (serverId) {
          await manager.releaseClient(ctx.directory, serverId);
        }
      }
    } catch (err) {
      return {
        title: "Rename failed",
        output: `Error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
});

export async function disposeLSP() {
  await manager.disposeAll();
}
