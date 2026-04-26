import type { BuiltinSkill } from "../types"

export const websiteCopywritingSkill: BuiltinSkill = {
  name: "website-copywriting",
  description:
    "Writes sharp website/product copy: landing pages, hero sections, CTAs, feature blocks, positioning, naming, and tone of voice.",
  template: `# Website Copywriting

Use this skill for public-facing product and website text.

## Inputs To Clarify

- Audience: who reads this and what do they already know?
- Goal: sign up, book demo, understand feature, trust product, recover from error, continue onboarding.
- Tone: precise, playful, premium, technical, calm, bold, founder-led, enterprise, developer-first.
- Proof: real features, constraints, metrics, customer pain, differentiators. Do not invent proof.

## Output Shape

Prefer copy that can be pasted into UI:

- Hero: headline, subheadline, primary CTA, secondary CTA.
- Feature block: title, one-sentence value, 2-4 proof bullets.
- Section copy: heading, short intro, card titles, card bodies.
- Microcopy: button labels, empty states, errors, onboarding hints.
- Alternatives: 3-5 variants when tone or positioning is undecided.

## Writing Rules

- Specific beats clever. Concrete verbs beat vague hype.
- Avoid generic AI language: seamless, unlock, supercharge, leverage, robust, cutting-edge, revolutionize, next-generation.
- Keep claims tied to actual capabilities.
- Use short lines for UI. Long paragraphs are usually wrong for websites.
- Preserve product vocabulary from the codebase/docs when available.
- If visual direction matters, pair with \`frontend-ui-ux\` or delegate visual work to Designer.

## Delegation Hint

Use \`task(subagent_type="brainstormer", load_skills=["website-copywriting"], ...)\` for copy-only work.
Use \`category="writing"\` when a category is required. Writer/copywriter aliases map to Brainstormer.`,
}
