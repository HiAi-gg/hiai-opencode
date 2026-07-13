#!/usr/bin/env node
/**
 * cline-bridge.mjs - OpenAI-compat pass-through to Cline API with response unwrap.
 *
 * Cline's /api/v1 wraps non-streaming responses in {success, data: {...openai-shape...}}.
 * The AI SDK reads data.choices (top-level) and gets nothing because the real
 * response is at data.data.choices.
 *
 * This bridge sits at http://127.0.0.1:{port}/v1 and:
 *   - Forwards the request body + Authorization header to https://api.cline.bot/api/v1
 *   - Normalizes `reasoning_details` to an array (Vercel upstream rejects string form)
 *   - For JSON responses: unwraps `data.data` to the top level, then normalizes again
 *   - For SSE responses: passes through untouched (Cline already sends standard chunks)
 *
 * Usage:
 *   node cline-bridge.mjs --port 51902 --env-key CLINE_API_KEY --tag cline
 */
import { createServer } from "node:http";

const args = process.argv.slice(2);
function getArg(name, def) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : def;
}
const PORT = parseInt(getArg("port", "51902"), 10);
const ENV_KEY = getArg("env-key", "CLINE_API_KEY");
const TAG = getArg("tag", "cline");

const UPSTREAM = process.env.CLINE_UPSTREAM ?? "https://api.cline.bot/api/v1";
const API_KEY = process.env[ENV_KEY];

if (!API_KEY) {
  console.error(`[${TAG}-bridge] WARNING: ${ENV_KEY} not set - pass-through will fail upstream`);
}

function normalizeReasoningDetailsOnMessage(msg) {
  if (!msg || typeof msg !== "object") return;
  const rd = msg.reasoning_details;
  if (typeof rd === "string") {
    msg.reasoning_details = [{ type: "reasoning.text", text: rd }];
  } else if (rd && typeof rd === "object" && !Array.isArray(rd)) {
    msg.reasoning_details = [rd];
  }
  if (Array.isArray(msg.content)) {
    for (const part of msg.content) {
      if (part && typeof part === "object" && typeof part.reasoning_details === "string") {
        part.reasoning_details = [{ type: "reasoning.text", text: part.reasoning_details }];
      }
    }
  }
}

function normalizeReasoningDetailsInRequest(body) {
  if (!body || typeof body !== "object") return;
  if (Array.isArray(body.messages)) normalizeReasoningDetailsOnMessages(body.messages);
}

function normalizeReasoningDetailsOnMessages(messages) {
  if (!Array.isArray(messages)) return;
  for (const msg of messages) normalizeReasoningDetailsOnMessage(msg);
}

function normalizeReasoningDetailsInResponse(parsed) {
  if (!parsed || typeof parsed !== "object") return;
  if (Array.isArray(parsed.choices)) {
    for (const choice of parsed.choices) {
      if (choice && typeof choice === "object") normalizeReasoningDetailsOnMessage(choice.message);
    }
  }
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function passthroughHeaders(headers) {
  const out = {};
  for (const [k, v] of Object.entries(headers)) {
    if (typeof v !== "string") continue;
    const lk = k.toLowerCase();
    if (lk === "host" || lk === "content-length" || lk === "connection") continue;
    out[k] = v;
  }
  if (API_KEY && !("authorization" in Object.fromEntries(Object.entries(out).map(([k, v]) => [k.toLowerCase(), v])))) {
    out["Authorization"] = `Bearer ${API_KEY}`;
  }
  return out;
}

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") { res.writeHead(204).end(); return; }

  if (req.method === "GET" && (req.url === "/health" || req.url === "/")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, bridge: `${TAG}-bridge`, upstream: UPSTREAM }));
    return;
  }

  if (req.method === "POST" && (req.url?.endsWith("/chat/completions") || req.url?.endsWith("/embeddings"))) {
    let body = await readBody(req);
    if (req.url?.endsWith("/chat/completions")) {
      try {
        const parsedReq = JSON.parse(body.toString("utf-8"));
        normalizeReasoningDetailsInRequest(parsedReq);
        body = Buffer.from(JSON.stringify(parsedReq), "utf-8");
      } catch {
        // Not JSON - let upstream reject it.
      }
    }
    const path = (req.url || "/").replace(/^\/v1/, "") || "/";
    const upstreamUrl = UPSTREAM.replace(/\/$/, "") + (path.startsWith("/") ? path : `/${path}`);
    try {
      const upstream = await fetch(upstreamUrl, {
        method: "POST",
        headers: passthroughHeaders(req.headers),
        body,
      });
      const ct = upstream.headers.get("content-type") ?? "";

      if (!ct.includes("application/json") || upstream.body == null) {
        const headers = {};
        upstream.headers.forEach((v, k) => { headers[k] = v; });
        res.writeHead(upstream.status, headers);
        if (upstream.body) {
          const reader = upstream.body.getReader();
          const pump = async () => {
            while (true) {
              const { done, value } = await reader.read();
              if (done) { res.end(); return; }
              if (!res.write(value)) {
                await new Promise((r) => res.once("drain", r));
              }
            }
          };
          await pump();
        } else {
          res.end();
        }
        return;
      }

      const text = await upstream.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        res.writeHead(upstream.status, { "Content-Type": ct });
        res.end(text);
        return;
      }

      if (parsed && typeof parsed === "object" && "data" in parsed && parsed.data && typeof parsed.data === "object" && ("choices" in parsed.data || "object" in parsed.data)) {
        parsed = parsed.data;
      } else if (parsed && typeof parsed === "object" && "success" in parsed && parsed.success === false) {
        // Error envelope - leave as-is
      }

      normalizeReasoningDetailsInResponse(parsed);

      res.writeHead(upstream.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(parsed));
    } catch (e) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: { message: e.message, type: "upstream_error" } }));
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: { message: `not found: ${req.method} ${req.url}` } }));
});

server.listen(PORT, "127.0.0.1", () => {
  console.error(`[${TAG}-bridge] listening on http://127.0.0.1:${PORT}`);
  console.error(`[${TAG}-bridge] upstream: ${UPSTREAM}`);
  console.error(`[${TAG}-bridge] api key: ${API_KEY ? "set" : "MISSING"}`);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.error(`[${TAG}-bridge] received ${sig}, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  });
}
