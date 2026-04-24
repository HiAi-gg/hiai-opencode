/**
 * Default config values for hiai-opencode
 */
import type { HiaiOpencodeConfig } from "./types.js";
import { MODEL_PRESETS } from "./models.js";
import { createDefaultMcpConfig } from "../mcp/registry.js";
import { join } from "node:path";

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

  mcp: createDefaultMcpConfig(),

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
      command: ["node", join(import.meta.dirname, "..", "assets", "runtime", "npm-package-runner.mjs"), "eslint-lsp", "--stdio"],
      extensions: [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".svelte"],
    },
    bash: {
      command: ["node", join(import.meta.dirname, "..", "assets", "runtime", "npm-package-runner.mjs"), "bash-language-server", "start"],
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
