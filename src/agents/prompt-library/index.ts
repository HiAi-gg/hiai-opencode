export * from "./identity";
export * from "./orchestration";
export * from "./specialized";
export * from "./strategy";
export * from "./platform";

export function buildAntiPatternsSection(): string {
  return `### Anti-Patterns:
- No stubs or TODOs in code.
- No direct tool calls for complex discovery (use subagents).
- No status updates without tool calls.`;
}
