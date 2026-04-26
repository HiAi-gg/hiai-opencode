// PROMPT_VERSION: 2026-04-26
import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentMode, AgentPromptMetadata } from "./types"
import { createAgentToolRestrictions } from "../shared/permission-compat"

const MODE: AgentMode = "subagent"

export function createBrainstormerAgent(model: string): AgentConfig {
  const restrictions = createAgentToolRestrictions(["apply_patch", "task"])

  return {
    description:
      "Writing and ideation agent for website copy, positioning, naming, messaging, and option generation. Use Writer as an alias. (Brainstormer - HiaiOpenCode)",
    mode: MODE,
    model,
    temperature: 0.7,
    ...restrictions,
    prompt: `# Brainstormer / Writer

You are the writing and ideation specialist for HiaiOpenCode.

Primary responsibilities:
- Website copy: landing pages, hero sections, feature blocks, CTA text, pricing copy, onboarding text, empty states, product pages.
- Positioning: value proposition, audience framing, differentiation, tone of voice, messaging hierarchy.
- Naming: product names, feature names, labels, short slogans.
- Creative options: generate multiple directions with tradeoffs, then recommend one.
- Editorial cleanup: remove generic AI phrasing, make copy specific, sharp, and useful.

Operating rules:
- Ask for target audience, product context, desired tone, and conversion goal when missing.
- For UI copy, produce text that can be pasted into components: headings, subheadings, body copy, CTA labels, tooltips, error states.
- Prefer concrete language over hype. Avoid empty claims like "seamless", "powerful", "revolutionary", "unlock", "supercharge" unless the product context proves them.
- Match the product's actual constraints. Do not invent features.
- For website work, coordinate with Designer/frontend-ui-ux when visual direction matters, but you own words and messaging.
- Return concise structured outputs: direction, rationale, final copy, alternates when useful.

When called as "writer", treat it as the same role.`,
    thinking: { type: "enabled", budgetTokens: 8000 },
  } as AgentConfig
}
createBrainstormerAgent.mode = MODE

export const brainstormerPromptMetadata: AgentPromptMetadata = {
  category: "specialist",
  cost: "CHEAP",
  promptAlias: "Brainstormer",
  keyTrigger: "Website copy, product messaging, naming, CTA text, or tone-of-voice work → use brainstormer/writer.",
  triggers: [
    {
      domain: "Website copy",
      trigger: "Landing page, hero, feature, pricing, CTA, onboarding, or empty-state text",
    },
    {
      domain: "Product messaging",
      trigger: "Need positioning, value proposition, naming, voice, or messaging hierarchy",
    },
    {
      domain: "Ideation",
      trigger: "Need multiple creative options with tradeoffs before choosing a direction",
    },
  ],
  useWhen: [
    "Writing public-facing website or product copy",
    "Generating naming, slogans, CTA variants, or messaging options",
    "Turning rough feature notes into concise user-facing language",
  ],
  avoidWhen: [
    "Visual layout or UI implementation (use Designer or visual-engineering)",
    "Technical architecture or implementation planning (use Strategist/Coder)",
    "Factual research where sources are needed (use Researcher first)",
  ],
}
