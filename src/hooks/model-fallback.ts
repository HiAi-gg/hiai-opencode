import type { BobConfig, HookSet } from "../types";
import { BlockingHookError } from "./errors";

export function createModelFallbackHook(_config: BobConfig): HookSet {
  return {
    event: async ({ event }: { event: unknown }) => {
      try {
        const evt = event as {
          type?: string;
          properties?: Record<string, unknown>;
        };
        if (evt?.type === "session.error") {
          const error = (evt.properties?.error as string) ?? "";
          if (
            error.includes("429") ||
            error.includes("503") ||
            error.includes("rate_limit")
          ) {
            console.log(
              "[hiai-opencode] Model fallback: rate limit detected — switching to fallback model",
            );
          }
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        console.error("[hiai-opencode] Hook error in model-fallback:", err);
      }
    },
  };
}
