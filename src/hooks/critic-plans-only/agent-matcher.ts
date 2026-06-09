import { CRITIC_AGENT } from "./constants";

export function isCriticAgent(agentName: string | undefined): boolean {
  return agentName?.toLowerCase().includes(CRITIC_AGENT) ?? false;
}
