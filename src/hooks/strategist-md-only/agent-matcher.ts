import { STRATEGIST_AGENT } from "./constants";

export function isStrategistAgent(agentName: string | undefined): boolean {
  return agentName?.toLowerCase().includes(STRATEGIST_AGENT) ?? false;
}
