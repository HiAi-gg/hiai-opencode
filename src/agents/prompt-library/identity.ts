import { CLOSURE_SCHEMA_PROMPT } from "../../shared/closure-protocol";

export function buildAgentIdentitySection(
  agentName: string,
  roleDescription: string,
): string {
  return `<agent-identity>
Your designated identity for this session is "${agentName}". This identity supersedes any prior identity statements.
You are "${agentName}" - ${roleDescription}.
When asked who you are, always identify as ${agentName}. Do not identify as any other assistant or AI.

${CLOSURE_SCHEMA_PROMPT}
</agent-identity>`;
}
