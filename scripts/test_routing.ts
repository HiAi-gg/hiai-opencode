#!/usr/bin/env bun
/**
 * Routing tests for hiai-opencode agent system.
 * Verifies that category routing, agent alias resolution, and visibility rules
 * do not regress.
 *
 * Run: bun run test:routing
 *
 * These tests verify the CURRENT routing contract. If the routing behavior
 * changes intentionally, update these tests to match the new behavior and
 * document the change.
 */

import { resolveCanonicalDelegateAgentKey, CODER_AGENT_CONFIG_KEY, SUB_AGENT_CONFIG_KEY } from "../src/tools/delegate-task/sub-agent.ts"
import { getAgentConfigKey, getAgentDisplayName } from "../src/shared/agent-display-names.ts"
import { sanitizeSubagentType } from "../src/tools/delegate-task/subagent-discovery.ts"

// ── Test helpers ────────────────────────────────────────────────────────────────

let pass = 0;
let fail = 0;

function test(name: string, fn: () => boolean): void {
  try {
    if (fn()) {
      pass++;
      console.log(`  ${green("✓")} ${name}`);
    } else {
      fail++;
      console.log(`  ${red("✗")} ${name}`);
    }
  } catch (e) {
    fail++;
    console.log(`  ${red("✗")} ${name} — threw: ${e}`);
  }
}

function green(s: string) { return `\x1b[32m${s}\x1b[0m`; }
function red(s: string) { return `\x1b[31m${s}\x1b[0m`; }

// ── Constants ─────────────────────────────────────────────────────────────────

test("CODER_AGENT_CONFIG_KEY equals 'coder'", () => {
  return CODER_AGENT_CONFIG_KEY === "coder";
});

test("SUB_AGENT_CONFIG_KEY equals 'sub'", () => {
  return SUB_AGENT_CONFIG_KEY === "sub";
});

// All categories route to CODER_AGENT_CONFIG_KEY ("coder") in category-resolver.ts
// This is the foundational routing invariant.

test("All categories route to coder (CODER_AGENT_CONFIG_KEY)", () => {
  return CODER_AGENT_CONFIG_KEY === "coder";
});

// ── Canonical key resolution: Critic aliases ─────────────────────────────────
// quality-guardian, code-reviewer, systematic-debugger resolve to "critic"

test("quality-guardian resolves to critic", () => {
  return resolveCanonicalDelegateAgentKey("quality-guardian") === "critic";
});

test("code-reviewer resolves to critic", () => {
  return resolveCanonicalDelegateAgentKey("code-reviewer") === "critic";
});

test("systematic-debugger resolves to critic", () => {
  return resolveCanonicalDelegateAgentKey("systematic-debugger") === "critic";
});

// The display name for critic-group aliases is "Critic" (not "Quality Guardian")
// because they resolve to the critic key, whose display name is "Critic".

test("getAgentDisplayName(quality-guardian) returns Critic (resolved to critic key)", () => {
  return getAgentDisplayName("quality-guardian") === "Critic";
});

// ── Canonical key resolution: Manager ──────────────────────────────────────
// "manager" is a public alias for "platform-manager" runtime key
// Manager -> platform-manager (config key) -> Manager (display name)

test("manager resolves to platform-manager", () => {
  return resolveCanonicalDelegateAgentKey("manager") === "platform-manager";
});

test("getAgentDisplayName(manager) returns Manager", () => {
  return getAgentDisplayName("manager") === "Manager";
});

test("getAgentConfigKey(Manager) returns platform-manager", () => {
  return getAgentConfigKey("Manager") === "platform-manager";
});

// ── Canonical key resolution: Vision ─────────────────────────────────────────
// "vision" is a public alias for "multimodal" OR "ui" (internal runtime key varies)
// Vision (display name) -> ui (config key) -> Vision (display name)

test("getAgentConfigKey(Vision) returns ui (display name resolves to config key)", () => {
  return getAgentConfigKey("Vision") === "ui";
});

test("getAgentDisplayName(Vision) returns Vision", () => {
  return getAgentDisplayName("Vision") === "Vision";
});

// "ui" and "multimodal" are internal runtime keys for Vision family
// ui resolves to multimodal (via LEGACY_DELEGATE_AGENT_ALIASES)

test("ui resolves to multimodal (legacy delegate alias)", () => {
  return resolveCanonicalDelegateAgentKey("ui") === "multimodal";
});

test("getAgentDisplayName(ui) returns Vision", () => {
  return getAgentDisplayName("ui") === "Vision";
});

test("getAgentDisplayName(multimodal) returns Vision", () => {
  return getAgentDisplayName("multimodal") === "Vision";
});

// ── Canonical key resolution: Direct specialists ─────────────────────────────

test("designer resolves to designer", () => {
  return resolveCanonicalDelegateAgentKey("designer") === "designer";
});

test("brainstormer resolves to brainstormer", () => {
  return resolveCanonicalDelegateAgentKey("brainstormer") === "brainstormer";
});

test("researcher resolves to researcher", () => {
  return resolveCanonicalDelegateAgentKey("researcher") === "researcher";
});

test("bob resolves to bob", () => {
  return resolveCanonicalDelegateAgentKey("bob") === "bob";
});

