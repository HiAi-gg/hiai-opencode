import type {
  AvailableAgent,
  AvailableCategory,
  AvailableTool,
} from "../dynamic-agent-prompt-types";
import { getToolsPromptDisplay } from "../dynamic-agent-tool-categorization";

export function buildKeyTriggersSection(agents: AvailableAgent[]): string {
  const keyTriggers = agents
    .filter((agent) => agent.metadata.keyTrigger)
    .map((agent) => `- ${agent.metadata.keyTrigger}`);

  if (keyTriggers.length === 0) return "";

  return `### Key Triggers (check BEFORE classification):

${keyTriggers.join("\n")}
- **"Look into" + "create PR"** → Not just research. Full implementation cycle expected.`;
}

export function buildToolSelectionTable(
  agents: AvailableAgent[],
  tools: AvailableTool[] = [],
): string {
  const rows: string[] = ["### Tool & Agent Selection:", ""];

  if (tools.length > 0) {
    rows.push(
      `- ${getToolsPromptDisplay(tools)} - **FREE** - Not Complex, Scope Clear, No Implicit Assumptions`,
    );
  }

  const costOrder = { FREE: 0, CHEAP: 1, EXPENSIVE: 2 };
  const sortedAgents = [...agents]
    .filter((agent) => agent.metadata.category !== "utility")
    .sort(
      (left, right) => (costOrder[left.metadata.cost] ?? 0) - (costOrder[right.metadata.cost] ?? 0),
    );

  for (const agent of sortedAgents) {
    const shortDescription = agent.description.split(".")[0] || agent.description;
    rows.push(
      `- \`${agent.name}\` agent - **${agent.metadata.cost}** - ${shortDescription}`,
    );
  }

  return rows.join("\n");
}

export function buildDelegationTable(agents: AvailableAgent[]): string {
  const rows: string[] = ["### Delegation Table:", ""];

  for (const agent of agents) {
    for (const trigger of agent.metadata.triggers) {
      rows.push(`- **${trigger.domain}** → \`${agent.name}\` - ${trigger.trigger}`);
    }
  }

  return rows.join("\n");
}
