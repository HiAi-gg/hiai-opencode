import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PLAN_PROMPT } from "./plan";

function readSkill(relativePath: string): string {
  return readFileSync(
    join(import.meta.dir, "..", "..", "skills", relativePath),
    "utf-8",
  );
}

describe("PLAN_PROMPT", () => {
  test("contains Result Delivery section", () => {
    expect(PLAN_PROMPT).toContain("Result Delivery");
  });

  test("contains Result Envelope format", () => {
    expect(PLAN_PROMPT).toContain("**Status:**");
    expect(PLAN_PROMPT).toContain("**Summary:**");
    expect(PLAN_PROMPT).toContain("**Evidence:**");
    expect(PLAN_PROMPT).toContain("**Files touched:**");
  });

  test("mentions done/partial/failed/blocked status values", () => {
    expect(PLAN_PROMPT).toContain("done");
    expect(PLAN_PROMPT).toContain("blocked");
    expect(PLAN_PROMPT).toContain("failed");
  });

  test("forbids raw Thinking/Reasoning between deliverable and CLOSURE", () => {
    expect(PLAN_PROMPT).toContain("No raw Thinking/Reasoning");
  });

  test("mentions Bob synthesizes for the user", () => {
    expect(PLAN_PROMPT).toContain("Bob synthesizes");
  });

  test("no template literal artifacts", () => {
    expect(PLAN_PROMPT).not.toMatch(/\$\{/);
  });

  // --- Phase/owner/parallel annotation tests ---

  test("contains Allowed Owner → Subagent Type Mapping section", () => {
    expect(PLAN_PROMPT).toContain("Allowed Owner");
    expect(PLAN_PROMPT).toContain("Subagent Type Mapping");
  });

  test("lists all valid owner→subagent_type mappings", () => {
    const owners = [
      "explore",
      "plan",
      "build",
      "general",
      "critic",
      "designer",
      "writer",
      "vision",
    ];
    for (const owner of owners) {
      expect(PLAN_PROMPT).toContain(`\`${owner}\``);
    }
  });

  test("forbids owners not in the allowed list", () => {
    expect(PLAN_PROMPT).toContain("NEVER assign an owner not in this list");
  });

  test("requires manager-ready groups of at most five", () => {
    expect(PLAN_PROMPT).toContain("manager-ready groups");
    expect(PLAN_PROMPT).toContain("at most 5");
  });

  test("requires plan file path in Evidence section", () => {
    expect(PLAN_PROMPT).toContain("plan file path");
  });

  test("requires full plan text in deliverable body", () => {
    expect(PLAN_PROMPT).toContain(
      "ALWAYS include it here even if you also saved to .bob/plans/",
    );
  });

  test("mentions PHASE-BASED EXECUTION GRAPH", () => {
    expect(PLAN_PROMPT).toContain("PHASE-BASED");
    expect(PLAN_PROMPT).toContain("EXECUTION GRAPH");
  });

  test("every step must state owner + parallel + deps + files + risk", () => {
    expect(PLAN_PROMPT).toContain("owner + parallel");
    expect(PLAN_PROMPT).toContain("deps + files + risk");
  });

  test("says Bob/Manager dispatch directly off annotations", () => {
    expect(PLAN_PROMPT).toContain("Bob/Manager dispatch");
  });

  // --- Autonomy Contract / question tool tests ---

  test("autonomy is the default (AUTONOMY > ASSUMPTION > HUMAN QUESTION)", () => {
    expect(PLAN_PROMPT).toContain("AUTONOMY > ASSUMPTION > HUMAN QUESTION");
    expect(PLAN_PROMPT).toContain("autonomous by default");
  });

  test("requires the built-in question tool for permitted questions", () => {
    expect(PLAN_PROMPT).toContain("`question` tool");
    expect(PLAN_PROMPT).toContain("Native question tool");
  });

  test("forbids plain-text user-facing questions when question is available", () => {
    expect(PLAN_PROMPT).toContain("NEVER print such a question");
    expect(PLAN_PROMPT).toContain("ordinary assistant text");
  });

  test("forbids user questioning when invoked as a subagent", () => {
    expect(PLAN_PROMPT).toContain("invoked as a subagent by Bob/Manager/task");
    expect(PLAN_PROMPT).toContain("USER QUESTIONING IS FORBIDDEN");
  });

  test("requires research before asking", () => {
    expect(PLAN_PROMPT).toContain("Research it first");
    expect(PLAN_PROMPT).toContain("Can Explore answer this?");
  });

  test("requires autonomous resolution when no material ambiguity remains", () => {
    expect(PLAN_PROMPT).toContain("Decide autonomously");
    expect(PLAN_PROMPT).toContain("Uncertainty is not blocking");
  });

  test("bans ceremonial confirmation questions", () => {
    expect(PLAN_PROMPT).toContain("Never ask");
    expect(PLAN_PROMPT).toContain("Approve this plan?");
  });

  test("has a fallback when question tool is unavailable", () => {
    expect(PLAN_PROMPT).toContain("genuinely unavailable");
    expect(PLAN_PROMPT).toContain("minimum blocking question");
  });

  test("interview is explicit opt-in only", () => {
    expect(PLAN_PROMPT).toContain("EXPLICITLY requests an interview");
    expect(PLAN_PROMPT).toContain("interview-me");
  });
});

// --- Plan-owned skills: question-tool contract ---

describe("plan skills — native question tool contract", () => {
  test("interview-me is explicit opt-in and uses the question tool", () => {
    const skill = readSkill("plan/interview-me/SKILL.md");
    expect(skill).toContain("EXPLICIT-OPT-IN");
    expect(skill).toContain("native `question` tool");
    expect(skill).toContain(
      "Never print the interview question as ordinary assistant text",
    );
    // must not auto-activate from underspecified requirements
    expect(skill).toContain(
      "must NOT activate merely because requirements are underspecified",
    );
    expect(skill).toContain("autonomous Bob/Manager execution loop");
  });

  test("spec-driven-development removed plain-text assumption-confirmation patterns", () => {
    const skill = readSkill("plan/spec-driven-development/SKILL.md");
    expect(skill).not.toContain("Correct me now or I'll proceed");
    expect(skill).not.toContain("Are these the right targets?");
    expect(skill).toContain("native `question` tool");
  });

  test("writing-plans removed plain-text 'Which approach?' question", () => {
    const skill = readSkill("plan/writing-plans/SKILL.md");
    expect(skill).not.toContain("Which approach?");
    expect(skill).toContain("native `question` tool");
  });

  test("plan/SKILL.md no longer routes unclear requirements straight to interview-me", () => {
    const skill = readSkill("plan/SKILL.md");
    expect(skill).not.toContain("use `interview-me` first");
    expect(skill).toContain("resolve autonomously first");
  });
});
