import type { ParallelCommand, SubtaskPart } from "../types";
import { getPipedArgsQueue } from "../core/state";
import { loadCommandFile } from "../commands/loader";
import { log } from "../utils/logger";
import {
  parseFrontmatter,
  getTemplateBody,
  parseParallelConfig,
  hasTurnReferences,
} from "../parsing";
import { resolveTurnReferences } from "./turns";

/**
 * Feature: Parallel command execution
 * Flattens nested parallel commands into a flat list of subtask parts
 */

export async function flattenParallels(
  parallels: ParallelCommand[],
  mainArgs: string,
  sessionID: string,
  visited: Set<string> = new Set(),
  depth: number = 0,
  maxDepth: number = 5
): Promise<SubtaskPart[]> {
  if (depth > maxDepth) return [];

  const queue = getPipedArgsQueue(sessionID) ?? [];
  log(`flattenParallels called:`, {
    depth,
    parallels: parallels.map(
      p => `${p.command}${p.arguments ? ` (args: ${p.arguments})` : ""}`
    ),
    mainArgs,
    queueRemaining: [...queue],
  });

  const parts: SubtaskPart[] = [];

  for (let i = 0; i < parallels.length; i++) {
    const parallelCmd = parallels[i];

    if (parallelCmd.inline) {
      let prompt = parallelCmd.prompt ?? parallelCmd.arguments ?? "";
      if (hasTurnReferences(prompt)) {
        prompt = await resolveTurnReferences(prompt, sessionID);
      }

      let model: { providerID: string; modelID: string } | undefined;
      const modelStr = parallelCmd.model;
      if (modelStr && modelStr.includes("/")) {
        const [providerID, ...rest] = modelStr.split("/");
        model = { providerID, modelID: rest.join("/") };
      }

      parts.push({
        type: "subtask" as const,
        agent: parallelCmd.agent || "build",
        model,
        description: "Inline parallel subtask",
        command: "_inline_subtask_",
        prompt,
        as: parallelCmd.as,
      });
      continue;
    }

    // Mark command as visited BEFORE loading to prevent its nested parallels
    // from re-adding the same command. This prevents self-referential parallels
    // (e.g., /parallel.md has parallel: [/parallel, /parallel]) from duplicating.
    // Note: We still process ALL items in the user's explicit list (no filtering here),
    // the visited set only affects nested parallel expansion.
    visited.add(parallelCmd.command);

    const cmdFile = await loadCommandFile(parallelCmd.command);
    if (!cmdFile) continue;

    const fm = parseFrontmatter(cmdFile.content);
    let template = getTemplateBody(cmdFile.content);

    // Priority: piped arg (from queue) > frontmatter args > main args
    const pipeArg = queue.shift();
    const args = pipeArg ?? parallelCmd.arguments ?? mainArgs;
    log(
      `Parallel ${parallelCmd.command}: using args="${args}" (pipeArg=${pipeArg}, fmArg=${parallelCmd.arguments}, mainArgs=${mainArgs})`
    );
    template = template.replace(/\$ARGUMENTS/g, args);

    // Resolve $TURN[n] references in the template
    if (hasTurnReferences(template)) {
      template = await resolveTurnReferences(template, sessionID);
      log(`Parallel ${parallelCmd.command}: resolved $TURN refs`);
    }

    // Parse model string "provider/model" into {providerID, modelID}
    // Priority: inline override (parallelCmd.model) > frontmatter (fm.model)
    let model: { providerID: string; modelID: string } | undefined;
    const modelStr =
      parallelCmd.model ||
      (typeof fm.model === "string" ? fm.model : undefined);
    if (modelStr && modelStr.includes("/")) {
      const [providerID, ...rest] = modelStr.split("/");
      model = { providerID, modelID: rest.join("/") };
    }

    parts.push({
      type: "subtask" as const,
      agent: parallelCmd.agent || (fm.agent as string) || "general",
      model,
      description:
        (fm.description as string) || `Parallel: ${parallelCmd.command}`,
      command: parallelCmd.command,
      prompt: template,
      as: parallelCmd.as,
    });

    // Recursively flatten nested parallels (with cycle detection)
    const nestedParallel = fm.parallel;
    if (nestedParallel) {
      const nestedArr = parseParallelConfig(nestedParallel);

      if (nestedArr.length) {
        // Filter out commands already in visited (cycle detection)
        const filteredNested = nestedArr.filter(nested => {
          if (!nested.inline && visited.has(nested.command)) {
            log(`Skipping nested parallel ${nested.command}: already visited`);
            return false;
          }
          return true;
        });

        if (filteredNested.length) {
          const nestedParts = await flattenParallels(
            filteredNested,
            args,
            sessionID,
            visited,
            depth + 1,
            maxDepth
          );
          parts.push(...nestedParts);
        }
      }
    }
  }

  return parts;
}
