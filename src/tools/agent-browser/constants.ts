/**
 * agent-browser tool descriptions and examples
 * Follows the pattern from playwright-cli/constants.ts
 */

// AGENT_BROWSER_DESCRIPTION — multi-line description for the agent-browser tool
export const AGENT_BROWSER_DESCRIPTION = `agent-browser is a native Rust CLI for browser automation by Vercel Labs.
It replaces playwright-cli with a built-in daemon, snapshot-based @eN refs, and 15+ commands.

Install: npm install -g agent-browser && agent-browser install

Key Commands:
- open <url>              Navigate to a URL
- snapshot               Capture DOM as JSON with @eN element refs
- click <target>          Click element by @eN ref or CSS selector
- fill <target> <text>   Fill form fields
- type <target> <text>   Type text (optionally slowly character-by-character)
- screenshot             Capture screenshot (PNG/JPEG)
- eval <code>            Execute JavaScript in browser context
- wait <condition>       Wait: ms number, --load networkidle, --text "abc", --url "**/path"
- close                  Close current tab (or --all for entire browser)
- console                Read browser console messages
- select <target> <val>  Select dropdown option
- hover <target>         Hover over element
- press <key>            Press keyboard key (Enter, Tab, Control+a, etc.)
- upload <target> <files> Upload files to file input
- batch <commands>       Run array of commands in sequence

Snapshot-Ref Pattern:
Use "snapshot" to get @eN refs (e.g., @e2, @e5) for deterministic element targeting.
Refs are stable across page loads — prefer @eN over CSS selectors when available.

Daemon Behavior:
agent-browser runs as a daemon — browser state persists between commands.
This enables multi-step workflows without reinitializing the browser each time.

Trigger Phrases:
"browser", "navigate", "screenshot", "click", "fill form", "web page", "automate browser",
"take screenshot", "fill out the form", "log into", "scrape", "test the website", "automate"`;

export type AgentBrowserDescription = typeof AGENT_BROWSER_DESCRIPTION;

// AGENT_BROWSER_INSTALL_EXAMPLES — examples showing the install workflow
export const AGENT_BROWSER_INSTALL_EXAMPLES: Array<{ tool: string; args: Record<string, unknown> }> = [
  {
    tool: 'agent_browser_install',
    args: {},
  },
  {
    tool: 'agent_browser_navigate',
    args: { url: 'https://example.com' },
  },
  {
    tool: 'agent_browser_snapshot',
    args: { json: true, compact: true },
  },
];

export type AgentBrowserInstallExamples = typeof AGENT_BROWSER_INSTALL_EXAMPLES;

// AGENT_BROWSER_EXAMPLES — 6+ example objects showing common patterns
export const AGENT_BROWSER_EXAMPLES: Array<{ tool: string; args: Record<string, unknown> }> = [
  // Example 1: Navigate + snapshot + click workflow
  {
    tool: 'agent_browser_navigate',
    args: { url: 'https://example.com' },
  },
  {
    tool: 'agent_browser_snapshot',
    args: { interactive: true, json: true },
  },
  {
    tool: 'agent_browser_click',
    args: { target: '@e2' },
  },
  // Example 2: Form fill workflow
  {
    tool: 'agent_browser_fill',
    args: { target: '@e5', text: 'hello@example.com' },
  },
  {
    tool: 'agent_browser_fill',
    args: { target: '@e7', text: 'password123' },
  },
  {
    tool: 'agent_browser_press',
    args: { key: 'Enter' },
  },
  // Example 3: Screenshot
  {
    tool: 'agent_browser_screenshot',
    args: { filename: 'page.png', fullPage: true },
  },
  // Example 4: Eval
  {
    tool: 'agent_browser_eval',
    args: { code: "document.title" },
  },
  {
    tool: 'agent_browser_console',
    args: { json: true, clear: false },
  },
  // Example 5: Batch workflow
  {
    tool: 'agent_browser_batch',
    args: {
      commands: [
        'open https://example.com',
        'click @e2',
        'fill @e5 "text"',
        'screenshot --filename result.png',
      ],
      bail: true,
    },
  },
  // Example 6: Wait + verify
  {
    tool: 'agent_browser_wait',
    args: { condition: '--load networkidle' },
  },
  {
    tool: 'agent_browser_snapshot',
    args: { json: true },
  },
  {
    tool: 'agent_browser_screenshot',
    args: { filename: 'after-load.png' },
  },
];

export type AgentBrowserExamples = typeof AGENT_BROWSER_EXAMPLES;