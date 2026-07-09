import { existsSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { LSPClient } from "./lsp-client";
import { getServerDef } from "./server-definitions";

const INSTALL_HINTS: Record<string, string> = {
  "typescript-language-server":
    "Install: npm install -g typescript-language-server",
  svelteserver: "Install: npm install -g svelte-language-server",
  biome:
    "Install: npm install -g @biomejs/biome  or  bun add -g @biomejs/biome",
  oxlint: "Install: npm install -g oxlint  or  bun add -g oxlint",
  deno: "Install: curl -fsSL https://deno.land/install.sh | sh  or  brew install deno",
  ruff: "Install: pip install ruff  or  brew install ruff",
  eslint: "Already available via npx (eslint-lsp)",
  pyright: "Install: npm install -g pyright",
  yaml: "Install: npm install -g yaml-language-server",
  gopls: "Install: go install golang.org/x/tools/gopls@latest",
  "rust-analyzer": "Install: rustup component add rust-analyzer",
  "vscode-html-language-server":
    "Install: npm install -g vscode-langservers-extracted",
  "vscode-css-language-server":
    "Install: npm install -g vscode-langservers-extracted",
  "vscode-json-language-server":
    "Install: npm install -g vscode-langservers-extracted",
  "vue-language-server": "Install: npm install -g @vue/language-server",
};

export class LSPManager {
  private clients = new Map<
    string,
    { client: LSPClient; refCount: number; lastUsed: number }
  >();
  private pending = new Map<string, Promise<LSPClient>>();
  private sweepTimer: ReturnType<typeof setInterval> | null = null;
  private idleTimeoutMs: number;

  constructor(idleTimeoutMs = 300_000) {
    this.idleTimeoutMs = idleTimeoutMs;
  }

  async getClient(root: string, serverId: string): Promise<LSPClient> {
    const key = `${root}::${serverId}`;
    const existing = this.clients.get(key);
    if (existing) {
      existing.refCount++;
      existing.lastUsed = Date.now();
      return existing.client;
    }
    const pending = this.pending.get(key);
    if (pending) return pending;

    const promise = this.createClient(root, serverId, key);
    this.pending.set(key, promise);
    try {
      const client = await promise;
      this.ensureSweeper();
      return client;
    } finally {
      this.pending.delete(key);
    }
  }

  private ensureSweeper() {
    if (this.sweepTimer) return;
    // Sweep every 60s
    this.sweepTimer = setInterval(() => this.sweepIdle(), 60_000);
    if (typeof this.sweepTimer === "object" && this.sweepTimer?.unref) {
      this.sweepTimer.unref();
    }
  }

  /** Dispose clients that haven't been used for > idleTimeoutMs and have refCount 0. */
  sweepIdle(): void {
    const now = Date.now();
    for (const [key, entry] of this.clients.entries()) {
      if (entry.refCount <= 0 && now - entry.lastUsed > this.idleTimeoutMs) {
        entry.client.stop().catch(() => {});
        this.clients.delete(key);
      }
    }
    if (this.clients.size === 0 && this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }

  /** Check whether a command is available in PATH. */
  commandExists(command: string): boolean {
    const PATH = process.env.PATH ?? "";
    const dirs = PATH.split(":");
    const isWin = process.platform === "win32";
    for (const dir of dirs) {
      const full = resolvePath(dir, command);
      if (existsSync(full)) return true;
      if (isWin && existsSync(`${full}.exe`)) return true;
      if (isWin && existsSync(`${full}.cmd`)) return true;
    }
    return false;
  }

  /** Get a user-friendly install hint for a failed server command. */
  getInstallHint(command: string): string {
    return (
      INSTALL_HINTS[command] ?? `Install the "${command}" LSP server manually.`
    );
  }

  private async createClient(
    root: string,
    serverId: string,
    key: string,
  ): Promise<LSPClient> {
    const server = getServerDef(serverId);
    if (!server) throw new Error(`Unknown or disabled LSP server: ${serverId}`);

    // Check whether the command (or its first token) is available
    const cmd = server.command;
    const checkCmd = cmd === "npx" ? (server.args[0] ?? cmd) : cmd;
    if (!this.commandExists(checkCmd) && checkCmd !== "npx") {
      throw new Error(
        `LSP server "${serverId}" requires "${checkCmd}" which is not found in PATH.\n${this.getInstallHint(checkCmd)}`,
      );
    }

    const argv = [server.command, ...server.args];
    const client = new LSPClient(root, argv, {
      initializationOptions: server.initializationOptions,
      env: server.env,
    });
    await client.start();
    const existing = this.clients.get(key);
    if (existing) {
      existing.refCount++;
      existing.lastUsed = Date.now();
      await client.stop();
      return existing.client;
    }
    this.clients.set(key, { client, refCount: 1, lastUsed: Date.now() });
    return client;
  }

  async releaseClient(root: string, serverId: string) {
    const key = `${root}::${serverId}`;
    const entry = this.clients.get(key);
    if (!entry) return;
    entry.refCount--;
    entry.lastUsed = Date.now();
    if (entry.refCount <= 0) {
      // Don't stop immediately — the sweeper will clean it up
      // if it remains unused through the idle timeout.
    }
  }

  async disposeAll() {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
    for (const entry of this.clients.values()) {
      await entry.client.stop().catch(() => {});
    }
    this.clients.clear();
  }
}
