import { describe, expect, test } from "bun:test";

import { buildSaveChecklist } from "../../../src/agents/prompt-library/mempalace-taxonomy";

describe("buildSaveChecklist", () => {
  test("returns a non-empty string", () => {
    const result = buildSaveChecklist();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("contains expected section markers", () => {
    const result = buildSaveChecklist();
    expect(result).toContain("Save to MemPalace");
    expect(result).toContain("mempalace_diary_write");
    expect(result).toContain("Do NOT save");
  });

  test("output is deterministic across multiple calls", () => {
    const first = buildSaveChecklist();
    const second = buildSaveChecklist();
    const third = buildSaveChecklist();
    expect(second).toBe(first);
    expect(third).toBe(first);
  });
});
