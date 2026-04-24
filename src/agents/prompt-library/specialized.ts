import type { AvailableAgent } from "../dynamic-agent-prompt-types";

export type ResearcherMode = "internal" | "external" | "both";

/**
 * Specialized researcher section builder.
 * The canonical buildResearcherSection lives in dynamic-agent-core-sections.ts;
 * this module exists for specialized/complementary researcher descriptions
 * when mode-specific variants are needed.
 */
export function buildResearcherSection(
  agents: AvailableAgent[],
  mode: ResearcherMode = "both",
): string {
  const researcherAgent = agents.find((agent) => agent.name === "researcher");
  if (!researcherAgent) return "";

  const useWhen = researcherAgent.metadata.useWhen || [];

  if (mode === "internal") {
    return `### Researcher = Internal Codebase Discovery
Use it for discovery in this repo.
${useWhen.map((entry) => `- ${entry}`).join("\n")}`;
  }

  if (mode === "external") {
    return `### Researcher = External Docs and OSS Research
Search official references, API docs, OSS examples, and the web when needed.
${useWhen.map((entry) => `- "${entry}"`).join("\n")}`;
  }

  // "both" mode — use the canonical full section from dynamic-agent-core-sections.ts
  // This function is provided for callers that need mode-specific variants.
  // For the full researcher description, import buildResearcherSection from
  // dynamic-agent-core-sections.ts directly.
  return `### Researcher = Internal + External Research
Use it for both codebase discovery (internal) and external docs/OSS research.
${useWhen.map((entry) => `- ${entry}`).join("\n")}`;
}
