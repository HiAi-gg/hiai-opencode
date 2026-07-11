import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  LSPDiagnostic,
  LSPEdit,
  LSPLocation,
  LSPSymbol,
} from "./lsp-client";
import {
  applySingleEdit,
  applyWorkspaceEdits,
  filterDiagnosticsBySeverity,
  formatDiagnostic,
  formatLocation,
  formatSymbol,
  isUriWithinDirectory,
  severityFromFilter,
} from "./lsp-utils";

// ─── formatLocation ────────────────────────────────────────────────

describe("formatLocation", () => {
  const root = "/home/user/project";

  test("strips file:// prefix and shows rel path", () => {
    const loc: LSPLocation = {
      uri: "file:///home/user/project/src/index.ts",
      range: {
        start: { line: 4, character: 7 },
        end: { line: 4, character: 20 },
      },
    };
    expect(formatLocation(loc, root)).toBe("src/index.ts:5:7");
  });

  test("shows abs path when not under root", () => {
    const loc: LSPLocation = {
      uri: "file:///other/lib.ts",
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 1 },
      },
    };
    expect(formatLocation(loc, root)).toBe("/other/lib.ts:1:0");
  });

  test("handles non-file URIs", () => {
    const loc: LSPLocation = {
      uri: "/absolute/path.ts",
      range: {
        start: { line: 9, character: 3 },
        end: { line: 9, character: 10 },
      },
    };
    expect(formatLocation(loc, root)).toBe("/absolute/path.ts:10:3");
  });
});

// ─── formatDiagnostic ──────────────────────────────────────────────

describe("formatDiagnostic", () => {
  const root = "/p";

  test("formats severity 1 as ERROR", () => {
    const d: LSPDiagnostic = {
      range: {
        start: { line: 0, character: 5 },
        end: { line: 0, character: 10 },
      },
      severity: 1,
      message: "Type 'X' is not assignable",
    };
    const result = formatDiagnostic(d, root);
    expect(result).toContain("[ERROR]");
    expect(result).toContain("1:5");
    expect(result).toContain("Type 'X' is not assignable");
  });

  test("formats severity 2 as WARN", () => {
    const d: LSPDiagnostic = {
      range: {
        start: { line: 2, character: 0 },
        end: { line: 2, character: 1 },
      },
      severity: 2,
      message: "Unused variable",
    };
    expect(formatDiagnostic(d, root)).toContain("[WARN]");
  });

  test("formats severity 3 as INFO", () => {
    const d: LSPDiagnostic = {
      range: {
        start: { line: 5, character: 0 },
        end: { line: 5, character: 1 },
      },
      severity: 3,
      message: "info msg",
    };
    expect(formatDiagnostic(d, root)).toContain("[INFO]");
  });

  test("defaults unknown severity to HINT", () => {
    const d: LSPDiagnostic = {
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
      message: "hint msg",
    };
    expect(formatDiagnostic(d, root)).toContain("[HINT]");
  });
});

// ─── formatSymbol ──────────────────────────────────────────────────

describe("formatSymbol", () => {
  test("formats a class symbol", () => {
    const s: LSPSymbol = {
      name: "MyClass",
      kind: 5,
      range: {
        start: { line: 10, character: 0 },
        end: { line: 30, character: 1 },
      },
    };
    expect(formatSymbol(s)).toBe("[Class] MyClass (line 11)");
  });

  test("formats a function symbol", () => {
    const s: LSPSymbol = {
      name: "doStuff",
      kind: 12,
      range: {
        start: { line: 42, character: 0 },
        end: { line: 55, character: 0 },
      },
    };
    expect(formatSymbol(s)).toBe("[Function] doStuff (line 43)");
  });

  test("prefers location.range when present", () => {
    const s: LSPSymbol = {
      name: "Foo",
      kind: 5,
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
      location: {
        uri: "file:///a.ts",
        range: {
          start: { line: 99, character: 0 },
          end: { line: 99, character: 5 },
        },
      },
    };
    expect(formatSymbol(s)).toContain("(line 100)");
  });

  test("uses Unknown for unrecognised kind", () => {
    const s: LSPSymbol = {
      name: "weird",
      kind: 999,
      range: {
        start: { line: 1, character: 0 },
        end: { line: 1, character: 0 },
      },
    };
    expect(formatSymbol(s)).toBe("[Unknown] weird (line 2)");
  });
});

