/**
 * Default config values for hiai-opencode
 */
import { join } from "node:path";
import type { HiaiOpencodeConfig } from "./types.js";
import { MODEL_PRESETS } from "./models.js";

function resolveAssetScript(...segments: string[]): string {
  return join(import.meta.dirname, "..", "assets", ...segments);
}

function createNpmPackageCommand(pkg: string, ...args: string[]): string[] {
  return ["node", resolveAssetScript("runtime", "npm-package-runner.mjs"), pkg, ...args];
}

function createUpstreamNpxCommand(pkg: string, ...args: string[]): string[] {
  if (process.platform === "win32") {
    return ["cmd", "/c", "npx", "-y", pkg, ...args];
  }

  return ["npx", "-y", pkg, ...args];
}

export const defaultConfig: HiaiOpencodeConfig = {
  agents: {
    bob: { model: MODEL_PRESETS.high },
    guard: { model: MODEL_PRESETS.ultrahigh },
    strategist: { model: MODEL_PRESETS.strategist },
    critic: { model: MODEL_PRESETS.critic },
    coder: { model: MODEL_PRESETS.mid },
    designer: {
      model: "openrouter/google/gemini-3.1-pro",
      description: "Creative visual problem-solver for high-touch UI, interaction, and brand-level interface direction. Best used when the task needs taste, composition, and design judgment rather than plain implementation. (Designer - HiaiOpenCode)",
    },
    sub: { model: MODEL_PRESETS.fast },
    researcher: { model: MODEL_PRESETS.fast },
    multimodal: { model: MODEL_PRESETS.vision },
    "quality-guardian": { model: MODEL_PRESETS.mid },
    "platform-manager": { model: MODEL_PRESETS.fast },
    brainstormer: { model: MODEL_PRESETS.fast },
    "agent-skills": { model: MODEL_PRESETS.fast },
  },
  agentRequirements: {},
  categories: {
    "visual-engineering": { model: MODEL_PRESETS.vision, variant: "high" },
    artistry: { model: MODEL_PRESETS.vision, variant: "high" },
    ultrabrain: { model: MODEL_PRESETS.ultrahigh, variant: "xhigh" },
    deep: { model: MODEL_PRESETS.reasoning, variant: "medium" },
    quick: { model: MODEL_PRESETS.fast },
    writing: { model: MODEL_PRESETS.writing },
    git: { model: MODEL_PRESETS.fast },
    "unspecified-low": { model: MODEL_PRESETS.mid },
    "unspecified-high": { model: MODEL_PRESETS.high, variant: "max" },
  },
  categoryRequirements: {},

  mcp: {
    playwright: {
      enabled: true,
      command: createNpmPackageCommand("@playwright/mcp@latest"),
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
      command: createUpstreamNpxCommand("@modelcontextprotocol/server-sequential-thinking"),
      timeout: 600000,
    },
    firecrawl: {
      enabled: true,
      command: createUpstreamNpxCommand("firecrawl-mcp"),
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
      command: ["node", resolveAssetScript("mcp", "mempalace.mjs"), "--palace", "./.opencode/palace"],
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
      command: createNpmPackageCommand("eslint-lsp", "--stdio"),
      extensions: [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".svelte"],
    },
    bash: {
      command: createNpmPackageCommand("bash-language-server", "start"),
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
    deny_paths: ["**/backup/**", "**/secrets.*", "**/.env", "**/.env.*"],
  },
  ollama: {
    enabled: false,
    model: "{env:OLLAMA_MODEL:-qwen3.5:4b}",
    baseUrl: "http://localhost:11434",
    purpose: "helper",
  },
};
