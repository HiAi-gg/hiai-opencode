// Bob agent — core+overlay architecture
// Default export is Claude overlay (most common).
// GPT overlay available via bob/gpt.ts for GPT-specific config.

export { createBobAgent, BOB_PROMPT_METADATA } from "./claude";
export { createGptBobAgent } from "./gpt";
export { buildDynamicBobPrompt } from "./core";
