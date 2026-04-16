export { buildDefaultBobJuniorPrompt } from "./default"
export { buildGptBobJuniorPrompt } from "./gpt"
export { buildGpt54BobJuniorPrompt } from "./gpt-5-4"
export { buildGpt53CodexBobJuniorPrompt } from "./gpt-5-3-codex"
export { buildGeminiBobJuniorPrompt } from "./gemini"

export {
  BOB_JUNIOR_DEFAULTS,
  getBobJuniorPromptSource,
  buildBobJuniorPrompt,
  createBobJuniorAgentWithOverrides,
} from "./agent"
export type { BobJuniorPromptSource } from "./agent"
