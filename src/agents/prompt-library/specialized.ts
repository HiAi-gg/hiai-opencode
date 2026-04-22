import type { AvailableAgent } from "../dynamic-agent-prompt-types";

export function buildLogicianSection(agents: AvailableAgent[]): string {
  const strategistAgent = agents.find((agent) => agent.name === "strategist");
  const criticAgent = agents.find((agent) => agent.name === "critic");
  const selectedAgent = criticAgent ?? strategistAgent;
  if (!selectedAgent) return "";

  const useWhen = selectedAgent.metadata.useWhen || [];
  const avoidWhen = selectedAgent.metadata.avoidWhen || [];
  const label = criticAgent ? "Critic" : "Strategist";
  const summary = criticAgent
    ? "High-accuracy review gate for plans and risky decisions."
    : "Planning and architecture specialist for complex decomposition.";

  return `<Strategist_Critic_Usage>
## ${label}

${summary}

### WHEN to Consult:
${useWhen.map((entry) => `- ${entry}`).join("\n")}

### WHEN NOT to Consult:
${avoidWhen.map((entry) => `- ${entry}`).join("\n")}

### Usage Pattern:
Briefly announce "Consulting ${label} for [reason]" before invocation.
</Strategist_Critic_Usage>`;
}

export function buildExploreSection(agents: AvailableAgent[]): string {
  const researcherAgent = agents.find((agent) => agent.name === "researcher");
  if (!researcherAgent) return "";
  const useWhen = researcherAgent.metadata.useWhen || [];
  return `### Researcher = Internal Codebase Discovery
Use it for discovery in this repo.
${useWhen.map((entry) => `- ${entry}`).join("\n")}`;
}

export function buildLibrarianSection(agents: AvailableAgent[]): string {
  const researcherAgent = agents.find((agent) => agent.name === "researcher");
  if (!researcherAgent) return "";
  const useWhen = researcherAgent.metadata.useWhen || [];
  return `### Researcher = External Docs and OSS Research
Search official references, API docs, OSS examples, and the web when needed.
${useWhen.map((entry) => `- "${entry}"`).join("\n")}`;
}
