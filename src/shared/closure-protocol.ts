/**
 * Shared Closure Protocol for HiaiOpenCode.
 * All agents MUST wrap their final response in a <CLOSURE> block.
 */

export interface ClosureBlock {
  reasoning: string;
  evidence: string[];
  readiness: "accept" | "reject" | "done";
}

export const CLOSURE_SCHEMA_PROMPT = `
<CLOSURE_PROTOCOL>
## Mandatory Task Finalization

You MUST end your final response with a structured <CLOSURE> block. This block serves as your formal "end of contour" and provides the evidence required for the Guard agent to accept your work.

### Schema:
\`\`\`xml
<CLOSURE>
{
  "reasoning": "Concise summary of what was achieved and why it satisfies the request.",
  "evidence": ["Link to test results", "File path to changes", "Log snippets", "LSP diagnostics clean"],
  "readiness": "done" | "accept" | "reject"
}
</CLOSURE>
\`\`\`

### Readiness mapping:
- "done": Task completed successfully.
- "accept": (Reviewer mode) The proposed changes are approved.
- "reject": (Reviewer mode) The proposed changes are denied with feedback.

**WARNING**: Responses without a valid <CLOSURE> block will be automatically REJECTED by the Guard system.
</CLOSURE_PROTOCOL>
`;

export function validateClosure(text: string): { isValid: boolean; error?: string; data?: ClosureBlock } {
  const match = text.match(/<CLOSURE>\s*([\s\S]*?)\s*<\/CLOSURE>/i);
  if (!match) {
    return { isValid: false, error: "Missing mandatory <CLOSURE> block." };
  }

  try {
    const data = JSON.parse(match[1]) as ClosureBlock;
    if (!data.reasoning || !data.evidence || !data.readiness) {
      return { isValid: false, error: "Invalid <CLOSURE> schema: missing reasoning, evidence, or readiness fields." };
    }
    return { isValid: true, data };
  } catch (e) {
    return { isValid: false, error: "Malformed <CLOSURE> block: must be a valid JSON object." };
  }
}
