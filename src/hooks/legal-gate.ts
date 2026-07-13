import type { Hooks } from "@opencode-ai/plugin";
import { BlockingHookError } from "./errors";
import { logger } from "../util/log";

// Legal gate — enforces the project ethical-use policy on the autonomy feature.
//
// Three parts:
//   (a) hard deny-list: prohibit patterns the project ethical-use policy forbids
//       (military, malicious cyber, unauthorized data exfiltration).
//   (b) defense-in-depth: read-only external_directory operations are auto-allowed
//       to prevent hangs. This is a fallback safety net — the per-agent permission
//       system (Layer 3) is the primary control.
//   (c) ask-before-do: high-risk actions (writes, shell, deploys) require
//       human permission via the `permission.ask` hook. The native hiai
//       permission system is the source of truth — we set `status: "ask"`
//       to require explicit human approval.

// (a) Hard / Contextual deny-list. Case-insensitive substring match against JSON.stringify(args).
//
// Split into two tiers so we block malicious *intent* without censoring the
// defensive security *vocabulary* that legit dev/delegation prompts use all the
// time ("test login for SQL injection", "patch the 0-day", "/security-review"):
//
//   HARD_DENY      — unambiguously malicious regardless of framing. Always blocks.
//   CONTEXTUAL_DENY — dual-use security terms. Only block when an offensive-intent
//                     verb (attack/compromise/weaponize/…) is also present.

// Offensive-intent context — gates the dual-use terms below.
const OFFENSIVE_INTENT =
  /\b(attack|compromis\w*|breach|weaponi[sz]e\w*|pwn|exploit\w*|backdoor|infiltrat\w*|deploy\s+against|launch\s+against|hack(?:ing)?\s+into|gain\s+(?:unauthori[sz]ed|illicit)\s+access|build\s+(?:a\s+)?(?:malware|botnet|c2|exploit))\b/i;

