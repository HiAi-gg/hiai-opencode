export const MODEL_ROLE_GUIDE = [
  "fast: cheap/default for bounded helpers, researcher-style scans, platform chores",
  "mid: balanced default for steady execution/review work",
  "high: stronger general-purpose model for primary implementation and planning",
  "ultrahigh: highest-cost/high-accuracy slot for hard architecture or critical decisions",
  "vision: preferred for UI/media/multimodal interpretation and visual work",
  "reasoning: preferred for deeper multi-step reasoning when latency/cost are acceptable",
] as const;

export const PROVIDER_MODEL_RULES = [
  "openai: use `openai/<model>` for direct OpenAI calls, e.g. `openai/gpt-5` or `openai/o1`",
  "anthropic: use `anthropic/<model>`, e.g. `anthropic/claude-3.5-sonnet`",
  "deepseek: use `deepseek/<model>` when connected directly",
  "glm: use `z-ai/<model>` or the provider id exposed by your gateway/client",
  "minimax: use `minimax/<model>`",
  "qwen: use `qwen/<model>`",
  "ollama: use the native local model id in Ollama config, e.g. `qwen3.5:4b`",
  "openrouter: use `openrouter/<vendor>/<model>`, e.g. `openrouter/anthropic/claude-3.5-sonnet`",
  "rule: store fully qualified model ids in config; avoid local aliases like `fast`, `sonnet`, or provider-less ids",
] as const;

export const MODEL_PRESETS = {
  fast: "openrouter/google/gemini-2.0-flash",
  mid: "openrouter/anthropic/claude-3.5-sonnet",
  high: "openrouter/anthropic/claude-3.5-opus",
  ultrahigh: "openrouter/openai/gpt-4o",
  vision: "openrouter/google/gemini-2.0-pro-exp-02-05",
  reasoning: "openrouter/openai/o1",
  strategist: "openrouter/z-ai/glm-5.1",
  critic: "openrouter/qwen/qwen2.5-72b-instruct",
  writing: "openrouter/kimi/kimi-latest",
} as const;
