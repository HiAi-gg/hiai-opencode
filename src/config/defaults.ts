/**
 * Default config values for hiai-opencode
 */
import type { HiaiOpencodeConfig } from "./types.js";

export const defaultConfig: HiaiOpencodeConfig = {
  agents: {
    // --- Tier 1: Core Orchestration ---
    "bob": { model: "openrouter/anthropic/claude-3.5-opus" },
    "strategist": { model: "openrouter/z-ai/glm-5.1" },
    "coder": { model: "openrouter/anthropic/claude-3.5-sonnet" },
    "guard": { model: "openrouter/openai/gpt-4o" },
    general: { model: "openrouter/anthropic/claude-3.5-sonnet" },

    // --- Tier 2: Specialized Assistance ---
    "zoe": { model: "openrouter/google/gemini-3.1-flash" },
    "sub": { model: "openrouter/google/gemini-3.1-flash" },
    "logician": { model: "openrouter/anthropic/claude-3.5-opus" },
    explore: { model: "openrouter/google/gemini-3.1-flash" },
    librarian: { model: "openrouter/google/gemini-3.1-flash" },
    "pre-plan": { model: "openrouter/openai/gpt-4o" },
    "critic": { model: "openrouter/qwen/qwen2.5-72b-instruct" },
    "ui": { model: "openrouter/google/gemini-3.1-pro-vision" },

    // --- Tier 3: Building & Refactoring ---
    build: { model: "openrouter/anthropic/claude-3.5-sonnet" },
    mindmodel: { model: "openrouter/google/gemini-3.1-flash" },
    "ledger-creator": { model: "openrouter/google/gemini-3.1-flash" },
    bootstrapper: { model: "openrouter/google/gemini-3.1-flash" },
    "project-initializer": { model: "openrouter/openai/gpt-4o" },

    // --- Tier 4: Quality & Debugging ---
    "code-reviewer": { model: "openrouter/anthropic/claude-3.5-sonnet" },
    "systematic-debugger": { model: "openrouter/anthropic/claude-3.5-sonnet" },
    brainstormer: { model: "openrouter/google/gemini-3.1-flash" },
    "agent-skills": { model: "openrouter/google/gemini-3.1-flash" },
  },

  categories: {
    "visual-engineering": { model: "openrouter/google/gemini-2.0-pro-exp-02-05", variant: "high" },
    artistry: { model: "openrouter/google/gemini-2.0-pro-exp-02-05", variant: "high" },
    ultrabrain: { model: "openrouter/openai/gpt-4o", variant: "xhigh" },
    deep: { model: "openrouter/openai/o1", variant: "medium" },
    quick: { model: "openrouter/anthropic/claude-3-5-haiku" },
    writing: { model: "openrouter/kimi/kimi-latest" },
    git: { model: "openrouter/anthropic/claude-3-5-haiku" },
    "unspecified-low": { model: "openrouter/google/gemini-2.0-flash" },
    "unspecified-high": { model: "openrouter/anthropic/claude-3.5-sonnet", variant: "max" },
  },

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
    model: "qwen3.5:4b",
    baseUrl: "http://localhost:11434",
    purpose: "helper",
  },
};
