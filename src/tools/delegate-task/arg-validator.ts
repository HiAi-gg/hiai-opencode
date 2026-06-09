import type { DelegateTaskArgs } from "./types.js";

export function validateDelegateTaskArgs(
  args: unknown,
): args is DelegateTaskArgs {
  if (!args || typeof args !== "object") return false;
  const a = args as Record<string, unknown>;
  return typeof a.prompt === "string" || typeof a.command === "string";
}

export function validateRequiredFields(args: DelegateTaskArgs): string[] {
  const errors: string[] = [];
  if (!args.description && !args.prompt && !args.command) {
    errors.push("At least one of description, prompt, or command is required");
  }
  if (!args.session_id && !args.description) {
    errors.push("description is required for new tasks (3-8 word summary)");
  }
  if (args.category && args.subagent_type) {
    errors.push("Cannot specify both category and subagent_type");
  }
  if (!args.category && !args.subagent_type) {
    errors.push("Either category or subagent_type is required");
  }
  return errors;
}
