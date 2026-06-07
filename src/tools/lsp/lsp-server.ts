import { LSPClient } from "./lsp-client";
import { registerLspManagerProcessCleanup, type LspProcessCleanupHandle } from "./lsp-manager-process-cleanup";
import { cleanupTempDirectoryLspClients } from "./lsp-manager-temp-directory-cleanup";
import { logWarn } from "../../shared/logger";
import type { ResolvedServer } from "./types";
interface ManagedClient {
  client: LSPClient;
  lastUsedAt: number;
  refCount: number;
  initPromise?: Promise<void>;
  isInitializing: boolean;
  initializingSince?: number;
}
class LSPServerManager {
  private static instance: LSPServerManager;
  private clients = new Map<string, ManagedClient>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private readonly IDLE_TIMEOUT = 5 * 60 * 1000;
  private readonly INIT_TIMEOUT = 60 * 1000;
  private cleanupHandle: LspProcessCleanupHandle | null = null;
  private constructor() {
    this.startCleanupTimer();
    this.registerProcessCleanup();
  }
  private registerProcessCleanup(): void {
    this.cleanupHandle = registerLspManagerProcessCleanup({
      getClients: () => this.clients.entries(),
      clearClients: () => {
        this.clients.clear();
      },
      clearCleanupInterval: () => {
        if (this.cleanupInterval) {
          clearInterval(this.cleanupInterval);
          this.cleanupInterval = null;
        }
      },
    });
  }

  static getInstance(): LSPServerManager {
    if (!LSPServerManager.instance) {
      LSPServerManager.instance = new LSPServerManager();
    }
    return LSPServerManager.instance;
  }

  private getKey(root: string, serverId: string): string {
    return `${root}::${serverId}`;
  }

  private startCleanupTimer(): void {
    if (this.cleanupInterval) return;
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleClients();
    }, 60000);
    if (typeof this.cleanupInterval === "object" && "unref" in this.cleanupInterval) {
      this.cleanupInterval.unref();
    }
  }

  private cleanupIdleClients(): void {
    const now = Date.now();
    for (const [key, managed] of this.clients) {
      if (managed.refCount === 0 && now - managed.lastUsedAt > this.IDLE_TIMEOUT) {
        managed.client.stop();
        this.clients.delete(key);
      }
    }
  }

  async getClient(root: string, server: ResolvedServer): Promise<LSPClient> {
    const key = this.getKey(root, server.id);
    let managed = this.clients.get(key);
    if (managed) {
      const now = Date.now();
      if (
        managed.isInitializing &&
        managed.initializingSince !== undefined &&
        now - managed.initializingSince >= this.INIT_TIMEOUT
      ) {
        // Stale init can permanently block subsequent calls (e.g., LSP process hang)
        try {
          await managed.client.stop();
        } catch (error) {
          // Stopping a hung init client failed; we'll still drop the entry from
          // the map below so the next caller can retry. Surface the failure so
          // we can spot servers that consistently refuse to die.
          logWarn("[lsp-server] failed to stop stale init client", {
            key,
            error: String(error),
          });
        }
        this.clients.delete(key);
        managed = undefined;
      }
    }
    if (managed) {
      if (managed.initPromise) {
        try {
          await managed.initPromise;
        } catch (error) {
          // Failed init should not keep the key blocked forever.
          try {
            await managed.client.stop();
          } catch (stopError) {
            // Init already failed; best-effort stop on a dying client.
            logWarn("[lsp-server] failed to stop client after init failure", {
              key,
              initError: String(error),
              stopError: String(stopError),
            });
          }
          this.clients.delete(key);
          managed = undefined;
        }
      }

      if (managed) {
        if (managed.client.isAlive()) {
          managed.refCount++;
          managed.lastUsedAt = Date.now();
          return managed.client;
        }
        try {
          await managed.client.stop();
        } catch (error) {
          // Client reported dead but stop threw — drop it from the map and
          // let the caller build a fresh one. Logging lets us spot servers
          // that throw on stop more than once.
          logWarn("[lsp-server] failed to stop dead client", {
            key,
            error: String(error),
          });
        }
        this.clients.delete(key);
      }
    }

    const client = new LSPClient(root, server);
    const initPromise = (async () => {
      await client.start();
      await client.initialize();
    })();
    const initStartedAt = Date.now();
    this.clients.set(key, {
      client,
      lastUsedAt: initStartedAt,
      refCount: 1,
      initPromise,
      isInitializing: true,
      initializingSince: initStartedAt,
    });

    try {
      await initPromise;
    } catch (error) {
      this.clients.delete(key);
      try {
        await client.stop();
      } catch (stopError) {
        // Init already failed; best-effort stop on the new client we never
        // published. The original error must still propagate to the caller.
        logWarn("[lsp-server] failed to stop client after init threw", {
          key,
          initError: String(error),
          stopError: String(stopError),
        });
      }
      throw error;
    }
    const m = this.clients.get(key);
    if (m) {
      m.initPromise = undefined;
      m.isInitializing = false;
      m.initializingSince = undefined;
    }

    return client;
  }

  warmupClient(root: string, server: ResolvedServer): void {
    const key = this.getKey(root, server.id);
    if (this.clients.has(key)) return;
    const client = new LSPClient(root, server);
    const initPromise = (async () => {
      await client.start();
      await client.initialize();
    })();

    const initStartedAt = Date.now();
    this.clients.set(key, {
      client,
      lastUsedAt: initStartedAt,
      refCount: 0,
      initPromise,
      isInitializing: true,
      initializingSince: initStartedAt,
    });

    initPromise
      .then(() => {
        const m = this.clients.get(key);
        if (m) {
          m.initPromise = undefined;
          m.isInitializing = false;
          m.initializingSince = undefined;
        }
      })
      .catch(() => {
        // Warmup failures must not permanently block future initialization.
        this.clients.delete(key);
        void client.stop().catch(() => { /* intentionally ignored — cleanup after warmup failure */ });
      });
  }

  releaseClient(root: string, serverId: string): void {
    const key = this.getKey(root, serverId);
    const managed = this.clients.get(key);
    if (managed && managed.refCount > 0) {
      managed.refCount--;
      managed.lastUsedAt = Date.now();
    }
  }

  isServerInitializing(root: string, serverId: string): boolean {
    const key = this.getKey(root, serverId);
    const managed = this.clients.get(key);
    return managed?.isInitializing ?? false;
  }

  async stopAll(): Promise<void> {
    this.cleanupHandle?.unregister();
    this.cleanupHandle = null;
    for (const [, managed] of this.clients) {
      await managed.client.stop();
    }
    this.clients.clear();
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  async cleanupTempDirectoryClients(): Promise<void> {
    await cleanupTempDirectoryLspClients(this.clients);
  }
}

export const lspManager = LSPServerManager.getInstance();
