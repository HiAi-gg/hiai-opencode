import { describe, expect, test } from "bun:test";
import {
  applyPromptOverride,
  createAllAgents,
  resolveAgentModel,
} from "./index";

describe("agent bob.json overrides", () => {
  test("appends prompt_append to the final agent prompt", () => {
    const config = {
      agent_overrides: {
        bob: { prompt_append: "Always report the verification command." },
      },
    };
    const bob = createAllAgents(config).find((agent) => agent.key === "bob");

    expect(bob?.config.prompt).toContain(
      "Always report the verification command.",
    );
  });

  test("applies model overrides to native and regular agent slots", () => {
    const config = {
      models: { bob: { model: "provider/default" } },
      agent_overrides: {
        bob: { model: "provider/override" },
        build: { model: "provider/build-override" },
      },
    };

    expect(resolveAgentModel("bob", config)).toBe("provider/override");
    expect(resolveAgentModel("build", config)).toBe("provider/build-override");
  });

  test("does not add an empty prompt suffix", () => {
    expect(
      applyPromptOverride("bob", "base prompt", {
        agent_overrides: { bob: { prompt_append: "  " } },
      }),
    ).toBe("base prompt");
  });
});
