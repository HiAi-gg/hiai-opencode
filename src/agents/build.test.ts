import { describe, expect, test } from "bun:test";
import { BUILD_PROMPT } from "./build";

describe("BUILD_PROMPT lint gate", () => {
  test("lint is mandatory before completion", () => {
    expect(BUILD_PROMPT).toContain("MANDATORY before completion");
  });

  test("bun run lint exit 0 required", () => {
    expect(BUILD_PROMPT).toContain("bun run lint");
  });

  test("oxlint is mentioned as linter", () => {
    expect(BUILD_PROMPT).toContain("oxlint");
  });

  test("lsp_diagnostics verification is present", () => {
    expect(BUILD_PROMPT).toContain("lsp_diagnostics");
  });

  test("NO EVIDENCE = NOT COMPLETE rule present", () => {
    expect(BUILD_PROMPT).toContain("NO EVIDENCE = NOT COMPLETE");
  });

  test("no template literal artifacts", () => {
    expect(BUILD_PROMPT).not.toMatch(/\$\{/);
  });

  test("contains CLOSURE schema", () => {
    expect(BUILD_PROMPT).toContain("<CLOSURE>");
  });

  test("planned-step mode forbids spawning Plan or Critic", () => {
    expect(BUILD_PROMPT).toContain("planned-step");
    expect(BUILD_PROMPT).toContain("Do not spawn Plan");
    expect(BUILD_PROMPT).toContain("Do not spawn Critic");
    expect(BUILD_PROMPT).not.toContain("Complex → MUST delegate");
  });

  test("is a browser leaf and keeps the alternate-stack ban in system prompt", () => {
    expect(BUILD_PROMPT).toContain("cannot spawn Vision");
    expect(BUILD_PROMPT).not.toContain('task({subagent_type: "vision"');
    expect(BUILD_PROMPT).toMatch(/Playwright/i);
  });
});
