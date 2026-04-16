import { PROMETHEUS_AGENT } from "./constants"

export function isStrategistAgent(agentName: string | undefined): boolean {
  return agentName?.toLowerCase().includes(PROMETHEUS_AGENT) ?? false
}
