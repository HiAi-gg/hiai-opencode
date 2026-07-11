import { existsSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "bun";
import { getToolSetting } from "../../config";

export interface LSPDiagnostic {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  severity?: number;
  message: string;
  source?: string;
}

export interface LSPLocation {
  uri: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

export interface LSPSymbol {
  name: string;
  kind: number;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  location?: LSPLocation;
}

export interface LSPPrepareRename {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  placeholder: string;
}

export interface LSPEdit {
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  newText: string;
}

const LANG_MAP: Record<string, string> = {
  ".ts": "typescript",
  ".tsx": "typescriptreact",
  ".js": "javascript",
  ".jsx": "javascriptreact",
  ".mts": "typescript",
  ".cts": "typescript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".svelte": "svelte",
  ".py": "python",
  ".json": "json",
};

export class LSPClient {
  private proc: ReturnType<typeof spawn> | null = null;
  private requestId = 0;
  private pendingRequests = new Map<
    number,
    {
      resolve: (v: unknown) => void;
      reject: (e: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private diagnosticsStore = new Map<string, LSPDiagnostic[]>();
  private openedFiles = new Set<string>();
  private documentVersions = new Map<string, number>();
  private lastSyncedText = new Map<string, string>();
  private buffer = "";
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private running = false;

  constructor(
    private root: string,
    private command: string[],
    private options: {
      initializationOptions?: Record<string, unknown>;
      env?: Record<string, string>;
    } = {},
    private serverId: string = "unknown",
  ) {}

  /**
   * Optional metadata emitter wired by the LSP tool layer (OpenCode
   * ToolContext.metadata). When set, every LSP operation emits telemetry so
   * results carry tool/server/method/duration/count data for auto-continue
   * heuristics, cost tracking, and parent-session visibility.
   */
  private metadataEmitter?: (input: {
    title?: string;
    metadata?: Record<string, unknown>;
  }) => void;

  /** Wire an OpenCode ToolContext.metadata callback so LSP operations emit telemetry. */
  setMetadataEmitter(
    fn: (input: { title?: string; metadata?: Record<string, unknown> }) => void,
  ): void {
    this.metadataEmitter = fn;
  }

  /** Emit LSP operation telemetry (tool, server, method, duration, counts). */
  private emitMeta(
    method: string,
    duration_ms: number,
    extra: Record<string, unknown> = {},
  ) {
    this.metadataEmitter?.({
      metadata: {
        tool: "lsp",
        server: this.serverId,
        method,
        duration_ms,
        ...extra,
      },
    });
  }

  async start() {
    this.proc = spawn(this.command, {
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
      cwd: this.root,
      env: { ...process.env, ...(this.options.env ?? {}) },
    });
    this.running = true;
    const stdout = this.proc.stdout as unknown as ReadableStream<Uint8Array>;
    this.reader = stdout.getReader();
    this.readLoop();
    await this.initialize();
  }

  private async readLoop() {
    if (!this.reader) return;
    try {
      while (true) {
        const { value, done } = await this.reader.read();
        if (done) break;
        this.buffer += new TextDecoder("utf-8", { fatal: false }).decode(
          value,
          { stream: true },
        );
        this.processBuffer();
      }
    } catch {
      // stream closed
    }
  }

  private processBuffer() {
    const MAX_BUFFER_SIZE = getToolSetting(
      "lsp_max_buffer_size",
      10 * 1024 * 1024,
    );
    if (this.buffer.length > MAX_BUFFER_SIZE) {
      this.buffer = "";
      console.error("[bob] LSP buffer exceeded max size, clearing");
      return;
    }
    while (true) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) break;
      const header = this.buffer.slice(0, headerEnd);
      const match = header.match(/Content-Length: (\d+)/);
      if (!match) {
        this.buffer = this.buffer.slice(headerEnd + 4);
        continue;
      }
      const len = Number.parseInt(match[1], 10);
      const bodyStart = headerEnd + 4;
      if (this.buffer.length < bodyStart + len) break;
      const body = this.buffer.slice(bodyStart, bodyStart + len);
      this.buffer = this.buffer.slice(bodyStart + len);
      try {
        const msg = JSON.parse(body);
        if (msg.id !== undefined && this.pendingRequests.has(msg.id)) {
          const pending =
            this.pendingRequests.get(msg.id) ??
            (() => {
              throw new Error("pending not found");
            })();
          this.pendingRequests.delete(msg.id);
          clearTimeout(pending.timer);
          if (msg.error) pending.reject(new Error(msg.error.message));
          else pending.resolve(msg.result);
        } else if (msg.method === "textDocument/publishDiagnostics") {
          this.diagnosticsStore.set(
            msg.params.uri,
            msg.params.diagnostics ?? [],
          );
        } else if (msg.method && msg.id !== undefined) {
          this.sendResponse(msg.id, null);
        }
      } catch {
        // parse error
      }
    }
  }

  private sendRequest(method: string, params: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.running || !this.proc) {
        reject(new Error("LSP client not running"));
        return;
      }
      const id = ++this.requestId;
      const timer = setTimeout(
        () => {
          this.pendingRequests.delete(id);
          reject(new Error(`Timeout: ${method}`));
        },
        getToolSetting("lsp_request_timeout_ms", 15000),
      );
      this.pendingRequests.set(id, { resolve, reject, timer });
      const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params });
      const header = `Content-Length: ${Buffer.byteLength(msg)}\r\n\r\n`;
      this.writeStdin(header + msg);
    });
  }

  private writeStdin(data: string) {
    const stdin = this.proc?.stdin as unknown as
      | { write(data: string): void }
      | undefined;
    stdin?.write(data);
  }

  private sendNotification(method: string, params: unknown) {
    if (!this.proc) return;
    const msg = JSON.stringify({ jsonrpc: "2.0", method, params });
    const header = `Content-Length: ${Buffer.byteLength(msg)}\r\n\r\n`;
    this.writeStdin(header + msg);
  }

  private sendResponse(id: number, result: unknown) {
    if (!this.proc) return;
    const msg = JSON.stringify({ jsonrpc: "2.0", id, result });
    const header = `Content-Length: ${Buffer.byteLength(msg)}\r\n\r\n`;
    this.writeStdin(header + msg);
  }

  private async initialize() {
    const rootUri = pathToFileURL(this.root).href;
    const initParams: Record<string, unknown> = {
      processId: process.pid,
      rootUri,
      rootPath: this.root,
      workspaceFolders: [{ uri: rootUri, name: "workspace" }],
      capabilities: {
        textDocument: {
          definition: { linkSupport: true },
          references: {},
          publishDiagnostics: {},
          documentSymbol: {},
          rename: { prepareSupport: true },
        },
        workspace: { symbol: {}, workspaceFolders: true },
      },
    };
    if (this.options.initializationOptions) {
      initParams.initializationOptions = this.options.initializationOptions;
    }
    await this.sendRequest("initialize", initParams);
    this.sendNotification("initialized", {});
    await new Promise((r) => setTimeout(r, 300));
  }

  async openFile(filePath: string) {
    const resolved = resolve(filePath);
    if (!existsSync(resolved)) return;
    const uri = pathToFileURL(resolved).href;
    const text = readFileSync(resolved, "utf-8");
    const ext = extname(resolved);
    const langId = LANG_MAP[ext] ?? "plaintext";

    if (!this.openedFiles.has(resolved)) {
      this.sendNotification("textDocument/didOpen", {
        textDocument: { uri, languageId: langId, version: 1, text },
      });
      this.openedFiles.add(resolved);
      this.documentVersions.set(uri, 1);
      this.lastSyncedText.set(uri, text);
      await new Promise((r) => setTimeout(r, 1000));
    } else if (this.lastSyncedText.get(uri) !== text) {
      const version = (this.documentVersions.get(uri) ?? 1) + 1;
      this.sendNotification("textDocument/didChange", {
        textDocument: { uri, version },
        contentChanges: [{ text }],
      });
      this.sendNotification("textDocument/didSave", {
        textDocument: { uri },
        text,
      });
      this.documentVersions.set(uri, version);
      this.lastSyncedText.set(uri, text);
    }
  }

  async definition(
    filePath: string,
    line: number,
    character: number,
  ): Promise<LSPLocation | LSPLocation[] | null> {
    const start = performance.now();
    await this.openFile(filePath);
    const uri = pathToFileURL(resolve(filePath)).href;
    const result = await this.sendRequest("textDocument/definition", {
      textDocument: { uri },
      position: { line: line - 1, character },
    });
    const duration_ms = Math.round(performance.now() - start);
    const count = Array.isArray(result) ? result.length : result ? 1 : 0;
    this.emitMeta("textDocument/definition", duration_ms, {
      result_count: count,
    });
    return (result as LSPLocation | LSPLocation[] | null) ?? null;
  }

  async references(
    filePath: string,
    line: number,
    character: number,
  ): Promise<LSPLocation[]> {
    const start = performance.now();
    await this.openFile(filePath);
    const uri = pathToFileURL(resolve(filePath)).href;
    const result = await this.sendRequest("textDocument/references", {
      textDocument: { uri },
      position: { line: line - 1, character },
      context: { includeDeclaration: true },
    });
    const duration_ms = Math.round(performance.now() - start);
    const refs = (result as LSPLocation[]) ?? [];
    this.emitMeta("textDocument/references", duration_ms, {
      result_count: refs.length,
    });
    return refs;
  }

  async diagnostics(filePath: string): Promise<LSPDiagnostic[]> {
    const start = performance.now();
    await this.openFile(filePath);
    const uri = pathToFileURL(resolve(filePath)).href;
    await new Promise((r) => setTimeout(r, 500));
    let diags: LSPDiagnostic[];
    try {
      const result = (await this.sendRequest("textDocument/diagnostic", {
        textDocument: { uri },
      })) as { items?: unknown[] };
      diags = (result?.items as LSPDiagnostic[] | undefined) ?? [];
    } catch {
      diags = this.diagnosticsStore.get(uri) ?? [];
    }
    const duration_ms = Math.round(performance.now() - start);
    this.emitMeta("textDocument/diagnostic", duration_ms, {
      diagnostics_count: diags.length,
    });
    return diags;
  }

  async symbols(filePath: string): Promise<LSPSymbol[]> {
    const start = performance.now();
    await this.openFile(filePath);
    const uri = pathToFileURL(resolve(filePath)).href;
    const result = await this.sendRequest("textDocument/documentSymbol", {
      textDocument: { uri },
    });
    const duration_ms = Math.round(performance.now() - start);
    const syms = (result as LSPSymbol[]) ?? [];
    this.emitMeta("textDocument/documentSymbol", duration_ms, {
      result_count: syms.length,
    });
    return syms;
  }

  async workspaceSymbols(query: string): Promise<LSPSymbol[]> {
    const start = performance.now();
    const result = await this.sendRequest("workspace/symbol", {
      query,
    });
    const duration_ms = Math.round(performance.now() - start);
    const syms = (result as LSPSymbol[]) ?? [];
    this.emitMeta("workspace/symbol", duration_ms, {
      result_count: syms.length,
    });
    return syms;
  }

  async prepareRename(
    filePath: string,
    line: number,
    character: number,
  ): Promise<LSPPrepareRename | null> {
    const start = performance.now();
    await this.openFile(filePath);
    const uri = pathToFileURL(resolve(filePath)).href;
    const prepResult = await this.sendRequest("textDocument/prepareRename", {
      textDocument: { uri },
      position: { line: line - 1, character },
    });
    const duration_ms = Math.round(performance.now() - start);
    this.emitMeta("textDocument/prepareRename", duration_ms);
    return (prepResult as LSPPrepareRename) ?? null;
  }

  async rename(
    filePath: string,
    line: number,
    character: number,
    newName: string,
  ): Promise<Record<string, LSPEdit[]> | null> {
    const start = performance.now();
    await this.openFile(filePath);
    const uri = pathToFileURL(resolve(filePath)).href;
    const result = await this.sendRequest("textDocument/rename", {
      textDocument: { uri },
      position: { line: line - 1, character },
      newName,
    });
    const duration_ms = Math.round(performance.now() - start);
    const workspaceEdit = result as {
      changes?: Record<string, LSPEdit[]>;
    } | null;
    const changes = workspaceEdit?.changes ?? null;
    const file_count = changes ? Object.keys(changes).length : 0;
    this.emitMeta("textDocument/rename", duration_ms, { file_count });
    return changes;
  }

  async stop() {
    if (!this.running) return;
    this.running = false;
    try {
      await this.sendRequest("shutdown", null);
      this.sendNotification("exit", null);
    } catch {
      // ignore
    }
    this.proc?.kill();
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timer);
      pending.reject(new Error("Client stopped"));
    }
    this.pendingRequests.clear();
  }
}
