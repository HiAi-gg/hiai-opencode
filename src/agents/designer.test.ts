import { describe, expect, test } from "bun:test";
import { DESIGNER_PROMPT } from "./designer";

describe("DESIGNER_PROMPT", () => {
  test("contains Visual Architect identity", () => {
    expect(DESIGNER_PROMPT).toContain("Visual Architect");
  });

  test("contains design system directive", () => {
    expect(DESIGNER_PROMPT).toContain("Design Systems");
    expect(DESIGNER_PROMPT).toContain("design-systems/");
  });

  test("contains spec-not-implement directive", () => {
    expect(DESIGNER_PROMPT).toContain("Spec, don't implement");
  });

  test("contains Vision verification gate", () => {
    expect(DESIGNER_PROMPT).toContain("Self-Review Gate");
    expect(DESIGNER_PROMPT).toContain("Vision");
  });

  test("contains anti-generic check rules", () => {
    expect(DESIGNER_PROMPT).toContain("Anti-Generic");
  });

  test("instructs to emit concrete design tokens", () => {
    expect(DESIGNER_PROMPT).toContain("design tokens");
    expect(DESIGNER_PROMPT).toContain("component inventory");
  });

  test("contains the 5-step design process", () => {
    expect(DESIGNER_PROMPT).toContain("1. **Understand**");
    expect(DESIGNER_PROMPT).toContain("2. **Research**");
    expect(DESIGNER_PROMPT).toContain("3. **Design**");
    expect(DESIGNER_PROMPT).toContain("4. **Specify**");
    expect(DESIGNER_PROMPT).toContain("5. **Review**");
  });

  test("references browser-via-vision pattern", () => {
    expect(DESIGNER_PROMPT).toContain("Vision");
    expect(DESIGNER_PROMPT).toContain("browser");
  });

  test("contains CLOSURE schema", () => {
    expect(DESIGNER_PROMPT).toContain("<CLOSURE>");
    expect(DESIGNER_PROMPT).toContain("readiness");
  });

  test("references context7 for library docs", () => {
    expect(DESIGNER_PROMPT).toContain("context7");
  });

  test("specifies output format sections", () => {
    expect(DESIGNER_PROMPT).toContain("## Layout");
    expect(DESIGNER_PROMPT).toContain("## Components");
    expect(DESIGNER_PROMPT).toContain("## Design Tokens");
  });

  test("contains BEM/flex/grid vocabulary", () => {
    expect(DESIGNER_PROMPT).toContain("grid");
    expect(DESIGNER_PROMPT).toContain("flex");
  });

  test("explicitly says Designer does not implement CSS/HTML", () => {
    expect(DESIGNER_PROMPT).toContain("you don't implement CSS");
  });
});
