// Summary formatter for the completion-controller.
//
// Converts a CLOSURE block + endpoint scan + remaining-todo list into a
// human-readable markdown block that the TUI renders as a stylized card.
// Pure functions only — no I/O — so callers can unit-test the shape without
// touching the sync bucket.

import type { Endpoint } from "./port-scanner";

export type Readiness = "done" | "accept" | "reject";

export interface ClosureData {
  reasoning: string;
  evidence: string[];
  readiness: Readiness;
}

export interface SummaryInput {
  closure: ClosureData | null;
  endpoints: Endpoint[];
  /** Open / in-progress / blocked TODOs the user may still care about. */
  remaining: string[];
  /** Where this came from, surfaced as a small caption under the title. */
  sessionLabel?: string;
}

const MAX_EVIDENCE = 6;
const MAX_REMAINING = 8;
const MAX_ENDPOINTS = 6;

/**
 * Parse a `<CLOSURE>{...}</CLOSURE>` block. Mirrors the parser in
 * `signals.ts` but extracts the full payload — `parseCriticVerdict` only
 * needs the readiness scalar.
 */
export function parseClosureBlock(text: string): ClosureData | null {
  const m = text.match(/<CLOSURE>([\s\S]*?)<\/CLOSURE>/i);
  if (!m) return null;
  const raw = m[1];
  const json = extractJson(raw);
  if (!json) return null;
  return normalizeClosure(json);
}

function extractJson(body: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(body);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function normalizeClosure(raw: Record<string, unknown>): ClosureData | null {
  const reasoning =
    typeof raw.reasoning === "string" ? raw.reasoning.trim() : "";
  const readinessRaw =
    typeof raw.readiness === "string" ? raw.readiness.toLowerCase() : "";
  if (
    readinessRaw !== "done" &&
    readinessRaw !== "accept" &&
    readinessRaw !== "reject"
  )
    return null;
  const evidence = Array.isArray(raw.evidence)
    ? raw.evidence
        .filter((e): e is string => typeof e === "string")
        .map((e) => e.trim())
        .filter(Boolean)
    : [];
  return { reasoning, evidence, readiness: readinessRaw };
}

/**
 * Format the summary block as a single markdown string. Sections are emitted
 * in priority order; empty sections are omitted so the block stays terse.
 */
export function buildSummary(input: SummaryInput): string {
  const lines: string[] = [];

  const status = input.closure
    ? readinessLabel(input.closure.readiness)
    : readinessLabel("done");
  const title =
    input.closure?.readiness === "reject"
      ? "Bob Summary — rejected"
      : "Bob Summary";
  lines.push(`## ${title}`);
  if (input.sessionLabel) lines.push(`*${input.sessionLabel}*`);
  lines.push("");
  lines.push(`**Status:** ${status}`);
  lines.push("");

  const reasoning = input.closure?.reasoning;
  if (reasoning) {
    lines.push("### Reasoning");
    lines.push(reasoning);
    lines.push("");
  }

  const evidence = input.closure?.evidence.slice(0, MAX_EVIDENCE) ?? [];
  if (evidence.length > 0) {
    lines.push("### Evidence");
    for (const e of evidence) lines.push(`- ${e}`);
    lines.push("");
  }

  if (input.endpoints.length > 0) {
    lines.push("### Open endpoints");
    lines.push("| URL | Port | Source |");
    lines.push("| --- | ---: | --- |");
    for (const ep of input.endpoints.slice(0, MAX_ENDPOINTS)) {
      lines.push(`| \`${ep.url}\` | ${ep.port ?? "—"} | ${ep.source} |`);
    }
    lines.push("");
  }

  const remaining = input.remaining.slice(0, MAX_REMAINING);
  if (remaining.length > 0) {
    lines.push("### Remaining items");
    for (const r of remaining) lines.push(`- ${r}`);
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function readinessLabel(r: Readiness): string {
  if (r === "done") return "completed";
  if (r === "accept") return "accepted";
  return "rejected";
}
