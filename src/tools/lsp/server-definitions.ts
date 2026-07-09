export type LspServerEntry = {
  command: string;
  args: string[];
  extensions: string[];
  initializationOptions?: Record<string, unknown>;
  env?: Record<string, string>;
};

export const BUILTIN_SERVERS: Record<string, LspServerEntry> = {
  typescript: {
    command: "typescript-language-server",
    args: ["--stdio"],
    extensions: [".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"],
  },
  svelte: {
    command: "svelteserver",
    args: ["--stdio"],
    extensions: [".svelte"],
  },
  eslint: {
    command: "npx",
    args: ["-y", "eslint-lsp"],
    extensions: [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"],
  },
  pyright: {
    command: "pyright-langserver",
    args: ["--stdio"],
    extensions: [".py"],
  },
  html: {
    command: "vscode-html-language-server",
    args: ["--stdio"],
    extensions: [".html", ".htm"],
  },
  css: {
    command: "vscode-css-language-server",
    args: ["--stdio"],
    extensions: [".css", ".scss", ".less"],
  },
  json: {
    command: "vscode-json-language-server",
    args: ["--stdio"],
    extensions: [".json", ".jsonc"],
  },
  vue: {
    command: "vue-language-server",
    args: ["--stdio"],
    extensions: [".vue"],
  },
  go: {
    command: "gopls",
    args: ["serve"],
    extensions: [".go"],
  },
  rust: {
    command: "rust-analyzer",
    args: [],
    extensions: [".rs"],
  },
  yaml: {
    command: "yaml-language-server",
    args: ["--stdio"],
    extensions: [".yaml", ".yml"],
  },
  biome: {
    command: "biome",
    args: ["lsp-proxy"],
    extensions: [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".json", ".css"],
    env: { BIOME_LOG_DIR: "/tmp" },
  },
  oxlint: {
    command: "oxlint",
    args: ["--lsp"],
    extensions: [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"],
  },
  deno: {
    command: "deno",
    args: ["lsp"],
    extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".mts", ".cjs", ".json"],
    initializationOptions: {
      enable: true,
      lint: true,
      suggest: { imports: { hosts: {} } },
      unstable: false,
    },
  },
  ruff: {
    command: "ruff",
    args: ["server"],
    extensions: [".py"],
    initializationOptions: {
      settings: { showSyntaxErrors: true },
    },
  },
};

type LspUserConfig = {
  enabled?: boolean;
  command?: string;
  args?: string[];
  initializationOptions?: Record<string, unknown>;
  env?: Record<string, string>;
};

let _lspConfig: Record<string, LspUserConfig> | undefined;

export function setLspConfig(config: Record<string, LspUserConfig>): void {
  _lspConfig = config;
}

const PRIORITY = [
  "typescript",
  "biome",
  "oxlint",
  "deno",
  "svelte",
  "eslint",
  "pyright",
  "ruff",
  "html",
  "css",
  "json",
  "vue",
  "go",
  "rust",
  "yaml",
];

export function findServerForExtension(
  ext: string,
  lspConfig?: Record<string, LspUserConfig>,
): { id: string; server: LspServerEntry } | null {
  const config = lspConfig ?? _lspConfig;
  for (const id of PRIORITY) {
    const server = BUILTIN_SERVERS[id];
    if (config && config[id]?.enabled === false) continue;
    if (server?.extensions.includes(ext)) return { id, server };
  }
  return null;
}

export function getServerDef(
  id: string,
  config?: LspUserConfig,
): LspServerEntry | null {
  if (config?.enabled === false) return null;
  const builtin = BUILTIN_SERVERS[id];
  if (!builtin) return null;
  if (!config) return builtin;
  return {
    command: config.command ?? builtin.command,
    args: config.args ?? builtin.args,
    extensions: builtin.extensions,
    initializationOptions:
      config.initializationOptions ?? builtin.initializationOptions,
    env: config.env ?? builtin.env,
  };
}