// Browser-automation deny-list — Playwright/Puppeteer are FORBIDDEN in this repo.
// The ONLY approved browser automation path is agent-browser via Vision/general.
// Any attempt to install, import, require, or run Playwright/Puppeteer (or equivalent)
// via any tool (bash, write, edit, etc.) will be blocked.
//
// NOTE: More specific patterns must come BEFORE /\bplaywright\b/i to ensure they fire first.
// findDenyMatch returns the first match; a bare "playwright" would consume all variants otherwise.
const BROWSER_AUTOMATION_DENY: Array<{ pattern: RegExp; reason: string }> = [
  // JS/TS import/require patterns (specific signatures first)
  // NOTE: JSON.stringify() escapes internal double quotes to \", so patterns match
  // both raw quotes (['"]) and JSON-escaped quotes (\\").
  {
    pattern: /require\s*\(\s*(?:['"]|\\")playwright(?:['"]|\\")\s*\)/i,
    reason: 'require("playwright") is forbidden',
  },
  {
    pattern: /require\s*\(\s*(?:['"]|\\")puppeteer(?:['"]|\\")\s*\)/i,
    reason: 'require("puppeteer") is forbidden',
  },
  {
    pattern: /from\s+(?:['"]|\\")playwright(?:['"]|\\")/i,
    reason: 'import from "playwright" is forbidden',
  },
  {
    pattern: /from\s+(?:['"]|\\")puppeteer(?:['"]|\\")/i,
    reason: 'import from "puppeteer" is forbidden',
  },
  {
    pattern: /import\s+.*\s+from\s+(?:['"]|\\")playwright(?:['"]|\\")/i,
    reason: 'import ... from "playwright" is forbidden',
  },
  {
    pattern: /import\s+.*\s+from\s+(?:['"]|\\")puppeteer(?:['"]|\\")/i,
    reason: 'import ... from "puppeteer" is forbidden',
  },
  // Playwright/Puppeteer API signatures
  {
    pattern: /chromium\.launch\s*\(/i,
    reason: "chromium.launch() is a Playwright API — forbidden",
  },
  {
    pattern: /firefox\.launch\s*\(/i,
    reason: "firefox.launch() is a Playwright API — forbidden",
  },
  {
    pattern: /webkit\.launch\s*\(/i,
    reason: "webkit.launch() is a Playwright API — forbidden",
  },
  {
    pattern: /page\.screenshot\s*\(/i,
    reason: "page.screenshot() is a Playwright/Puppeteer API — forbidden",
  },
  {
    pattern: /browser\.newPage\s*\(/i,
    reason: "browser.newPage() is a Playwright/Puppeteer API — forbidden",
  },
  {
    pattern: /puppeteer\.launch\s*\(/i,
    reason: "puppeteer.launch() is forbidden",
  },
  // CLI invocations
  {
    pattern: /\bnpx\s+playwright\b/i,
    reason: "npx playwright is forbidden — use agent-browser via Vision",
  },
  {
    pattern: /\bnpm\s+list\s+[-g]+\s+playwright\b/i,
    reason: "playwright diagnostic checks are forbidden",
  },
  {
    pattern: /\bnpm\s+exec\s+playwright\b/i,
    reason: "npm exec playwright is forbidden",
  },
  // Chrome DevTools MCP
  {
    pattern: /\bmcp[-_ ]devtools\b/i,
    reason: "Chrome DevTools MCP is forbidden — use agent-browser via Vision",
  },
  // Script file patterns
  {
    pattern: /node\s+\S*playwright/i,
    reason:
      "node ...playwright... path suggests a Playwright script — forbidden",
  },
  {
    pattern: /node\s+\S*puppeteer/i,
    reason: "node ...puppeteer... path suggests a Puppeteer script — forbidden",
  },
  // Paths
  {
    pattern: /\.cache\/puppeteer\b/i,
    reason: "Puppeteer cache path is forbidden",
  },
  {
    pattern: /\.cache\/playwright\b/i,
    reason: "Playwright cache path is forbidden",
  },
  {
    pattern: /node_modules\/playwright\b/i,
    reason:
      "node_modules/playwright path suggests a Playwright installation — forbidden",
  },
  // Package names with scope (no \b before @ since @ is not a word character)
  {
    pattern: /@playwright\//i,
    reason:
      "@playwright/* packages are forbidden — use agent-browser via Vision",
  },
  {
    pattern: /@puppeteer\//i,
    reason:
      "@puppeteer/* packages are forbidden — use agent-browser via Vision",
  },
  {
    pattern: /\bms-playwright\b/i,
    reason: "ms-playwright is forbidden — use agent-browser via Vision",
  },
  // Bare package names — must be LAST so specific patterns fire first
  {
    pattern: /\bplaywright\b/i,
    reason: "Playwright is forbidden — use agent-browser via Vision",
  },
  {
    pattern: /\bpuppeteer\b/i,
    reason: "Puppeteer is forbidden — use agent-browser via Vision",
  },
];

const HARD_DENY: Array<{ pattern: RegExp; reason: string }> = [
  // Military
  {
    pattern:
      /\b(weapon|weapons|munitions|military[-_ ]?(target|grade|operation))\b/i,
    reason: "military use is prohibited by the project ethical-use policy",
  },
  {
    pattern:
      /\b(drone|drone[-_ ]?strike|missile|ballistic)\b.*\b(target|launch|deploy|guidance)\b/i,
    reason: "military targeting / weapons guidance is prohibited",
  },
  // Malicious cyber — unambiguous
  {
    pattern:
      /\b(ransomware|ransom[-_ ]?note|encrypt.*victim.*files|locker[-_ ]?payload)\b/i,
    reason: "ransomware is prohibited (malicious cyber activity)",
  },
  {
    pattern:
      /\b(credential[-_ ]?harvest\w*|stealer[-_ ]?log|password[-_ ]?dump|lsass[-_ ]?dump)\b/i,
    reason: "credential theft is prohibited",
  },
  {
    pattern: /\b(cnc[-_ ]?server|botnet)\b/i,
    reason: "command-and-control infrastructure is prohibited",
  },
  // Unauthorized data exfiltration
  {
    pattern: /\b(exfiltrat\w*|smuggl\w*[-_ ]?data|covert[-_ ]?channel)\b/i,
    reason: "unauthorized data exfiltration is prohibited",
  },
  {
    pattern:
      /\b(scrap\w*|harvest\w*)\b.*\b(personal[-_ ]?data|pii|email[-_ ]?list|user[-_ ]?record)\b.*\b(without|no)\b.*\b(consent|authorization)\b/i,
    reason: "scraping/harvesting personal data without consent is prohibited",
  },
];

// Dual-use security vocabulary. Defensive use (fix/test/patch/audit) is legit and
// must pass; only blocked when OFFENSIVE_INTENT also appears in the same args.
const CONTEXTUAL_DENY: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern:
      /\b(sql[-_ ]?injection|xss[-_ ]?payload|exploit[-_ ]?kit|0[-_ ]?day|zero[-_ ]?day|phishing)\b/i,
    reason:
      "exploit tooling for offensive use is prohibited (malicious cyber activity)",
  },
  {
    pattern: /\b(c2|command[-_ ]?and[-_ ]?control)\b/i,
    reason: "command-and-control infrastructure is prohibited",
  },
];

// (b) Read-only tool allowlist for external_directory defense-in-depth.
// When the permission being asked is external_directory and the tool is
// read-only, we auto-allow to avoid blocking legitimate cross-project
// file inspection. This is defense-in-depth: the per-agent permission
// system (Layer 3) already grants external_directory for allowed agents,
// but this hook catches any fallthrough.
const READONLY_EXTERNAL_DIRECTORY_TOOLS = new Set([
  "read",
  "grep",
  "glob",
  "list",
  "lsp_diagnostics",
  "lsp_goto_definition",
  "lsp_find_references",
  "lsp_symbols",
  "hiai_memory_search",
  "session_read",
  "session_search",
  "session_info",
]);

// (c) Ask-before-do — tools whose use triggers a human permission prompt.
// We do NOT replace the native permission system; we just ensure these tools
// always go through `permission.ask`. Native per-agent config can still allow
// or deny — BobPlugin only ensures no silent execution.
const ASK_BEFORE_TOOLS = new Set([
  "bash",
  "write",
  "edit",
  "patch",
  "apply_patch",
  "multiedit",
  "webfetch",
]);

// Context7 routing advisory — when WebFetch targets library/framework docs,
// redirect toward context7 instead of using WebFetch.
const FRAMEWORK_KEYWORDS =
  /\b(svelte|sveltekit|react|vue|next\.?js|nuxt|bun|elysia|hono|express|fastify|prisma|drizzle|tailwind|shadcn|astro|remix|solid|angular)/i;

function findDenyMatch(
  args: unknown,
): { pattern: RegExp; reason: string } | null {
  if (args == null) return null;
  const haystack = JSON.stringify(args);
  // Browser automation (Playwright/Puppeteer) is ALWAYS blocked — no exceptions.
  const browserHit = BROWSER_AUTOMATION_DENY.find((d) =>
    d.pattern.test(haystack),
  );
  if (browserHit) return browserHit;
  const hard = HARD_DENY.find((d) => d.pattern.test(haystack));
  if (hard) return hard;
  // Dual-use terms only deny when paired with offensive intent — defensive
  // security work (test/fix/patch/audit) passes through.
  if (!OFFENSIVE_INTENT.test(haystack)) return null;
  return CONTEXTUAL_DENY.find((d) => d.pattern.test(haystack)) ?? null;
}

export function createLegalGate(): Pick<
  Hooks,
  "tool.execute.before" | "tool.execute.after" | "permission.ask"
> {
  return {
    // (a) Hard deny-list — runs BEFORE native permission checks.
    "tool.execute.before": async (input, output) => {
      try {
        const hit = findDenyMatch(output.args);
        if (hit) {
          // Distinguish browser-automation gate from general legal gate.
          const isBrowserAutomation = BROWSER_AUTOMATION_DENY.some(
            (d) => d.pattern === hit.pattern,
          );
          const prefix = isBrowserAutomation
            ? "[bob] BROWSER AUTOMATION GATE"
            : "[bob] LEGAL GATE";
          const suffix = isBrowserAutomation
            ? " Use agent-browser via Vision, or return BLOCKED with the agent-browser error."
            : " This use is prohibited by the project ethical-use policy and cannot be overridden.";
          throw new BlockingHookError(
            `${prefix}: ${hit.reason}. Pattern matched in ${input.tool} args.${suffix}`,
          );
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        logger.error("[hiai-opencode] Hook error in legal-gate:", err);
      }
    },

    // Context7 routing advisory: if WebFetch targets library/framework docs,
    // prepend a steering advisory. This is NON-blocking — it informs, not denies.
    "tool.execute.after": async (input, output) => {
      try {
        const toolName = (input as { tool?: string }).tool ?? "";
        if (
          (toolName === "webfetch" || toolName === "web_search") &&
          output.output
        ) {
          const haystack = JSON.stringify(
            (input as { args?: unknown }).args ?? {},
          );
          if (FRAMEWORK_KEYWORDS.test(haystack)) {
            output.output = `[hiai-opencode] ROUTING: This looks like a library/framework docs query. Use skill("explore/context7") instead of webfetch. context7 has official, versioned docs for Svelte/React/Vue/etc.\n\n${
              output.output ?? ""
            }`;
          }
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        logger.error("[hiai-opencode] Hook error in legal-gate:", err);
      }
    },

    // (b) Defense-in-depth: read-only external_directory auto-allow.
    // When the permission being asked is 'external_directory' and the tool
    // is read-only, auto-allow without prompting. This prevents hangs when
    // the per-agent permission config doesn't fully cover every call path.
    "permission.ask": async (input, output) => {
      try {
        const inp = input as { tool?: string; permission?: string };
        const toolName = inp.tool ?? "";
        const permissionKey = inp.permission ?? "";

        // Defense-in-depth: auto-allow read-only tools for external_directory.
        if (
          permissionKey === "external_directory" &&
          READONLY_EXTERNAL_DIRECTORY_TOOLS.has(toolName)
        ) {
          output.status = "allow";
          return;
        }

        // (c) Ask-before-do — high-risk tools always request human permission.
        if (ASK_BEFORE_TOOLS.has(toolName)) {
          output.status = "ask";
        }
      } catch (err) {
        if (err instanceof BlockingHookError) throw err;
        logger.error("[hiai-opencode] Hook error in legal-gate:", err);
      }
    },
  };
}
