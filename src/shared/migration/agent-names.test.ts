import { describe, expect, test } from "bun:test";
import {
  AGENT_NAME_MAP,
  BUILTIN_AGENT_NAMES,
  migrateAgentNames,
} from "./agent-names";

describe("AGENT_NAME_MAP", () => {
  test("multimodal resolves to vision", () => {
    expect(AGENT_NAME_MAP.multimodal).toBe("vision");
  });

  test("vision resolves to vision (identity)", () => {
    expect(AGENT_NAME_MAP.vision).toBe("vision");
  });

  test("multimodal-looker resolves to vision", () => {
    expect(AGENT_NAME_MAP["multimodal-looker"]).toBe("vision");
  });

  test("ui resolves to vision", () => {
    expect(AGENT_NAME_MAP.ui).toBe("vision");
  });

  test("roundtrip: vision → vision (stable)", () => {
    const result1 = AGENT_NAME_MAP.vision;
    const result2 = AGENT_NAME_MAP[result1];
    expect(result2).toBe("vision");
  });
});

describe("migrateAgentNames", () => {
  test("multimodal key migrates to vision", () => {
    const result = migrateAgentNames({ multimodal: { model: "gpt-4-vision" } });
    expect(result.migrated.vision).toBeDefined();
    expect(result.changed).toBe(true);
  });

  test("vision key passes through unchanged (already canonical)", () => {
    const result = migrateAgentNames({ vision: { model: "gpt-4-vision" } });
    expect(result.migrated.vision).toBeDefined();
    expect(result.changed).toBe(false);
  });

  test("canonical keys pass through unchanged", () => {
    for (const key of [
      "bob",
      "coder",
      "strategist",
      "critic",
      "designer",
      "researcher",
      "writer",
      "manager",
      "vision",
    ]) {
      const result = migrateAgentNames({ [key]: {} });
      expect(result.migrated[key]).toBeDefined();
      expect(result.changed).toBe(false);
    }
  });
});

describe("BUILTIN_AGENT_NAMES", () => {
  test("contains vision and not multimodal (consolidated)", () => {
    expect(BUILTIN_AGENT_NAMES.has("vision")).toBe(true);
    expect(BUILTIN_AGENT_NAMES.has("multimodal")).toBe(false);
  });
});
