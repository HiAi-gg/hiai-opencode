/**
 * Default config values for hiai-opencode
 */
import type { HiaiOpencodeConfig } from "./types.js";

export const defaultConfig: HiaiOpencodeConfig = {
  agents: {
    bob: { model: "hiai-high" },
    guard: { model: "hiai-mid" },
    strategist: { model: "hiai-high" },
    critic: { model: "hiai-high" },
    coder: { model: "hiai-mid" },
    sub: { model: "hiai-fast" },
    researcher: { model: "hiai-fast" },
    multimodal: { model: "hiai-vision" },
    "quality-guardian": { model: "hiai-mid" },
    "platform-manager": { model: "hiai-fast" },
    brainstormer: { model: "hiai-fast" },
    "agent-skills": { model: "hiai-fast" },
  },
  agentRequirements: {},
  categories: {},
  categoryRequirements: {},

  mcp: {
    playwright: {
      enabled: true,
      command: ["npx", "-y", "@playwright/mcp@latest"],
      timeout: 600000,
    },
    stitch: {
      enabled: true,
      type: "remote",
      url: "https://stitch.googleapis.com/mcp",
      headers: { "X-Goog-Api-Key": "{env:STITCH_AI_API_KEY}" },
      timeout: 600000,
    },
    "sequential-thinking": {
      enabled: true,
      command: ["npx", "-y", "@modelcontextprotocol/server-sequential-thinking"],
      timeout: 600000,
    },
    firecrawl: {
      enabled: true,
      command: ["npx", "-y", "firecrawl-mcp"],
      timeout: 600000,
      environment: { FIRECRAWL_API_KEY: "{env:FIRECRAWL_API_KEY}" },
    },
    rag: {
      enabled: true,
      type: "remote",
      url: "http://localhost:9002",
      timeout: 600000,
    },
    context7: {
      enabled: true,
      type: "remote",
      url: "https://mcp.context7.com/mcp",
      headers: { "X-API-KEY": "{env:CONTEXT7_API_KEY}" },
      timeout: 600000,
    },
    mempalace: {
      enabled: true,
      command: ["python", "-m", "mempalace.mcp_server", "--palace", "./.opencode/palace"],
      timeout: 600000,
    },
  },

  lsp: {
    typescript: {
      command: ["typescript-language-server", "--stdio"],
      extensions: [".ts", ".tsx", ".mts", ".cts"],
    },
    svelte: {
      command: ["svelteserver", "--stdio"],
      extensions: [".svelte"],
    },
    eslint: {
      command: ["vscode-eslint-language-server", "--stdio"],
      extensions: [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".svelte"],
    },
    bash: {
      command: ["bash-language-server", "start"],
      extensions: [".sh", ".bash"],
    },
    pyright: {
      command: ["pyright-langserver", "--stdio"],
      extensions: [".py"],
    },
  },

  subtask2: {
    replace_generic: true,
    generic_return: null,
  },

  skills: {
    enabled: true,
    disabled: [],
  },

  permissions: {
    read: { "*": "allow", "*.env": "deny", "*.env.*": "deny", "*.env.example": "allow" },
    edit: { "*": "allow" },
    bash: { "*": "allow" },
    deny_paths: ["/mnt/ai_data/backup/*", "/mnt/ai_data/docs/secrets.md"],
  },
  ollama: {
    enabled: false,
    model: "{env:OLLAMA_MODEL:-qwen3.5:4b}",
    baseUrl: "http://localhost:11434",
    purpose: "helper",
  },
};
