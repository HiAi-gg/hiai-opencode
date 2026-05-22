// Bob agent — re-exports from core+overlay architecture.
// This file exists for backward compatibility with existing imports.
// New code should import from "./bob" (directory) directly.

export { createBobAgent, BOB_PROMPT_METADATA, createGptBobAgent, buildDynamicBobPrompt } from "./bob/index";
