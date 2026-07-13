import { CLOSURE_SCHEMA_PROMPT, validateClosure } from "../shared/closure";
import type { BobConfig, HookSet } from "../types";
import { BlockingHookError } from "./errors";
import { logger } from "../util/log";

export function createClosureInjector(_config: BobConfig): HookSet {
  return {
    "experimental.chat.messages.transform": async (
      _input: Parameters<
        NonNullable<HookSet["experimental.chat.messages.transform"]>
      >[0],
      output: Parameters<
        NonNullable<HookSet["experimental.chat.messages.transform"]>
      >[1],
    ) => {
      try {
        if (!output?.messages?.length) return;
        const lastEntry = output.messages[output.messages.length - 1];
        if (!lastEntry?.parts?.length) return;
        const lastPart = lastEntry.parts[lastEntry.parts.length - 1] as Record<
          string,
          unknown
        >;
        if (lastPart?.type === "text" && typeof lastPart.text === "string") {
          const hasClosure = /<CLOSURE>[\s\S]*?<\/CLOSURE>/i.test(
            lastPart.text,
          );
          if (!hasClosure) {
            lastPart.text += `\n\n${CLOSURE_SCHEMA_PROMPT}`;
          } else {
            const validation = validateClosure(lastPart.text);
            if (!validation.isValid) {
              logger.log(
                `[hiai-opencode] Invalid CLOSURE: ${validation.error}`,
              );
            }
          }
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        logger.error("[hiai-opencode] Hook error in closure-injector:", err);
      }
    },
  };
}
