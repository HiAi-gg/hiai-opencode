/**
 * config-caveman.test.ts — Tests for caveman config defaults.
 *
 * Verifies:
 * - writer is NOT in caveman.target_agents
 * - writer IS in caveman.exclude_agents
 * - vision IS in caveman.exclude_agents
 * - Bob still gets all 3 fragments (bob_internal, bob_to_agents, decode boundary)
 * - Target agents (explore, build, general, critic, designer, manager) still get injection
 */

import { describe, expect, test } from "bun:test";
import { DEFAULT_CONFIG } from "./config";

describe("caveman config defaults", () => {
  const caveman = DEFAULT_CONFIG.caveman;

  test("writer is NOT in target_agents", () => {
    expect(caveman.target_agents).not.toContain("writer");
  });

  test("writer IS in exclude_agents", () => {
    expect(caveman.exclude_agents).toContain("writer");
  });

  test("vision IS in exclude_agents", () => {
    expect(caveman.exclude_agents).toContain("vision");
  });

  test("exclude_agents contains exactly vision and writer", () => {
    expect(caveman.exclude_agents).toEqual(["vision", "writer"]);
  });

  test("target_agents contains bob", () => {
    expect(caveman.target_agents).toContain("bob");
  });

  test("target_agents contains explore, build, general, critic, designer, manager", () => {
    const expected = [
      "explore",
      "build",
      "general",
      "critic",
      "designer",
      "manager",
    ];
    for (const agent of expected) {
      expect(caveman.target_agents).toContain(agent);
    }
  });

  test("target_agents has exactly 7 agents", () => {
    expect(caveman.target_agents).toHaveLength(7);
  });

  test("bob_internal is true", () => {
    expect(caveman.bob_internal).toBe(true);
  });

  test("bob_to_agents is true", () => {
    expect(caveman.bob_to_agents).toBe(true);
  });

  test("agents_to_bob is true", () => {
    expect(caveman.agents_to_bob).toBe(true);
  });

  test("final_user_output is normal", () => {
    expect(caveman.final_user_output).toBe("normal");
  });
});
