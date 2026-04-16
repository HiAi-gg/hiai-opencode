/**
 * hiai-opencode config types
 */

export interface AgentConfig {
  model: string;
  description?: string;
}

export interface CategoryConfig {
  model: string;
  variant?: string;
  description?: string;
}

export interface McpServerConfig {
  enabled: boolean;
  type?: "remote" | "local";
  url?: string;
  headers?: Record<string, string>;
  command?: string[];
  timeout?: number;
  environment?: Record<string, string>;
}

export interface LspServerConfig {
  command: string[];
  extensions: string[];
  initialization?: Record<string, unknown>;
}

export interface Subtask2Config {
  replace_generic?: boolean;
  generic_return?: string | null;
}

export interface SkillsConfig {
  enabled?: boolean;
  disabled?: string[];
}

export interface PermissionsConfig {
  read?: Record<string, string>;
  edit?: Record<string, string>;
  bash?: Record<string, string>;
  deny_paths?: string[];
}

export interface AuthKeys {
  googleSearch?: string;
  openai?: string;
  openrouter?: string;
  stitch?: string;
  firecrawl?: string;
}

export interface OllamaConfig {
  enabled: boolean;
  model: string;
  baseUrl?: string;
  purpose?: "verification" | "helper" | "fallback";
}

export interface HiaiOpencodeConfig {
  $schema?: string;
  agents?: Record<string, AgentConfig>;
  categories?: Record<string, CategoryConfig>;
  mcp?: Record<string, McpServerConfig>;
  lsp?: Record<string, LspServerConfig>;
  subtask2?: Subtask2Config;
  skills?: SkillsConfig;
  permissions?: PermissionsConfig;
  auth?: AuthKeys;
  ollama?: OllamaConfig;
}