// ─── severityFromFilter ────────────────────────────────────────────

describe("severityFromFilter", () => {
  test("returns 1 for error", () =>
    expect(severityFromFilter("error")).toBe(1));
  test("returns 2 for warning", () =>
    expect(severityFromFilter("warning")).toBe(2));
  test("returns 2 for warn", () => expect(severityFromFilter("warn")).toBe(2));
  test("returns 3 for info", () => expect(severityFromFilter("info")).toBe(3));
  test("returns 4 for hint", () => expect(severityFromFilter("hint")).toBe(4));
  test("returns undefined for undefined", () =>
    expect(severityFromFilter(undefined)).toBeUndefined());
  test("returns undefined for unknown filter", () =>
    expect(severityFromFilter("critical")).toBeUndefined());
});

// ─── filterDiagnosticsBySeverity ───────────────────────────────────

describe("filterDiagnosticsBySeverity", () => {
  const diags: LSPDiagnostic[] = [
    {
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
      severity: 1,
      message: "err",
    },
    {
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
      severity: 2,
      message: "warn",
    },
    {
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
      severity: 3,
      message: "info",
    },
    {
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 0 },
      },
      message: "no-sev",
    },
  ];

  test("maxSeverity 1 keeps errors + no-severity (treated as error)", () => {
    const filtered = filterDiagnosticsBySeverity(diags, 1);
    expect(filtered).toHaveLength(2);
    expect(filtered.map((d) => d.message).sort()).toEqual(["err", "no-sev"]);
  });

  test("maxSeverity 2 keeps errors, warnings, and no-severity", () => {
    const filtered = filterDiagnosticsBySeverity(diags, 2);
    expect(filtered).toHaveLength(3);
  });

  test("maxSeverity 4 keeps all", () => {
    const filtered = filterDiagnosticsBySeverity(diags, 4);
    expect(filtered).toHaveLength(4);
  });
});

// ─── applySingleEdit ───────────────────────────────────────────────

describe("applySingleEdit", () => {
  test("single-line replacement", () => {
    const result = applySingleEdit("hello world", {
      range: {
        start: { line: 0, character: 6 },
        end: { line: 0, character: 11 },
      },
      newText: "there",
    });
    expect(result).toBe("hello there");
  });

  test("multi-line replacement with single-line newText (deletion)", () => {
    const text = "line1\nline2\nline3\nline4";
    const edit: LSPEdit = {
      range: {
        start: { line: 1, character: 0 },
        end: { line: 2, character: 5 },
      },
      newText: "replaced",
    };
    const result = applySingleEdit(text, edit);
    expect(result).toBe("line1\nreplaced\nline4");
  });

  test("insertion (zero-length range)", () => {
    const result = applySingleEdit("ab", {
      range: {
        start: { line: 0, character: 1 },
        end: { line: 0, character: 1 },
      },
      newText: "XX",
    });
    expect(result).toBe("aXXb");
  });

  test("full line replacement with newlines in newText", () => {
    const text = "a\nb\nc";
    const edit: LSPEdit = {
      range: {
        start: { line: 0, character: 0 },
        end: { line: 2, character: 1 },
      },
      newText: "x\ny\nz",
    };
    expect(applySingleEdit(text, edit)).toBe("x\ny\nz");
  });

  test("empty newText (deletion)", () => {
    const text = "keep\ndelete this\nkeep";
    const edit: LSPEdit = {
      range: {
        start: { line: 1, character: 0 },
        end: { line: 1, character: 11 },
      },
      newText: "",
    };
    expect(applySingleEdit(text, edit)).toBe("keep\n\nkeep");
  });
});

// ─── applyWorkspaceEdits ───────────────────────────────────────────

