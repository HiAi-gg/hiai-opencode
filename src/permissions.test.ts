/**
 * permissions.test.ts — Tests for per-agent permission resolution.
 *
 * Verifies:
 * - explore, plan, critic, build, general, manager, writer, designer
 *   get external_directory: 'allow' by default
 * - bob and vision do NOT get external_directory by default
 * - explicit agent_restrictions.<agent>.external_directory=false produces deny
 * - write/edit restrictions for explore/critic still apply
 * - Bob/Plan grep/glob/webfetch restrictions remain unchanged
 */

import { describe, expect, test, beforeAll } from "bun:test";
import { existsSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  applyAgentPermissions,
  getDefaultExternalDirectory,
  EXTERNAL_DIRECTORY_ALLOW_AGENTS,
} from "./permissions";

// ── getDefaultExternalDirectory ─────────────────────────────────────────────

describe("getDefaultExternalDirectory", () => {
  // All internal agents that do cross-project inspection get allow
  const shouldGetAllow = [
    "explore",
    "plan",
    "critic",
    "build",
    "general",
    "manager",
    "writer",
    "designer",
  ];
  // Bob delegates discovery to Explore; Vision is browser/multimodal only
  const shouldNotGetAllow = ["bob", "vision"];

  for (const agent of shouldGetAllow) {
    test(`${agent} → 'allow'`, () => {
      expect(getDefaultExternalDirectory(agent)).toBe("allow");
    });
  }

  for (const agent of shouldNotGetAllow) {
    test(`${agent} → undefined`, () => {
      expect(getDefaultExternalDirectory(agent)).toBeUndefined();
    });
  }

  test("EXTERNAL_DIRECTORY_ALLOW_AGENTS set is exactly 8 agents", () => {
    expect(EXTERNAL_DIRECTORY_ALLOW_AGENTS.size).toBe(8);
    for (const a of shouldGetAllow) {
      expect(EXTERNAL_DIRECTORY_ALLOW_AGENTS.has(a)).toBe(true);
    }
    // Bob and vision are explicitly excluded
    expect(EXTERNAL_DIRECTORY_ALLOW_AGENTS.has("bob")).toBe(false);
    expect(EXTERNAL_DIRECTORY_ALLOW_AGENTS.has("vision")).toBe(false);
  });
});

// ── applyAgentPermissions: default allow behavior ────────────────────────────

describe("applyAgentPermissions — default external_directory allow", () => {
  test("explore defaults: external_directory allow + write denied / edit denied", () => {
    const { permission, tools } = applyAgentPermissions(
      { write: false, edit: false },
      { firecrawl_search: true },
      { external_directory: "allow" },
    );
    expect(permission.external_directory).toBe("allow");
    expect(tools.write).toBe(false); // write → tools key
    expect(permission.edit).toBe("deny"); // edit → permission key
    expect(tools.firecrawl_search).toBe(true);
  });

  test("plan defaults: external_directory allow + bash/grep/glob/webfetch denied", () => {
    const { permission, tools } = applyAgentPermissions(
      { bash: false, grep: false, glob: false, webfetch: false },
      {},
      { external_directory: "allow" },
    );
    expect(permission.external_directory).toBe("allow");
    expect(permission.bash).toBe("deny");
    expect(tools.grep).toBe(false);
    expect(tools.glob).toBe(false);
    expect(permission.webfetch).toBe("deny");
  });

  test("critic defaults: external_directory allow + write denied / edit denied", () => {
    const { permission, tools } = applyAgentPermissions(
      { write: false, edit: false },
      {},
      { external_directory: "allow" },
    );
    expect(permission.external_directory).toBe("allow");
    expect(tools.write).toBe(false); // write → tools key
    expect(permission.edit).toBe("deny"); // edit → permission key
  });
});

// ── applyAgentPermissions: agents WITHOUT default allow ─────────────────────

