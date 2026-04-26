// PROMPT_VERSION: 2026-04-26
import type { AgentConfig } from "@opencode-ai/sdk";
import type { AgentMode, AgentPromptMetadata } from "./types";
import { createAgentToolRestrictions } from "../shared/permission-compat";

const MODE: AgentMode = "subagent";

const DESIGNER_PROMPT = `
<identity>
You are Designer, the visual and UX specialist for HiaiOpenCode.
Your goal is crafting stunning UI/UX, design systems, and visual direction.
</identity>

<responsibilities>
- Visual direction: concept, art direction, layout, branding, design-system guidance
- UI feel: interaction patterns, hierarchy, visual coherence, polish beyond functional implementation
- Design-system work: tokens, typography, color, spacing, component patterns
- Frontend aesthetics review: taste, hierarchy, visual coherence
</responsibilities>

<instructions>
- Ask about target audience, product context, desired emotional tone when missing.
- Generate multiple visual directions with tradeoffs, then recommend one.
- Consider accessibility, brand consistency, and technical feasibility.
- When reviewing UI, focus on what makes it feel premium vs generic.
</instructions>
`;

export function createDesignerAgent(model: string): AgentConfig {
  const restrictions = createAgentToolRestrictions([
    "apply_patch",
    "task",
  ]);

  return {
    description: "Visual direction, UI/UX design, design systems, and frontend aesthetics. (Designer - HiaiOpenCode)",
    mode: MODE,
    model,
    temperature: 0.7,
    ...restrictions,
    prompt: DESIGNER_PROMPT,
  } as AgentConfig;
}
createDesignerAgent.mode = MODE;

export const designerPromptMetadata: AgentPromptMetadata = {
  category: "specialist",
  cost: "EXPENSIVE",
  promptAlias: "Designer",
  keyTrigger: "Visual direction, product UI feel, layout, branding, or design-system work → use designer/visual-engineering.",
  triggers: [
    {
      domain: "Visual direction",
      trigger: "Need UI concept, art direction, layout, branding, or design-system guidance",
    },
    {
      domain: "Frontend aesthetics",
      trigger: "Need polished interface design beyond functional implementation",
    },
  ],
  useWhen: [
    "Defining visual direction, layout, interaction feel, or design-system choices",
    "Reviewing UI for taste, hierarchy, and visual coherence",
  ],
  avoidWhen: [
    "Website copy or wording only (use Brainstormer/Writer)",
    "Backend or infrastructure implementation",
    "Pure file/media extraction (use Vision)",
  ],
};
