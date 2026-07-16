import { describe, expect, test } from "bun:test";
import { BOB_PROMPT } from "./bob";

describe("BOB_PROMPT", () => {
  test("contains Subagent Handoff Protocol section", () => {
    expect(BOB_PROMPT).toContain("Subagent Handoff Protocol");
  });

  test("contains Result Envelope format", () => {
    expect(BOB_PROMPT).toContain("**Status:**");
    expect(BOB_PROMPT).toContain("**Summary:**");
    expect(BOB_PROMPT).toContain("**Evidence:**");
    expect(BOB_PROMPT).toContain("**Files touched:**");
  });

  test("instructs Bob to parse, consume, and synthesize", () => {
    expect(BOB_PROMPT).toContain("Parse the envelope");
    expect(BOB_PROMPT).toContain("Consume and synthesize");
  });

  test("forbids copy-pasting raw subagent output", () => {
    expect(BOB_PROMPT).toContain("Copy-paste the raw subagent output verbatim");
  });

  test("forbids leaking envelope labels to user", () => {
    expect(BOB_PROMPT).toContain("envelope labels");
  });

  test("requires Bob to emit his own CLOSURE", () => {
    expect(BOB_PROMPT).toContain("Emit your own CLOSURE");
  });

  test("contains Plan Delegation Note", () => {
    expect(BOB_PROMPT).toContain("Plan Delegation Note");
  });

  test("no template literal artifacts", () => {
    expect(BOB_PROMPT).not.toMatch(/\$\{/);
  });

  // --- Plan Execution Handoff tests ---

  test("contains Plan Execution Handoff section", () => {
    expect(BOB_PROMPT).toContain("Plan Execution Handoff");
  });

  test("contains Execution Graph Extract instructions", () => {
    expect(BOB_PROMPT).toContain("Execution Graph Extract");
  });

  test("describes direct and manager-group dispatch modes", () => {
    expect(BOB_PROMPT).toContain("Six or more workers");
    expect(BOB_PROMPT).toContain("6 = 5+1");
  });

  test("instructs Manager slices rather than whole-plan delegation", () => {
    expect(BOB_PROMPT).toContain("only the group's plan slice");
  });

  test("says Bob does not read .bob/plans/ directly", () => {
    expect(BOB_PROMPT).toContain("does NOT read plan files from disk");
    expect(BOB_PROMPT).toContain("Result Envelope deliverable body text");
  });

  test("maps owner directly to subagent_type", () => {
    expect(BOB_PROMPT).toContain("Map every step's");
    expect(BOB_PROMPT).toContain("owner");
    expect(BOB_PROMPT).toContain("subagent_type");
  });

  test("flags missing owner/parallel as plan quality issue", () => {
    expect(BOB_PROMPT).toContain("flag it as a plan quality issue");
  });

  test("mentions chain plans for research-first", () => {
    expect(BOB_PROMPT).toContain("Chain plans");
  });
});