describe("applyAgentPermissions — no external_directory by default", () => {
  test("bob/vision: no default external_directory, no restrictions", () => {
    for (const agent of ["bob", "vision"]) {
      const { permission, tools } = applyAgentPermissions(undefined, {});
      expect(permission.external_directory).toBeUndefined();
      expect(Object.keys(permission)).toHaveLength(0);
      expect(Object.keys(tools)).toHaveLength(0);
    }
  });

  test("general: when passed defaultPerms, gets external_directory", () => {
    // general IS in the allow set, so defaultPerms will include it
    const { permission, tools } = applyAgentPermissions(
      { task: false },
      {},
      { external_directory: "allow" },
    );
    expect(permission.external_directory).toBe("allow");
    expect(tools.task).toBe(false);
  });

  test("bob/vision: no external_directory even with allow default passed", () => {
    // This simulates what happens when getDefaultExternalDirectory returns
    // undefined for bob and vision — defaultPerms is empty
    for (const agent of ["bob", "vision"]) {
      const { permission } = applyAgentPermissions(undefined, {});
      expect(permission.external_directory).toBeUndefined();
    }
  });
});

// ── applyAgentPermissions: explicit deny overrides default ──────────────────

describe("applyAgentPermissions — explicit override", () => {
  test("agent_restrictions.explore.external_directory=false → deny", () => {
    const { permission } = applyAgentPermissions(
      { external_directory: false, write: false, edit: false },
      {},
      { external_directory: "allow" },
    );
    // Default says 'allow', but explicit restriction overrides to 'deny'
    expect(permission.external_directory).toBe("deny");
  });

  test("agent_restrictions.critic.external_directory=false → deny", () => {
    const { permission } = applyAgentPermissions(
      { external_directory: false, write: false, edit: false },
      {},
      { external_directory: "allow" },
    );
    expect(permission.external_directory).toBe("deny");
  });
});

// ── applyAgentPermissions: write/edit restrictions still apply ──────────────

describe("applyAgentPermissions — write/edit still restricted", () => {
  test("explore: write=false → tools, edit=false → permission", () => {
    const { permission, tools } = applyAgentPermissions(
      { write: false, edit: false },
      {},
      { external_directory: "allow" },
    );
    expect(tools.write).toBe(false); // write → tools key
    expect(permission.edit).toBe("deny"); // edit → permission key
  });

  test("critic: write=false → tools, edit=false → permission", () => {
    const { permission, tools } = applyAgentPermissions(
      { write: false, edit: false },
      {},
      { external_directory: "allow" },
    );
    expect(tools.write).toBe(false); // write → tools key
    expect(permission.edit).toBe("deny"); // edit → permission key
  });
});

// ── applyAgentPermissions: edge cases ───────────────────────────────────────

describe("applyAgentPermissions — edge cases", () => {
  test("empty restrictions produce empty results", () => {
    const { permission, tools } = applyAgentPermissions({});
    expect(Object.keys(permission)).toHaveLength(0);
    expect(Object.keys(tools)).toHaveLength(0);
  });

  test("undefined restrictions produce empty results", () => {
    const { permission, tools } = applyAgentPermissions(undefined);
    expect(Object.keys(permission)).toHaveLength(0);
    expect(Object.keys(tools)).toHaveLength(0);
  });

  test("extra tools are passed through", () => {
    const { tools } = applyAgentPermissions(undefined, {
      my_custom_tool: true,
    });
    expect(tools.my_custom_tool).toBe(true);
  });

  test("default permissions are set before restrictions override", () => {
    const { permission } = applyAgentPermissions(
      { external_directory: false },
      {},
      { external_directory: "allow", some_other: "allow" },
    );
    // some_other from defaults is kept (not overridden by restrictions)
    expect(permission.some_other).toBe("allow");
    // external_directory is overridden by restrictions
    expect(permission.external_directory).toBe("deny");
  });
});

// ── Config hook integration (end-to-end) ────────────────────────────────────

const TMP = join(tmpdir(), "hiai-opencode-permissions-e2e-test");

