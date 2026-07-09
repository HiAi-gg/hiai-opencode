import { describe, expect, test } from "bun:test";
import { CLOSURE_SCHEMA_PROMPT, validateClosure } from "./closure";

describe("CLOSURE_SCHEMA_PROMPT", () => {
  test("contains Pre-CLOSURE Verification Checklist heading", () => {
    expect(CLOSURE_SCHEMA_PROMPT).toContain(
      "Pre-CLOSURE Verification Checklist",
    );
  });

  test("contains bun run lint in the checklist", () => {
    expect(CLOSURE_SCHEMA_PROMPT).toContain("bun run lint");
  });

  test("contains lsp_diagnostics in the checklist", () => {
    expect(CLOSURE_SCHEMA_PROMPT).toContain("lsp_diagnostics");
  });

  test("contains typecheck in the checklist", () => {
    expect(CLOSURE_SCHEMA_PROMPT).toContain("typecheck");
  });

  test("warns about CLOSURE rejection without evidence", () => {
    expect(CLOSURE_SCHEMA_PROMPT).toContain("REJECTED");
  });

  test("contains CLOSURE schema XML tags", () => {
    expect(CLOSURE_SCHEMA_PROMPT).toContain("<CLOSURE>");
    expect(CLOSURE_SCHEMA_PROMPT).toContain("</CLOSURE>");
  });

  test("mentions readiness values (done/accept/reject)", () => {
    expect(CLOSURE_SCHEMA_PROMPT).toContain('"done"');
    expect(CLOSURE_SCHEMA_PROMPT).toContain('"accept"');
    expect(CLOSURE_SCHEMA_PROMPT).toContain('"reject"');
  });
});

describe("validateClosure", () => {
  test("returns valid for correct CLOSURE block", () => {
    const result = validateClosure(`Some text
<CLOSURE>
{
  "reasoning": "Test completed",
  "evidence": ["test output"],
  "readiness": "done"
}
</CLOSURE>`);
    expect(result.isValid).toBe(true);
    expect(result.data?.reasoning).toBe("Test completed");
    expect(result.data?.readiness).toBe("done");
  });

  test("returns valid for accept readiness", () => {
    const result = validateClosure(`<CLOSURE>
{
  "reasoning": "Changes approved",
  "evidence": ["review OK"],
  "readiness": "accept"
}
</CLOSURE>`);
    expect(result.isValid).toBe(true);
    expect(result.data?.readiness).toBe("accept");
  });

  test("returns invalid when no CLOSURE block", () => {
    const result = validateClosure("Just some text without closure");
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("No CLOSURE block");
  });

  test("returns invalid for missing required fields", () => {
    const result = validateClosure(`<CLOSURE>
{
  "evidence": []
}
</CLOSURE>`);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("Missing required fields");
  });

  test("returns invalid for malformed JSON", () => {
    const result = validateClosure(`<CLOSURE>
{ not json }
</CLOSURE>`);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("Invalid JSON");
  });

  test("handles empty evidence array", () => {
    const result = validateClosure(`<CLOSURE>
{
  "reasoning": "Task done",
  "evidence": [],
  "readiness": "done"
}
</CLOSURE>`);
    expect(result.isValid).toBe(true);
  });

  test("handles multiple evidence items", () => {
    const result = validateClosure(`<CLOSURE>
{
  "reasoning": "All checks passed",
  "evidence": ["lint: exit 0", "typecheck: passed", "tests: passed"],
  "readiness": "done"
}
</CLOSURE>`);
    expect(result.isValid).toBe(true);
    expect(result.data?.evidence).toHaveLength(3);
  });

  test("rejects readiness must include reasoning", () => {
    const result = validateClosure(`<CLOSURE>
{
  "reasoning": "Implementation has issues",
  "evidence": ["lint errors found"],
  "readiness": "reject"
}
</CLOSURE>`);
    expect(result.isValid).toBe(true);
    expect(result.data?.readiness).toBe("reject");
  });
});
