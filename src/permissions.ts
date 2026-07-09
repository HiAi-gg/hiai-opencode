/**
 * permissions.ts — Pure utility for per-agent permission resolution.
 *
 * Internal agents that perform cross-project file inspection (explore, plan,
 * critic, build, general, manager, writer, designer) get external_directory =
 * 'allow' by default so they can read files outside the project root without
 * hanging on native permission prompts.
 *
 * Bob and Vision are excluded — Bob should delegate discovery to Explore,
 * and Vision is browser/multimodal only. This default is overridable via
 * agent_restrictions.<agent>.external_directory = false.
 *
 * NOTE: Bob/Plan grep/glob/webfetch restrictions remain unchanged — they
 * should delegate discovery/exploration to the Explore agent.
 */

/** Agents that receive external_directory: 'allow' by default. */
export const EXTERNAL_DIRECTORY_ALLOW_AGENTS = new Set([
  'explore',
  'plan',
  'critic',
  'build',
  'general',
  'manager',
  'writer',
  'designer',
]);

/** Permission keys that map to permission.* deny. */
export const PERMISSION_KEYS = new Set([
  'edit',
  'bash',
  'webfetch',
  'doom_loop',
  'external_directory',
]);

/** Tool keys that map to tools.* disable. */
export const TOOLS_KEYS = new Set([
  'write',
  'grep',
  'glob',
  'task',
  'apply_patch',
  // agent_browser_* tools — restricted per-agent to enforce Vision ownership
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
]);

export interface AgentPermissions {
  permission: Record<string, string>;
  tools: Record<string, boolean>;
}

/**
 * Get the default external_directory permission for a given agent.
 * Returns 'allow' for internal agents that need cross-project file access,
 * undefined otherwise.
 *
 * Bob and Vision are explicitly excluded — Bob delegates discovery to Explore,
 * and Vision is browser/multimodal only.
 */
export function getDefaultExternalDirectory(agentKey: string): string | undefined {
  if (EXTERNAL_DIRECTORY_ALLOW_AGENTS.has(agentKey)) {
    return 'allow';
  }
  return undefined;
}

/**
 * Build agent permission and tool maps from restrictions + defaults.
 *
 * @param restrictions - agent_restrictions entry (key → false means deny/disable)
 * @param extraTools  - tools to enable (e.g. firecrawl_* for explore)
 * @param defaultPermissions - default permission values (e.g. { external_directory: 'allow' })
 */
export function applyAgentPermissions(
  restrictions: Record<string, boolean> | undefined,
  extraTools: Record<string, boolean> = {},
  defaultPermissions: Record<string, string> = {},
): AgentPermissions {
  const permission: Record<string, string> = { ...defaultPermissions };
  const tools: Record<string, boolean> = { ...extraTools };

  if (restrictions) {
    for (const [key, value] of Object.entries(restrictions)) {
      if (value !== false) continue;
      if (PERMISSION_KEYS.has(key)) permission[key] = 'deny';
      else if (TOOLS_KEYS.has(key)) tools[key] = false;
    }
  }

  return { permission, tools };
}