describe("config hook integration", () => {
  beforeAll(() => {
    if (existsSync(TMP)) rmSync(TMP, { recursive: true });
    mkdirSync(TMP, { recursive: true });
    // Write minimal bob.json with models so plugin loads cleanly
    writeFileSync(
      join(TMP, "bob.json"),
      JSON.stringify({
        models: {
          bob: { model: "test/test" },
          build: { model: "test/test" },
          plan: { model: "test/test" },
          manager: { model: "test/test" },
          critic: { model: "test/test" },
          designer: { model: "test/test" },
          explore: { model: "test/test" },
          writer: { model: "test/test" },
          vision: { model: "test/test" },
          general: { model: "test/test" },
        },
      }),
    );
  });

  test("explore gets external_directory allow via config hook", async () => {
    const hooks = await (await import("./index")).BobPlugin({ directory: TMP });
    const cfg: Record<string, unknown> = { agent: {} };
    await hooks.config?.(cfg as any);
    const agent = cfg.agent as Record<string, unknown>;
    const explore = agent.explore as Record<string, unknown>;
    expect(explore.permission).toBeDefined();
    expect(
      (explore.permission as Record<string, string>).external_directory,
    ).toBe("allow");
    await hooks.dispose?.();
  });

  test("plan gets external_directory allow via config hook", async () => {
    const hooks = await (await import("./index")).BobPlugin({ directory: TMP });
    const cfg: Record<string, unknown> = { agent: {} };
    await hooks.config?.(cfg as any);
    const agent = cfg.agent as Record<string, unknown>;
    const plan = agent.plan as Record<string, unknown>;
    expect(plan.permission).toBeDefined();
    expect((plan.permission as Record<string, string>).external_directory).toBe(
      "allow",
    );
    await hooks.dispose?.();
  });

  test("critic gets external_directory allow via config hook", async () => {
    const hooks = await (await import("./index")).BobPlugin({ directory: TMP });
    const cfg: Record<string, unknown> = { agent: {} };
    await hooks.config?.(cfg as any);
    const agent = cfg.agent as Record<string, unknown>;
    const critic = agent.critic as Record<string, unknown>;
    expect(critic.permission).toBeDefined();
    expect(
      (critic.permission as Record<string, string>).external_directory,
    ).toBe("allow");
    await hooks.dispose?.();
  });

  test("build gets external_directory allow via config hook (now in allow set)", async () => {
    const hooks = await (await import("./index")).BobPlugin({ directory: TMP });
    const cfg: Record<string, unknown> = { agent: {} };
    await hooks.config?.(cfg as any);
    const agent = cfg.agent as Record<string, unknown>;
    const build = agent.build as Record<string, unknown>;
    // build is now in EXTERNAL_DIRECTORY_ALLOW_AGENTS
    expect(build.permission).toBeDefined();
    expect(
      (build.permission as Record<string, string>).external_directory,
    ).toBe("allow");
    await hooks.dispose?.();
  });

  test("general gets external_directory allow via config hook", async () => {
    const hooks = await (await import("./index")).BobPlugin({ directory: TMP });
    const cfg: Record<string, unknown> = { agent: {} };
    await hooks.config?.(cfg as any);
    const agent = cfg.agent as Record<string, unknown>;
    const general = agent.general as Record<string, unknown>;
    expect(general.permission).toBeDefined();
    expect(
      (general.permission as Record<string, string>).external_directory,
    ).toBe("allow");
    await hooks.dispose?.();
  });

  test("manager gets external_directory allow via config hook", async () => {
    const hooks = await (await import("./index")).BobPlugin({ directory: TMP });
    const cfg: Record<string, unknown> = { agent: {} };
    await hooks.config?.(cfg as any);
    const agent = cfg.agent as Record<string, unknown>;
    const manager = agent.manager as Record<string, unknown>;
    expect(manager.permission).toBeDefined();
    expect(
      (manager.permission as Record<string, string>).external_directory,
    ).toBe("allow");
    await hooks.dispose?.();
  });

  test("designer gets external_directory allow via config hook", async () => {
    const hooks = await (await import("./index")).BobPlugin({ directory: TMP });
    const cfg: Record<string, unknown> = { agent: {} };
    await hooks.config?.(cfg as any);
    const agent = cfg.agent as Record<string, unknown>;
    const designer = agent.designer as Record<string, unknown>;
    expect(designer.permission).toBeDefined();
    expect(
      (designer.permission as Record<string, string>).external_directory,
    ).toBe("allow");
    await hooks.dispose?.();
  });

  test("writer gets external_directory allow via config hook", async () => {
    const hooks = await (await import("./index")).BobPlugin({ directory: TMP });
    const cfg: Record<string, unknown> = { agent: {} };
    await hooks.config?.(cfg as any);
    const agent = cfg.agent as Record<string, unknown>;
    const writer = agent.writer as Record<string, unknown>;
    expect(writer.permission).toBeDefined();
    expect(
      (writer.permission as Record<string, string>).external_directory,
    ).toBe("allow");
    await hooks.dispose?.();
  });

  test("bob does NOT get external_directory via config hook", async () => {
    const hooks = await (await import("./index")).BobPlugin({ directory: TMP });
    const cfg: Record<string, unknown> = { agent: {} };
    await hooks.config?.(cfg as any);
    const agent = cfg.agent as Record<string, unknown>;
    const bob = agent.bob as Record<string, unknown>;
    if (bob.permission) {
      expect(
        (bob.permission as Record<string, string>).external_directory,
      ).toBeUndefined();
    }
    await hooks.dispose?.();
  });

  test("vision does NOT get external_directory via config hook", async () => {
    const hooks = await (await import("./index")).BobPlugin({ directory: TMP });
    const cfg: Record<string, unknown> = { agent: {} };
    await hooks.config?.(cfg as any);
    const agent = cfg.agent as Record<string, unknown>;
    const vision = agent.vision as Record<string, unknown>;
    if (vision.permission) {
      expect(
        (vision.permission as Record<string, string>).external_directory,
      ).toBeUndefined();
    }
    await hooks.dispose?.();
  });

  test("Bob grep/glob restrictions remain unchanged", async () => {
    const hooks = await (await import("./index")).BobPlugin({ directory: TMP });
    const cfg: Record<string, unknown> = { agent: {} };
    await hooks.config?.(cfg as any);
    const agent = cfg.agent as Record<string, unknown>;
    const bob = agent.bob as Record<string, unknown>;
    expect(bob.tools).toBeDefined();
    expect((bob.tools as Record<string, boolean>).grep).toBe(false);
    expect((bob.tools as Record<string, boolean>).glob).toBe(false);
    await hooks.dispose?.();
  });

  test("Bob webfetch is denied", async () => {
    const hooks = await (await import("./index")).BobPlugin({ directory: TMP });
    const cfg: Record<string, unknown> = { agent: {} };
    await hooks.config?.(cfg as any);
    const agent = cfg.agent as Record<string, unknown>;
    const bob = agent.bob as Record<string, unknown>;
    expect(bob.permission).toBeDefined();
    expect((bob.permission as Record<string, string>).webfetch).toBe("deny");
    await hooks.dispose?.();
  });

  test("General webfetch is denied", async () => {
    const hooks = await (await import("./index")).BobPlugin({ directory: TMP });
    const cfg: Record<string, unknown> = { agent: {} };
    await hooks.config?.(cfg as any);
    const agent = cfg.agent as Record<string, unknown>;
    const general = agent.general as Record<string, unknown>;
    expect(general.permission).toBeDefined();
    expect((general.permission as Record<string, string>).webfetch).toBe(
      "deny",
    );
    await hooks.dispose?.();
  });

  test("Plan grep/glob/webfetch restrictions remain unchanged", async () => {
    const hooks = await (await import("./index")).BobPlugin({ directory: TMP });
    const cfg: Record<string, unknown> = { agent: {} };
    await hooks.config?.(cfg as any);
    const agent = cfg.agent as Record<string, unknown>;
    const plan = agent.plan as Record<string, unknown>;
    expect(plan.permission).toBeDefined();
    expect((plan.permission as Record<string, string>).bash).toBe("deny");
    expect((plan.tools as Record<string, boolean>).grep).toBe(false);
    expect((plan.tools as Record<string, boolean>).glob).toBe(false);
    expect((plan.permission as Record<string, string>).webfetch).toBe("deny");
    await hooks.dispose?.();
  });

  test("explore write/edit restrictions are still applied", async () => {
    const hooks = await (await import("./index")).BobPlugin({ directory: TMP });
    const cfg: Record<string, unknown> = { agent: {} };
    await hooks.config?.(cfg as any);
    const agent = cfg.agent as Record<string, unknown>;
    const explore = agent.explore as Record<string, unknown>;
    // explore has write:false → tools.write = false, edit:false → permission.edit = 'deny'
    expect(explore.tools).toBeDefined();
    expect((explore.tools as Record<string, boolean>).write).toBe(false);
    expect(explore.permission).toBeDefined();
    expect((explore.permission as Record<string, string>).edit).toBe("deny");
    await hooks.dispose?.();
  });

  test("critic write/edit restrictions are still applied", async () => {
    const hooks = await (await import("./index")).BobPlugin({ directory: TMP });
    const cfg: Record<string, unknown> = { agent: {} };
    await hooks.config?.(cfg as any);
    const agent = cfg.agent as Record<string, unknown>;
    const critic = agent.critic as Record<string, unknown>;
    // critic has write:false → tools.write = false, edit:false → permission.edit = 'deny'
    expect(critic.tools).toBeDefined();
    expect((critic.tools as Record<string, boolean>).write).toBe(false);
    expect(critic.permission).toBeDefined();
    expect((critic.permission as Record<string, string>).edit).toBe("deny");
    await hooks.dispose?.();
  });

  // ── Browser tool restrictions for Critic ────────────────────────────────────

  test("applyAgentPermissions maps agent_browser_screenshot:false to tools false", () => {
    const { tools } = applyAgentPermissions({ agent_browser_screenshot: false });
    expect(tools.agent_browser_screenshot).toBe(false);
  });

  test("applyAgentPermissions maps agent_browser_set_viewport:false to tools false", () => {
    const { tools } = applyAgentPermissions({ agent_browser_set_viewport: false });
    expect(tools.agent_browser_set_viewport).toBe(false);
  });

  test("Critic config no longer lists agent_browser_* restrictions (enforced by hard gate instead)", async () => {
    const hooks = await (await import("./index")).BobPlugin({ directory: TMP });
    const cfg: Record<string, unknown> = { agent: {} };
    await hooks.config?.(cfg as any);
    const agent = cfg.agent as Record<string, unknown>;
    const critic = agent.critic as Record<string, unknown>;
    // agent_browser_* entries were removed from critic restrictions in bob.json/DEFAULT_CONFIG
    // because the hard gate in src/tools/agent-browser/index.ts is now the runtime enforcement.
    // Config-level restrictions are no longer needed for browser tools.
    const browserTools = [
      'agent_browser_navigate',
      'agent_browser_snapshot',
      'agent_browser_click',
      'agent_browser_fill',
      'agent_browser_type',
      'agent_browser_screenshot',
      'agent_browser_eval',
      'agent_browser_wait',
      'agent_browser_close',
      'agent_browser_console',
      'agent_browser_select',
      'agent_browser_hover',
      'agent_browser_press',
      'agent_browser_batch',
      'agent_browser_set_viewport',
      'agent_browser_set_device',
    ];
    for (const bt of browserTools) {
      // Config no longer explicitly disables these — hard gate blocks at tool.execute() instead
      expect(critic.tools && (critic.tools as Record<string, boolean>)[bt]).toBeUndefined();
    }
    await hooks.dispose?.();
  });

  test("Critic still has task delegation enabled (task not disabled)", async () => {
    const hooks = await (await import("./index")).BobPlugin({ directory: TMP });
    const cfg: Record<string, unknown> = { agent: {} };
    await hooks.config?.(cfg as any);
    const agent = cfg.agent as Record<string, unknown>;
    const critic = agent.critic as Record<string, unknown>;
    expect(critic.tools).toBeDefined();
    const tools = critic.tools as Record<string, boolean>;
    // task must NOT be disabled — critic needs to delegate Vision/Explore
    expect(tools.task).not.toBe(false);
    await hooks.dispose?.();
  });

  // ── Explore webfetch restriction ─────────────────────────────────────────────

  test("Explore config has webfetch denied", async () => {
    const hooks = await (await import("./index")).BobPlugin({ directory: TMP });
    const cfg: Record<string, unknown> = { agent: {} };
    await hooks.config?.(cfg as any);
    const agent = cfg.agent as Record<string, unknown>;
    const explore = agent.explore as Record<string, unknown>;
    expect(explore.permission).toBeDefined();
    expect((explore.permission as Record<string, string>).webfetch).toBe("deny");
    await hooks.dispose?.();
  });
});
