// Bob agent — unified model-agnostic factory
// All model-specific overlays (Claude thinking, GPT reasoning) removed.
// OpenCode runtime handles model-specific config.

export { createBobAgent, BOB_PROMPT_METADATA } from "./agent";
export { buildDynamicBobPrompt } from "./core";
