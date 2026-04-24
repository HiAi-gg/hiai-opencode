/**
 * Parse auto workflow output from LLM response (POC)
 */

export interface AutoWorkflowResult {
  found: boolean;
  command?: string; // The full /subtask {...} command
}

/**
 * Extract the workflow command from <subtask2 auto="true">...</subtask2> tags
 */
export function parseAutoWorkflowOutput(text: string): AutoWorkflowResult {
  const regex =
    /<subtask2\s+auto\s*=\s*["']?true["']?\s*>([\s\S]*?)<\/subtask2>/i;
  const match = text.match(regex);

  if (!match || !match[1]) {
    return { found: false };
  }

  const content = match[1].trim();

  // Validate it starts with /subtask
  if (!content.toLowerCase().startsWith("/subtask")) {
    return { found: false };
  }

  return {
    found: true,
    command: content,
  };
}
