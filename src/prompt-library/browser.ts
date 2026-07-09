// Shared rule: the browser belongs to Vision. Every agent that might want to
// "check the site" delegates to Vision instead of driving agent_browser_* itself.

export const BROWSER_VIA_VISION = `
## HARD GATE: agent_browser_* tools are BLOCKED at runtime for all agents except vision
(primary) and general (fallback). Any non-vision/general agent attempting to call a browser
tool will receive an error. Always delegate to vision — do not attempt to bypass.

## 🚫 ABSOLUTE BROWSER AUTOMATION PROHIBITION — NO EXCEPTIONS
The following are FORBIDDEN and will be blocked at runtime by a hard gate:
- Playwright, @playwright/*, ms-playwright
- Puppeteer, @puppeteer/*
- npx playwright, npm exec playwright
- npm list -g playwright (diagnostic probe is also forbidden)
- require("playwright"), require("puppeteer"), from "playwright", from "puppeteer"
- chromium.launch(), firefox.launch(), webkit.launch(), page.screenshot(), browser.newPage()
- node ...playwright..., node ...puppeteer... (script paths)
- .cache/puppeteer, .cache/playwright
- Chrome DevTools MCP, @mcp-devtools/*
- Any other browser automation library or tool besides \`agent_browser_*\`

If \`agent_browser_*\` fails → return **Status: blocked** with the exact error. Do NOT install,
require, import, or run any alternate browser automation. Do NOT try to work around by running
node scripts, npm commands, or writing temporary scripts that use Playwright/Puppeteer.
Delegating to Vision/general for browser checks is the ONLY approved path.

## Browser / UI verification → ALWAYS delegate to Vision
**Vision owns the browser.** For ANYTHING that needs a real browser — does a page render, do
flows work (sign-up, login, create folder/doc, navigate), console/network errors, visual match
to the design, responsive breakpoints, empty/broken states — you delegate to Vision. Do NOT call
\`agent_browser_*\` yourself, and never judge a live site by reading code.

\`\`\`
task({subagent_type: "vision", description: "Browser verify <screen>", prompt: "Navigate to <URL>. Steps: <click/fill/type, login as ..., create ...>. Check: <criteria>. Return PASS/FAIL with screenshots, console errors, and a concrete issue list."})
\`\`\`

Vision drives the browser end-to-end (navigate → interact → snapshot/screenshot/console),
verifies against your criteria, and **reports its findings back to you**. You act on the report
(fix, re-delegate, or approve) — you do not touch the browser directly.

**Fallback:** if Vision is unavailable or keeps failing on a browser pass, you may delegate a
**minimal** agent-browser check to **general** instead (general can drive \`agent_browser_*\` as a
backup). Tell general the URL, the exact steps, and the PASS/FAIL criteria. Prefer Vision first; use
general only when Vision can't get it done. NEVER fall back to Playwright/Puppeteer.
For responsive testing, Vision uses \`agent_browser_set_viewport()\` before screenshot — not CSS simulation or browser restart.`;
