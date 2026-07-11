/**
 * registry-smoke.test.ts — Smoke tests for key mechanism tool registrations.
 *
 * Verifies that firecrawl, agent-browser, LSP, session, background, and
 * memory tools are present in the plugin's tool registry.
 */

import { describe, expect, test } from "bun:test";
import { BobPlugin } from "../index";

// Build a minimal input that doesn't require a real project directory.
// The plugin only needs input.directory to load config.
const FAKE_DIR = "/tmp/hiai-opencode-smoke-test";

describe("plugin tool registry", () => {
  test("plugin loads without throwing", async () => {
    const hooks = await BobPlugin({ directory: FAKE_DIR });
    expect(hooks).toBeDefined();
    expect(typeof hooks.config).toBe("function");
  });

  test("plugin registers firecrawl tools", async () => {
    const hooks = await BobPlugin({ directory: FAKE_DIR });
    expect(hooks.tool).toBeDefined();
    expect(hooks.tool!.firecrawl_search).toBeDefined();
    expect(hooks.tool!.firecrawl_scrape).toBeDefined();
    expect(hooks.tool!.firecrawl_map).toBeDefined();
  });

  test("plugin registers agent-browser tools", async () => {
    const hooks = await BobPlugin({ directory: FAKE_DIR });
    expect(hooks.tool!.agent_browser_navigate).toBeDefined();
    expect(hooks.tool!.agent_browser_snapshot).toBeDefined();
    expect(hooks.tool!.agent_browser_click).toBeDefined();
    expect(hooks.tool!.agent_browser_fill).toBeDefined();
    expect(hooks.tool!.agent_browser_type).toBeDefined();
    expect(hooks.tool!.agent_browser_screenshot).toBeDefined();
    expect(hooks.tool!.agent_browser_eval).toBeDefined();
    expect(hooks.tool!.agent_browser_wait).toBeDefined();
    expect(hooks.tool!.agent_browser_close).toBeDefined();
    expect(hooks.tool!.agent_browser_console).toBeDefined();
    expect(hooks.tool!.agent_browser_select).toBeDefined();
    expect(hooks.tool!.agent_browser_hover).toBeDefined();
    expect(hooks.tool!.agent_browser_press).toBeDefined();
    expect(hooks.tool!.agent_browser_batch).toBeDefined();
    expect(hooks.tool!.agent_browser_set_viewport).toBeDefined();
    expect(hooks.tool!.agent_browser_set_device).toBeDefined();
  });

  test("plugin registers all 6 LSP tools", async () => {
    const hooks = await BobPlugin({ directory: FAKE_DIR });
    expect(hooks.tool!.lsp_diagnostics).toBeDefined();
    expect(hooks.tool!.lsp_goto_definition).toBeDefined();
    expect(hooks.tool!.lsp_find_references).toBeDefined();
    expect(hooks.tool!.lsp_symbols).toBeDefined();
    expect(hooks.tool!.lsp_prepare_rename).toBeDefined();
    expect(hooks.tool!.lsp_rename).toBeDefined();
  });

  test("plugin registers session tools", async () => {
    const hooks = await BobPlugin({ directory: FAKE_DIR });
    expect(hooks.tool!.session_list).toBeDefined();
    expect(hooks.tool!.session_read).toBeDefined();
    expect(hooks.tool!.session_search).toBeDefined();
    expect(hooks.tool!.session_info).toBeDefined();
  });

  test("plugin registers background tools", async () => {
    const hooks = await BobPlugin({ directory: FAKE_DIR });
    expect(hooks.tool!.background_output).toBeDefined();
    expect(hooks.tool!.background_cancel).toBeDefined();
  });

  test("plugin registers memory tool", async () => {
    const hooks = await BobPlugin({ directory: FAKE_DIR });
    expect(hooks.tool!.hiai_memory_search).toBeDefined();
  });

  test("plugin registers skill tool", async () => {
    const hooks = await BobPlugin({ directory: FAKE_DIR });
    expect(hooks.tool!.skill).toBeDefined();
  });

  test("plugin registers all 37 tools", async () => {
    const hooks = await BobPlugin({ directory: FAKE_DIR });
    const toolKeys = Object.keys(hooks.tool ?? {});
    // 6 LSP + 16 agent-browser + 4 session + 2 background + 3 firecrawl
    // + 1 memory + 1 skill + 4 worktree = 37
    expect(toolKeys.length).toBe(37);
  });

  test("plugin registers worktree tools", async () => {
    const hooks = await BobPlugin({ directory: FAKE_DIR });
    expect(hooks.tool!.hiai_worktree_create).toBeDefined();
    expect(hooks.tool!.hiai_worktree_remove).toBeDefined();
    expect(hooks.tool!.hiai_worktree_list).toBeDefined();
    expect(hooks.tool!.hiai_worktree_status).toBeDefined();
  });
});

describe("config loading", () => {
  test("loads default config when no bob.json exists", async () => {
    const hooks = await BobPlugin({ directory: FAKE_DIR });
    // We can't inspect config directly (it's not in hooks), but
    // the plugin should not throw. The real config is loaded internally
    // and used to wire up agents/hooks/tools.
    // Verify by checking that the dispose hook exists.
    expect(typeof hooks.dispose).toBe("function");
  });
});