describe("applyWorkspaceEdits", () => {
  test("applies edits and returns summary", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "lsp-test-"));
    const fileA = join(tmpDir, "a.ts");
    const fileB = join(tmpDir, "b.ts");
    writeFileSync(fileA, "const a = 1;", "utf-8");
    writeFileSync(fileB, "const b = 2;", "utf-8");

    const fileAUri = `file://${fileA}`;
    const fileBUri = `file://${fileB}`;

    const changes: Record<string, LSPEdit[]> = {
      [fileAUri]: [
        {
          range: {
            start: { line: 0, character: 6 },
            end: { line: 0, character: 7 },
          },
          newText: "x",
        },
      ],
      [fileBUri]: [
        {
          range: {
            start: { line: 0, character: 6 },
            end: { line: 0, character: 7 },
          },
          newText: "y",
        },
      ],
    };

    const result = applyWorkspaceEdits(changes, tmpDir);
    expect(result).toHaveLength(2);
    expect(result[0].edits).toBe(1);
    expect(readFileSync(fileA, "utf-8")).toBe("const x = 1;");
    expect(readFileSync(fileB, "utf-8")).toBe("const y = 2;");

    // Cleanup
    const { rmSync } = require("node:fs");
    rmSync(tmpDir, { recursive: true, force: true });
  });

  test("throws on path outside project directory", () => {
    const changes: Record<string, LSPEdit[]> = {
      "file:///etc/passwd": [
        {
          range: {
            start: { line: 0, character: 0 },
            end: { line: 0, character: 1 },
          },
          newText: "x",
        },
      ],
    };
    expect(() => applyWorkspaceEdits(changes, "/safe/project")).toThrow(
      "Sandbox blocked",
    );
  });

  test("handles empty changes gracefully", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "lsp-test-empty-"));
    const result = applyWorkspaceEdits({}, tmpDir);
    expect(result).toEqual([]);
    const { rmSync } = require("node:fs");
    rmSync(tmpDir, { recursive: true, force: true });
  });
});

// ─── Sandbox filtering ─────────────────────────────────────────────
//
// LSP results (workspace symbols, definitions, references, rename changes)
// must be filtered to the project directory so that locations inside
// e.g. node_modules are excluded.

describe("isUriWithinDirectory (sandbox filter)", () => {
  const root = "/home/user/project";

  test("matches a file:// uri inside the project", () => {
    expect(
      isUriWithinDirectory("file:///home/user/project/src/index.ts", root),
    ).toBe(true);
  });

  test("matches a bare path inside the project", () => {
    expect(isUriWithinDirectory("/home/user/project/a/b.ts", root)).toBe(true);
  });

  test("rejects a node_modules uri outside the project", () => {
    expect(
      isUriWithinDirectory(
        "file:///home/user/other/node_modules/left-pad/index.js",
        root,
      ),
    ).toBe(false);
  });

  test("rejects an unrelated absolute path", () => {
    expect(isUriWithinDirectory("file:///etc/passwd", root)).toBe(false);
  });
});

describe("workspace symbol sandbox filtering", () => {
  const root = "/home/user/project";

  const filterSymbols = (symbols: LSPSymbol[]) =>
    symbols.filter((s) => {
      const loc = s.location?.uri;
      if (!loc) return false;
      return isUriWithinDirectory(loc, root);
    });

  const makeSymbol = (name: string, uri: string): LSPSymbol => ({
    name,
    kind: 12,
    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
    location: {
      uri,
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 1 },
      },
    },
  });

  test("filters out a workspace symbol from node_modules outside the project", () => {
    const symbols = [
      makeSymbol("internalHelper", "file:///home/user/project/src/helper.ts"),
      makeSymbol(
        "leftPad",
        "file:///home/user/other/node_modules/left-pad/index.js",
      ),
    ];
    const filtered = filterSymbols(symbols);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe("internalHelper");
  });

  test("keeps a workspace symbol from within the project", () => {
    const symbols = [
      makeSymbol("internalHelper", "file:///home/user/project/src/helper.ts"),
      makeSymbol("App", "file:///home/user/project/src/app.ts"),
    ];
    const filtered = filterSymbols(symbols);
    expect(filtered).toHaveLength(2);
  });

  test("drops symbols without a location", () => {
    const symbols: LSPSymbol[] = [
      {
        name: "noLoc",
        kind: 12,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 1 },
        },
      },
    ];
    expect(filterSymbols(symbols)).toHaveLength(0);
  });
});