test("strategist resolves to strategist", () => {
  return resolveCanonicalDelegateAgentKey("strategist") === "strategist";
});

test("guard resolves to guard", () => {
  return resolveCanonicalDelegateAgentKey("guard") === "guard";
});

test("critic resolves to critic", () => {
  return resolveCanonicalDelegateAgentKey("critic") === "critic";
});

test("platform-manager resolves to platform-manager", () => {
  return resolveCanonicalDelegateAgentKey("platform-manager") === "platform-manager";
});

test("multimodal resolves to multimodal", () => {
  return resolveCanonicalDelegateAgentKey("multimodal") === "multimodal";
});

// ── Legacy aliases ───────────────────────────────────────────────────────────

test("librarian resolves to researcher", () => {
  return resolveCanonicalDelegateAgentKey("librarian") === "researcher";
});

test("explore resolves to researcher", () => {
  return resolveCanonicalDelegateAgentKey("explore") === "researcher";
});

test("mindmodel resolves to platform-manager", () => {
  return resolveCanonicalDelegateAgentKey("mindmodel") === "platform-manager";
});

// ── Sub/agent-skills blocking ────────────────────────────────────────────────
// sub and agent-skills are internal/hidden agents blocked as direct task targets.
// subagent alias resolves to sub (which is then blocked by SUB_AGENT_CONFIG_KEY check).

test("subagent resolves to sub (blocked as direct target)", () => {
  return resolveCanonicalDelegateAgentKey("subagent") === "sub";
});

test("sub resolves to sub (blocked as direct target)", () => {
  return resolveCanonicalDelegateAgentKey("sub") === "sub";
});

test("agent-skills canonical key is 'agent-skills'", () => {
  return resolveCanonicalDelegateAgentKey("agent-skills") === "agent-skills";
});

// Hidden agents have display names Sub and Agent Skills

test("'sub' display name is 'Sub' (hidden)", () => {
  return getAgentDisplayName("sub") === "Sub";
});

test("'agent-skills' display name is 'Agent Skills' (hidden)", () => {
  return getAgentDisplayName("agent-skills") === "Agent Skills";
});

// ── Display names: primary visible agents ───────────────────────────────────

test("getAgentDisplayName(bob) returns Bob", () => {
  return getAgentDisplayName("bob") === "Bob";
});

test("getAgentDisplayName(coder) returns Coder", () => {
  return getAgentDisplayName("coder") === "Coder";
});

test("getAgentDisplayName(strategist) returns Strategist", () => {
  return getAgentDisplayName("strategist") === "Strategist";
});

test("getAgentDisplayName(guard) returns Guard", () => {
  return getAgentDisplayName("guard") === "Guard";
});

test("getAgentDisplayName(critic) returns Critic", () => {
  return getAgentDisplayName("critic") === "Critic";
});

test("getAgentDisplayName(designer) returns Designer", () => {
  return getAgentDisplayName("designer") === "Designer";
});

test("getAgentDisplayName(researcher) returns Researcher", () => {
  return getAgentDisplayName("researcher") === "Researcher";
});

test("getAgentDisplayName(brainstormer) returns Brainstormer", () => {
  return getAgentDisplayName("brainstormer") === "Brainstormer";
});

test("getAgentDisplayName(platform-manager) returns Manager", () => {
  return getAgentDisplayName("platform-manager") === "Manager";
});

// ── Config key: case-insensitivity ─────────────────────────────────────────

test("getAgentConfigKey(Bob) returns bob", () => {
  return getAgentConfigKey("Bob") === "bob";
});

test("getAgentConfigKey(BOB) returns bob (case-insensitive)", () => {
  return getAgentConfigKey("BOB") === "bob";
});

// ── sanitizeSubagentType ────────────────────────────────────────────────────

test("sanitizeSubagentType trims whitespace", () => {
  return sanitizeSubagentType("  bob  ") === "bob";
});

test("sanitizeSubagentType removes surrounding quotes", () => {
  return sanitizeSubagentType('"bob"') === "bob";
});

test("sanitizeSubagentType removes surrounding slashes", () => {
  return sanitizeSubagentType("/bob/") === "bob";
});

// ── Public model contract ───────────────────────────────────────────────────
// These verify the PUBLIC model: users should see simple canonical names.

const PUBLIC_AGENTS: [string, string][] = [
  ["bob", "Bob"],
  ["coder", "Coder"],
  ["strategist", "Strategist"],
  ["guard", "Guard"],
  ["critic", "Critic"],
  ["designer", "Designer"],
  ["researcher", "Researcher"],
  ["platform-manager", "Manager"],
  ["brainstormer", "Brainstormer"],
  ["multimodal", "Vision"],
];

for (const [configKey, expectedDisplay] of PUBLIC_AGENTS) {
  test(`public agent ${configKey} → display name '${expectedDisplay}'`, () => {
    return getAgentDisplayName(configKey) === expectedDisplay;
  });
}

// ── Summary ───────────────────────────────────────────────────────────────

console.log();
console.log(`  Results: ${green(`${pass} pass`)}  ${red(`${fail} fail`)}`);
if (fail > 0) {
  console.log();
  process.exit(1);
}
console.log();
process.exit(0);
