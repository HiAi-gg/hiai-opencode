#!/usr/bin/env node

const RAG_URL = process.env.OPENCODE_RAG_URL || "http://mcp-rag:9002/tools/search";
const DEBUG = /^(1|true|yes|on)$/i.test(process.env.OPENCODE_RAG_DEBUG || "");
let transportMode = "framed";

function debug(message) {
  if (DEBUG) {
    process.stderr.write(`[opencode-rag-mcp] ${message}\n`);
  }
}

function writeMessage(payload) {
  const raw = JSON.stringify(payload);
  if (transportMode === "ndjson") {
    process.stdout.write(raw + "\n");
    return;
  }
  const body = Buffer.from(raw, "utf8");
  process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
  process.stdout.write(body);
}

function success(id, result) {
  writeMessage({ jsonrpc: "2.0", id, result });
}

function error(id, code, message) {
  writeMessage({ jsonrpc: "2.0", id, error: { code, message } });
}

async function callRag(arguments_) {
  const payload = {
    query: arguments_.query || "",
    agent: arguments_.agent || "public",
    limit: Number.parseInt(String(arguments_.limit ?? 5), 10),
    self_identity: Boolean(arguments_.self_identity),
    style_mode: Boolean(arguments_.style_mode),
    style_intent: arguments_.style_intent,
    include_graph: arguments_.include_graph !== false,
    scope: arguments_.scope || "all",
  };

  const response = await fetch(RAG_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`rag_http_error:${response.status}:${text}`);
  }
  return JSON.parse(text);
}

const TOOLS = [
  {
    name: "search_rag",
    description: "Search the local architecture, docs, and GraphRAG knowledge base.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query." },
        agent: { type: "string", description: "Agent/persona context.", default: "public" },
        limit: { type: "integer", description: "Max number of results.", default: 5 },
        self_identity: { type: "boolean", default: false },
        style_mode: { type: "boolean", default: false },
        style_intent: { type: "string" },
        include_graph: { type: "boolean", default: true },
        scope: { type: "string", default: "all" },
      },
      required: ["query"],
    },
  },
];

let buffer = Buffer.alloc(0);
let processing = Promise.resolve();

async function handleMessage(message) {
  const method = message.method;
  const id = message.id;
  debug(`received method=${JSON.stringify(method)} id=${JSON.stringify(id)}`);

  if (method === "initialize") {
    success(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "opencode-rag-bridge", version: "1.0.0" },
    });
    return;
  }

  if (method === "notifications/initialized") {
    return;
  }

  if (method === "ping") {
    success(id, {});
    return;
  }

  if (method === "tools/list") {
    success(id, { tools: TOOLS });
    return;
  }

  if (method === "resources/list") {
    success(id, { resources: [] });
    return;
  }

  if (method === "prompts/list") {
    success(id, { prompts: [] });
    return;
  }

  if (method === "tools/call") {
    const params = message.params || {};
    if (params.name !== "search_rag") {
      error(id, -32602, `unknown tool: ${params.name}`);
      return;
    }
    try {
      const result = await callRag(params.arguments || {});
      success(id, {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      });
    } catch (err) {
      error(id, -32000, String(err instanceof Error ? err.message : err));
    }
    return;
  }

  error(id, -32601, `method not found: ${method}`);
}

function drainBuffer() {
  while (true) {
    let headerEnd = buffer.indexOf("\r\n\r\n");
    let headerSize = 4;
    if (headerEnd === -1) {
      headerEnd = buffer.indexOf("\n\n");
      headerSize = 2;
    }
    if (headerEnd === -1) {
      // Fallback for clients that send newline-delimited JSON-RPC instead of Content-Length framing.
      const lf = buffer.indexOf("\n");
      if (lf === -1) return;
      const line = buffer.subarray(0, lf).toString("utf8").trim();
      buffer = buffer.subarray(lf + 1);
      if (!line) continue;
      try {
        const message = JSON.parse(line);
        transportMode = "ndjson";
        debug("parsed ndjson frame");
        processing = processing
          .then(() => handleMessage(message))
          .catch((err) => {
            debug(`handler error: ${String(err)}`);
          });
      } catch (err) {
        debug(`invalid ndjson: ${String(err)}`);
      }
      continue;
    }
    const headerText = buffer.subarray(0, headerEnd).toString("utf8");
    const match = headerText.match(/content-length:\s*(\d+)/i);
    if (!match) {
      buffer = buffer.subarray(headerEnd + headerSize);
      continue;
    }
    const contentLength = Number.parseInt(match[1], 10);
    const totalLength = headerEnd + headerSize + contentLength;
    if (buffer.length < totalLength) return;
    const body = buffer.subarray(headerEnd + headerSize, totalLength).toString("utf8");
    buffer = buffer.subarray(totalLength);
    let message;
    try {
      message = JSON.parse(body);
      transportMode = "framed";
      debug(`parsed content-length frame size=${contentLength}`);
    } catch (err) {
      debug(`invalid JSON: ${String(err)}`);
      continue;
    }
    processing = processing
      .then(() => handleMessage(message))
      .catch((err) => {
        debug(`handler error: ${String(err)}`);
      });
  }
}

debug("server started");
process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  drainBuffer();
});
process.stdin.on("end", () => {
  debug("stdin closed");
  processing
    .catch(() => {})
    .finally(() => process.exit(0));
});
