import type { LoopConfig } from "../types";

export interface CommandOverrides {
  model?: string;
  agent?: string;
  loop?: LoopConfig;
  return?: string[];
  parallel?: string[];
  as?: string; // Named result identifier for $RESULT[name] references
  auto?: boolean; // Auto workflow mode - LLM generates workflow dynamically
}

/**
 * Parse overrides string like "model:foo/bar && loop:10 && until:condition"
 * Uses && as separator between parameters
 * Uses || as separator for multi-value parameters (return, parallel)
 */
export function parseOverridesString(overridesStr: string): CommandOverrides {
  const overrides: CommandOverrides = {};

  // Parse key:value pairs separated by &&
  const pairs = overridesStr.split("&&").map(s => s.trim());
  for (const pair of pairs) {
    const colonIdx = pair.indexOf(":");
    if (colonIdx > 0) {
      const key = pair.slice(0, colonIdx).trim();
      const value = pair.slice(colonIdx + 1).trim();
      if (key === "model") {
        overrides.model = value;
      } else if (key === "agent") {
        overrides.agent = value;
      } else if (key === "loop") {
        // loop:10 - just max iterations, no until marker
        const max = parseInt(value, 10);
        if (!isNaN(max) && max > 0) {
          overrides.loop = { max, until: "" };
        }
      } else if (key === "until") {
        // until:condition - set/update until marker
        if (!overrides.loop) {
          overrides.loop = { max: 10, until: value }; // default max=10
        } else {
          overrides.loop.until = value;
        }
      } else if (key === "return") {
        // return:first || second || third - split on || for multiple returns
        overrides.return = value
          .split("||")
          .map(s => s.trim())
          .filter(s => s.length > 0);
      } else if (key === "parallel") {
        // parallel:/cmd1 args || /cmd2 args - split on || for multiple parallels
        overrides.parallel = value
          .split("||")
          .map(s => s.trim())
          .filter(s => s.length > 0);
      } else if (key === "as") {
        // as:name - named result identifier
        overrides.as = value;
      } else if (key === "auto") {
        // auto:true - enable auto workflow mode
        overrides.auto = value === "true";
      }
    }
  }

  return overrides;
}
