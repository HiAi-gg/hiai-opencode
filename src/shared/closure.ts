export const CLOSURE_SCHEMA_PROMPT = `
<CLOSURE_PROTOCOL>
## Mandatory Task Finalization

You MUST end your final response with a structured <CLOSURE> block.

### Schema:
\`\`\`xml
<CLOSURE>
{
  "reasoning": "Concise summary of what was achieved.",
  "evidence": ["Link to test results", "File path to changes"],
  "readiness": "done" | "accept" | "reject"
}
</CLOSURE>
\`\`\`

- "done": Task completed successfully.
- "accept": (Reviewer) Changes approved.
- "reject": (Reviewer) Changes denied with feedback.

**WARNING**: Responses without a valid <CLOSURE> block will be automatically REJECTED.

## Pre-CLOSURE Verification Checklist (code/config/doc changes)
Before emitting CLOSURE after changing code, config, or docs, verify:
1. \`bun run lint\` exits 0 on every changed file
2. \`lsp_diagnostics\` shows zero errors on changed files
3. \`bun run typecheck\` passes (if TypeScript)
4. Build passes (if applicable)
If any check fails → FIX first, then emit CLOSURE with evidence of passing checks.
If you cannot run a check → state why in CLOSURE.evidence.
Absent passing lint+typecheck evidence → CLOSURE will be REJECTED.
</CLOSURE_PROTOCOL>
`;

const VALID_READINESS = new Set(["done", "accept", "reject"]);

export function validateClosure(text: string): {
  isValid: boolean;
  error?: string;
  data?: { reasoning: string; evidence: string[]; readiness: string };
} {
  const match = text.match(/<CLOSURE>([\s\S]*?)<\/CLOSURE>/);
  if (!match) return { isValid: false, error: "No CLOSURE block found" };
  try {
    const data = JSON.parse(match[1].trim());
    if (!data.reasoning || !data.readiness)
      return {
        isValid: false,
        error: "Missing required fields (reasoning, readiness)",
      };
    if (
      typeof data.readiness !== "string" ||
      !VALID_READINESS.has(data.readiness)
    ) {
      return {
        isValid: false,
        error: `Invalid readiness "${data.readiness}" — must be one of: done, accept, reject`,
      };
    }
    if (!Array.isArray(data.evidence)) {
      // evidence is optional in spirit but the schema declares an array;
      // coerce missing/Non-array to [] rather than rejecting outright.
      data.evidence = [];
    }
    return { isValid: true, data };
  } catch {
    return { isValid: false, error: "Invalid JSON in CLOSURE block" };
  }
}
