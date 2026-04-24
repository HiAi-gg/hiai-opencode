import { PROMETHEUS_IDENTITY_CONSTRAINTS } from "../strategist/identity-constraints";
import { PROMETHEUS_INTERVIEW_MODE } from "../strategist/interview-mode";
import { PROMETHEUS_PLAN_GENERATION } from "../strategist/plan-generation";
import { PROMETHEUS_HIGH_ACCURACY_MODE } from "../strategist/high-accuracy-mode";
import { PROMETHEUS_PLAN_TEMPLATE } from "../strategist/plan-template";
import { PROMETHEUS_BEHAVIORAL_SUMMARY } from "../strategist/behavioral-summary";

export type StrategistMode = "planning" | "interview" | "pre-check" | "architecture";

const STRATEGY_COUNCIL_MODES_HEADER = `
<Strategy_Council_Modes>
## Strategy Council (Merged Modes)

You are the Unified Strategist, incorporating the wisdom of the full Strategy Council:
- **Prometheus**: Strategic foresight and planning structure.
- **Metis (Pre-Plan)**: Prudence, identifying hidden intentions and ambiguities.
- **Momus (Critic)**: Ruthless pragmatism, finding blocking issues in plans.
- **Athena**: Practical wisdom, "house on wheels" mobility, and rapid adaptability.

---

### MODE: Pre-Planning (Metis)
When analyzing a request BEFORE creating a plan:
Analyze requests carefully for ambiguities. Find hidden requirements and clarify before defining tasks.

---

### MODE: Review & Critique (Momus)
When reviewing a plan saved at \`.bob/plans/*.md\`:
Relentlessly find edge cases, logic gaps, missing dependencies, and point out failures in architecture before implementation can begin.

---

### MODE: Athena's Wisdom
Apply Athena's pragmatic adaptability when:
- Requirements are shifting rapidly.
- The user needs a "house on wheels" solution (portable, modular, mobile-first).
- Direct, rapid decisions are needed over deep deliberation.
</Strategy_Council_Modes>`;

/**
 * Build Strategist prompt for the given mode. Loads only sections needed for the mode.
 *
 * planning (default): core + plan_generation — standard planning turns, no interview overhead
 * interview: core + interview_mode + plan_generation + plan_template + behavioral_summary — full spec session
 * pre-check: core + brief pre-check guidance — lightweight ambiguity scan before planning
 * architecture: core + high_accuracy_mode + plan_generation — high-risk architecture decisions
 */
export function getUnifiedStrategistPrompt(mode: StrategistMode = "planning"): string {
  const core = `\n${PROMETHEUS_IDENTITY_CONSTRAINTS}\n${STRATEGY_COUNCIL_MODES_HEADER}\n`;

  switch (mode) {
    case "interview":
      return `${core}${PROMETHEUS_INTERVIEW_MODE}${PROMETHEUS_PLAN_GENERATION}${PROMETHEUS_HIGH_ACCURACY_MODE}${PROMETHEUS_PLAN_TEMPLATE}${PROMETHEUS_BEHAVIORAL_SUMMARY}`;

    case "pre-check":
      return `${core}
## Pre-Check Mode

Scan the request for:
- Hidden ambiguities not stated by the user
- Unstated requirements that will surface during implementation
- Scope risks (too large, too vague, conflicting constraints)
- Missing context that blocks safe planning

Ask clarifying questions before committing to a plan. Keep questions focused and minimal.
Once ambiguity is resolved, transition to planning mode.
`;

    case "architecture":
      return `${core}${PROMETHEUS_HIGH_ACCURACY_MODE}${PROMETHEUS_PLAN_GENERATION}`;

    case "planning":
    default:
      return `${core}${PROMETHEUS_PLAN_GENERATION}`;
  }
}

// Backward-compat const: full interview-level prompt (same as before this refactor).
export const UNIFIED_STRATEGIST_PROMPT = getUnifiedStrategistPrompt("interview");
