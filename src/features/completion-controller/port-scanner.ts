// Port/IP detection for the completion-controller summary builder.
//
// Scans recent bash/read tool outputs for port bindings and endpoint hints
// surfaced during Bob's run. Used by the summary injection so the user can
// quickly see "what's now running" instead of digging through transcript
// noise. Pure functions — no I/O, no async.
//
// NOTE: port-scanner is post-hoc — it detects ports already in use from
// transcript logs. For proactive port allocation guidance, see docs/PORT-GUIDANCE.md.

const PORT_PATTERN =
  /(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::\]|\[::1\]):(\d{2,5})|(?:https?:\/\/)(?:localhost|127\.0\.0\.1|\d{1,3}(?:\.\d{1,3}){3}|[\w.-]+)(?::(\d{2,5}))?/gi;

const BIND_PATTERNS = [
  // Common server-bind log lines: "listening on 0.0.0.0:3000", "Server running at http://..."
  /(?:listening|bound|server|serve|started|running|ready)\s+(?:on|at)\s+([^\s,]+)/gi,
  // EXPOSE <port> in Dockerfiles or compose output
  /\bEXPOSE\s+(\d{2,5})\b/gi,
  // "-p 8080", "--port 8080", "PORT=8080"
  /(?:^|\s)(?:-p|--port|--listen)(?:\s*[=]?\s*)(\d{2,5})\b/gi,
  /\bPORT\s*=\s*(\d{2,5})\b/gi,
];

const SOURCE_LIMIT = 32 * 1024;

export interface Endpoint {
  /** URL when a scheme + host were detected; otherwise bare `host:port`. */
  url: string;
  /** Numeric port when known. */
  port: number | null;
  /** Source tool name (bash/read/...) that produced the hit, for context. */
  source: string;
}

/**
 * Scan a single tool output blob for endpoints. Output is trimmed to the
 * first `SOURCE_LIMIT` chars so a runaway server log can't blow up the
 * pattern matcher. The caller is responsible for selecting which outputs to
 * feed in (e.g. the most recent N bash/read results for the session).
 */
export function scanOutputForEndpoints(text: string, source: string): Endpoint[] {
  if (!text) return [];
  const slice = text.length > SOURCE_LIMIT ? text.slice(0, SOURCE_LIMIT) : text;
  const hits = new Map<string, Endpoint>();

  const add = (rawUrl: string, port: number | null) => {
    const url = rawUrl.replace(/[.,;)\]]+$/, '');
    if (!url) return;
    const key = `${url}|${port ?? ''}`;
    if (hits.has(key)) return;
    hits.set(key, { url, port, source });
  };

  for (const match of slice.matchAll(PORT_PATTERN)) {
    const port = match[1] ?? match[2];
    if (!port) continue;
    if (!isPlausiblePort(port)) continue;
    add(match[0], Number(port));
  }

  for (const pattern of BIND_PATTERNS) {
    for (const match of slice.matchAll(pattern)) {
      const candidate = match[1];
      if (!candidate) continue;
      if (/^\d+$/.test(candidate)) {
        if (!isPlausiblePort(candidate)) continue;
        add(`localhost:${candidate}`, Number(candidate));
      } else if (candidate.includes(':')) {
        add(candidate, extractPort(candidate));
      } else {
        add(candidate, null);
      }
    }
  }

  return [...hits.values()];
}

/**
 * Aggregate endpoints from a session's recent tool outputs. The caller hands
 * us whatever they've already collected (the hook has access to the messages
 * bucket); we just dedupe and rank.
 */
export function aggregateEndpoints(entries: Array<{ tool: string; output: string }>): Endpoint[] {
  const seen = new Map<string, Endpoint>();
  for (const e of entries) {
    for (const ep of scanOutputForEndpoints(e.output, e.tool)) {
      const key = `${ep.url}|${ep.port ?? ''}`;
      if (seen.has(key)) continue;
      seen.set(key, ep);
    }
  }
  return [...seen.values()];
}

function isPlausiblePort(raw: string): boolean {
  const n = Number(raw);
  if (!Number.isFinite(n)) return false;
  if (n < 1 || n > 65535) return false;
  return true;
}

function extractPort(hostPort: string): number | null {
  const m = hostPort.match(/:(\d{2,5})$/);
  if (!m) return null;
  const n = Number(m[1]);
  return isPlausiblePort(m[1]) ? n : null;
}

/**
 * Returns true if the port is a commonly-defaulted dev port (5173, 3000, 8080).
 * Use this to warn developers when a detected endpoint is using a likely
 * conflict-prone port. Does not check whether the port is actually in use —
 * see docs/PORT-GUIDANCE.md for proactive allocation rules.
 */
export function isDefaultDevPort(port: number): boolean {
  return port === 5173 || port === 3000 || port === 8080;
}
