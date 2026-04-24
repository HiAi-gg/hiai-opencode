export { buildDefaultBobJuniorPrompt } from "./default"
export { buildGptBobJuniorPrompt } from "./gpt"
export { buildGptProBobJuniorPrompt } from "./gpt-pro"
export { buildGptCodexBobJuniorPrompt } from "./gpt-codex"
export { buildGeminiBobJuniorPrompt } from "./gemini"

export {
  BOB_JUNIOR_DEFAULTS,
  getBobJuniorPromptSource,
  buildBobJuniorPrompt,
  createBobJuniorAgentWithOverrides,
} from "./agent"
export type { BobJuniorPromptSource } from "./agent"
