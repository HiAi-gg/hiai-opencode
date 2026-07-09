import { existsSync, readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "bun";

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
  ) {}

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
    const MAX_BUFFER_SIZE = 10 * 1024 * 1024;
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
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Timeout: ${method}`));
      }, 15000);
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
    await this.openFile(filePath);
    const uri = pathToFileURL(resolve(filePath)).href;
    const result = await this.sendRequest("textDocument/definition", {
      textDocument: { uri },
      position: { line: line - 1, character },
    });
    return (result as LSPLocation | LSPLocation[] | null) ?? null;
  }

  async references(
    filePath: string,
    line: number,
    character: number,
  ): Promise<LSPLocation[]> {
    await this.openFile(filePath);
    const uri = pathToFileURL(resolve(filePath)).href;
    const result = await this.sendRequest("textDocument/references", {
      textDocument: { uri },
      position: { line: line - 1, character },
      context: { includeDeclaration: true },
    });
    return (result as LSPLocation[]) ?? [];
  }

  async diagnostics(filePath: string): Promise<LSPDiagnostic[]> {
    await this.openFile(filePath);
    const uri = pathToFileURL(resolve(filePath)).href;
    await new Promise((r) => setTimeout(r, 500));
    let result: { items?: unknown[] } | null = null;
    try {
      result = (await this.sendRequest("textDocument/diagnostic", {
        textDocument: { uri },
      })) as { items?: unknown[] };
    } catch {
      return this.diagnosticsStore.get(uri) ?? [];
    }
    return (result?.items as LSPDiagnostic[] | undefined) ?? [];
  }

  async symbols(filePath: string): Promise<LSPSymbol[]> {
    await this.openFile(filePath);
    const uri = pathToFileURL(resolve(filePath)).href;
    const result = await this.sendRequest("textDocument/documentSymbol", {
      textDocument: { uri },
    });
    return (result as LSPSymbol[]) ?? [];
  }

  async workspaceSymbols(query: string): Promise<LSPSymbol[]> {
    const result = await this.sendRequest("workspace/symbol", {
      query,
    });
    return (result as LSPSymbol[]) ?? [];
  }

  async prepareRename(
    filePath: string,
    line: number,
    character: number,
  ): Promise<LSPPrepareRename | null> {
    await this.openFile(filePath);
    const uri = pathToFileURL(resolve(filePath)).href;
    const prepResult = await this.sendRequest("textDocument/prepareRename", {
      textDocument: { uri },
      position: { line: line - 1, character },
    });
    return (prepResult as LSPPrepareRename) ?? null;
  }

  async rename(
    filePath: string,
    line: number,
    character: number,
    newName: string,
  ): Promise<Record<string, LSPEdit[]> | null> {
    await this.openFile(filePath);
    const uri = pathToFileURL(resolve(filePath)).href;
    const result = await this.sendRequest("textDocument/rename", {
      textDocument: { uri },
      position: { line: line - 1, character },
      newName,
    });
    const workspaceEdit = result as {
      changes?: Record<string, LSPEdit[]>;
    } | null;
    return workspaceEdit?.changes ?? null;
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
