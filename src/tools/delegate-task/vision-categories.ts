import type { BuiltinCategoryDefinition } from "./builtin-category-definition";

const VISION_PROMPT_APPEND = `<Category_Context>
You are working on VISUAL VERIFICATION / BROWSER INSPECTION tasks.

<Routing_Policy>
Executor contour: vision (visual analysis). Use agent-browser for live page interaction.
</Routing_Policy>

You verify visual output, inspect browser pages, and confirm UI correctness.

Approach:
1. Navigate to the target URL using agent-browser
2. Take screenshots at key states
3. Compare against expected behavior/design
4. Report discrepancies with evidence (screenshots + descriptions)
5. Verify: layout, typography, colors, spacing, responsiveness, console errors

Do NOT modify code. Your role is observation and reporting.
</Category_Context>`;

export const VISION_CATEGORIES: BuiltinCategoryDefinition[] = [
  {
    name: "browser-verification",
    config: {},
    description:
      "Browser-based visual verification. Uses vision agent with agent-browser for live page inspection.",
    promptAppend: VISION_PROMPT_APPEND,
  },
  {
    name: "ui-inspection",
    config: {},
    description:
      "UI inspection and visual regression testing. Uses vision agent.",
    promptAppend: VISION_PROMPT_APPEND,
  },
  {
    name: "screenshot",
    config: {},
    description:
      "Screenshot capture and visual analysis. Uses vision agent.",
    promptAppend: VISION_PROMPT_APPEND,
  },
];
