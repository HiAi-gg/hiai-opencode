import {
  getClient,
  registerPendingParentForPrompt,
  registerPendingResultCaptureByPrompt,
} from "../core/state";
import { log } from "../utils/logger";
import { hasTurnReferences, parseParallelItem } from "../parsing";
import { resolveTurnReferences } from "./turns";
import type { CommandOverrides } from "../parsing";
import { startLoop } from "../loop";
import { flattenParallels } from "./parallel";

/**
 * Feature: Inline subtask execution
 * Executes /subtask {...} inline subtasks without command files
 */

/**
 * Build a subtask part for inline subtask (used by command hook to replace output.parts)
 */
export async function buildInlineSubtaskPart(
  parsed: {
    prompt: string;
    overrides: CommandOverrides;
  },
  sessionID: string
): Promise<any> {
  let prompt = parsed.prompt;

  // Resolve $TURN references in the prompt
  if (hasTurnReferences(prompt)) {
    prompt = await resolveTurnReferences(prompt, sessionID);
  }

  // Build model from override if present
  let model: { providerID: string; modelID: string } | undefined;
  if (parsed.overrides.model?.includes("/")) {
    const [providerID, ...rest] = parsed.overrides.model.split("/");
    model = { providerID, modelID: rest.join("/") };
  }

  log(
    `buildInlineSubtaskPart: prompt="${prompt.substring(0, 50)}...", model=${
      parsed.overrides.model
    }, agent=${parsed.overrides.agent}`
  );

  // Start loop if configured
  if (parsed.overrides.loop) {
    startLoop(
      sessionID,
      parsed.overrides.loop,
      "_inline_subtask_",
      prompt,
      parsed.overrides.model,
      parsed.overrides.agent,
      parsed.overrides.return
    );
    log(
      `buildInlineSubtaskPart: started loop for "${parsed.overrides.loop.until}" max=${parsed.overrides.loop.max}`
    );
  }

  // Register parent session for $TURN resolution (race-safe: keyed by prompt)
  registerPendingParentForPrompt(prompt, sessionID);

  // Register result capture if `as:` is specified
  if (parsed.overrides.as) {
    registerPendingResultCaptureByPrompt(
      prompt,
      sessionID,
      parsed.overrides.as
    );
    log(
      `buildInlineSubtaskPart: registered result capture as "${parsed.overrides.as}"`
    );
  }

  return {
    type: "subtask",
    agent: parsed.overrides.agent || "build",
    model,
    description: "Inline subtask",
    prompt,
  };
}

export async function executeInlineSubtask(
  parsed: {
    prompt: string;
    overrides: CommandOverrides;
  },
  sessionID: string
) {
  let prompt = parsed.prompt;

  // Resolve $TURN references in the prompt
  if (hasTurnReferences(prompt)) {
    prompt = await resolveTurnReferences(prompt, sessionID);
  }

  // Build model from override if present
  let model: { providerID: string; modelID: string } | undefined;
  if (parsed.overrides.model?.includes("/")) {
    const [providerID, ...rest] = parsed.overrides.model.split("/");
    model = { providerID, modelID: rest.join("/") };
  }

  log(
    `executeInlineSubtask: prompt="${prompt.substring(0, 50)}...", model=${
      parsed.overrides.model
    }, agent=${parsed.overrides.agent}`
  );

  // Start loop if configured
  if (parsed.overrides.loop) {
    startLoop(
      sessionID,
      parsed.overrides.loop,
      "_inline_subtask_",
      prompt,
      parsed.overrides.model,
      parsed.overrides.agent,
      parsed.overrides.return
    );
    log(
      `inline subtask: started loop for "${parsed.overrides.loop.until}" max=${parsed.overrides.loop.max}`
    );
  }

  const client = getClient();

  // Register parent session for $TURN resolution (race-safe: keyed by prompt)
  registerPendingParentForPrompt(prompt, sessionID);

  // Register result capture if `as:` is specified
  if (parsed.overrides.as) {
    registerPendingResultCaptureByPrompt(
      prompt,
      sessionID,
      parsed.overrides.as
    );
    log(
      `executeInlineSubtask: registered result capture as "${parsed.overrides.as}"`
    );
  }

  // Build subtask parts array - main subtask first
  const parts: any[] = [
    {
      type: "subtask",
      agent: parsed.overrides.agent || "build",
      model,
      description: "Inline subtask",
      prompt,
    },
  ];

  // Add parallel subtasks if specified
  if (parsed.overrides.parallel?.length) {
    const parallelCommands = parsed.overrides.parallel
      .map(p => parseParallelItem(p))
      .filter((p): p is NonNullable<typeof p> => p !== null);

    if (parallelCommands.length) {
      const parallelParts = await flattenParallels(
        parallelCommands,
        "", // No main args for inline subtask parallels
        sessionID
      );
      for (const pp of parallelParts) {
        parts.push({
          type: "subtask",
          agent: pp.agent,
          model: pp.model,
          description: pp.description,
          prompt: pp.prompt,
          as: pp.as,
        });
        if (pp.as) {
          registerPendingResultCaptureByPrompt(pp.prompt, sessionID, pp.as);
        }
      }
      log(
        `executeInlineSubtask: added ${parallelParts.length} parallel subtasks`
      );
    }
  }

  // Execute as subtask via promptAsync
  try {
    log(
      `executeInlineSubtask: calling promptAsync for session ${sessionID} with ${parts.length} parts`
    );
    const result = await client.session.promptAsync({
      path: { id: sessionID },
      body: { parts },
    });
    log(
      `executeInlineSubtask: promptAsync returned: ${JSON.stringify(result)}`
    );
  } catch (err) {
    log(`executeInlineSubtask ERROR: ${err}`);
  }
}
