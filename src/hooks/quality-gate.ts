import type { BobConfig, HookSet } from "../types";

export function createQualityGate(_config: BobConfig): HookSet {
  return {
    "tool.execute.after": async (input, output) => {
      if (input.tool === "bash") {
        const args = input.args as { command?: string };
        const cmd = args?.command ?? "";
        const isQuality =
          cmd.includes("bun test") ||
          cmd.includes("bun run lint") ||
          cmd.includes("bun run check") ||
          cmd.includes("bun run ci") ||
          cmd.includes("biome check") ||
          cmd.includes("bun run format") ||
          cmd.includes("bun run typecheck") ||
          cmd.includes("tsc");
        if (isQuality) {
          const hasErrors =
            output.output?.includes("error") ||
            output.output?.includes("Error") ||
            output.output?.includes("ERR") ||
            output.output?.includes("TS error");
          if (hasErrors) {
            console.log(
              `[hiai-opencode] QUALITY GATE FAILED: ${cmd.split(" ")[0]}`,
            );
            const cmdName = cmd.split(" ")[0];
            output.output += `\n\n[hiai-opencode] ⛔ QUALITY GATE FAILED: ${cmdName} detected errors.\n⛔ You CANNOT emit CLOSURE until this command exits 0.\n⛔ Run the failing command again after fixing and verify exit code 0.\n⛔ If you emit CLOSURE without a passing check, your response will be REJECTED.\n⛔ Cannot mark task done until quality gate passes.`;
          }
        }
      }
    },
  };
}
