import type { Message, Part } from "@opencode-ai/sdk";

import type { CreatedHooks } from "../create-hooks";
import { log } from "../shared/logger";

type MessageWithParts = {
  info: Message;
  parts: Part[];
};

type MessagesTransformOutput = { messages: MessageWithParts[] };

type MessagesTransformHookRecord = {
  "experimental.chat.messages.transform"?: (
    input: Record<string, never>,
    output: MessagesTransformOutput,
  ) => Promise<void> | void;
};

const HOOK_NAMES = [
  "contextInjectorMessagesTransform",
  "thinkingBlockValidator",
  "toolPairValidator",
] as const;

type HookName = (typeof HOOK_NAMES)[number];

async function runTransformHookSafely(
  hookName: HookName,
  hookRecord: MessagesTransformHookRecord | null | undefined,
  input: Record<string, never>,
  output: MessagesTransformOutput,
): Promise<void> {
  const hook = hookRecord?.["experimental.chat.messages.transform"];
  if (!hook) return;
  try {
    await Promise.resolve(hook(input, output));
  } catch (err) {
    log("[messages-transform] hook threw, continuing", {
      hook: hookName,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function createMessagesTransformHandler(args: {
  hooks: CreatedHooks;
}): (
  input: Record<string, never>,
  output: MessagesTransformOutput,
) => Promise<void> {
  return async (input, output): Promise<void> => {
    await runTransformHookSafely(
      "contextInjectorMessagesTransform",
      args.hooks.contextInjectorMessagesTransform as
        | MessagesTransformHookRecord
        | null
        | undefined,
      input,
      output,
    );

    await runTransformHookSafely(
      "thinkingBlockValidator",
      args.hooks.thinkingBlockValidator as
        | MessagesTransformHookRecord
        | null
        | undefined,
      input,
      output,
    );

    await runTransformHookSafely(
      "toolPairValidator",
      args.hooks.toolPairValidator as
        | MessagesTransformHookRecord
        | null
        | undefined,
      input,
      output,
    );
  };
}
