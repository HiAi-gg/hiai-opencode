import { exec } from "node:child_process";
import { promisify } from "node:util";
import { tool } from "@opencode-ai/plugin";

const execAsync = promisify(exec);

function shellEscape(s: string): string {
  return s.replace(/'/g, "'\\''");
}

/**
 * Returns true if FIRECRAWL_API_KEY is present and non-empty in process.env.
 */
export function hasFirecrawlKey(): boolean {
  const key = process.env.FIRECRAWL_API_KEY;
  return typeof key === "string" && key.trim().length > 0;
}

/**
 * Classifies Firecrawl CLI errors and returns a user-friendly message.
 * Does not log or return secret values.
 */
export function formatFirecrawlError(
  stderr: string,
  stdout: string,
  message: string,
): string {
  const output = stderr || stdout || message;
  const lower = output.toLowerCase();

  // CLI not installed or not found
  if (
    lower.includes("command not found") ||
    lower.includes("enoent") ||
    lower.includes("firecrawl: not found") ||
    lower.includes("cannot find module")
  ) {
    return (
      "Firecrawl CLI is not installed. " +
      "Install it with: bun add -g firecrawl-cli && firecrawl --version"
    );
  }

  // 401 / Unauthorized / Invalid token — distinct from missing key
  if (
    lower.includes("401") ||
    lower.includes("unauthorized") ||
    lower.includes("invalid token") ||
    lower.includes("invalid api key") ||
    lower.includes("api key is invalid") ||
    lower.includes("authentication failed") ||
    lower.includes("credentials are invalid")
  ) {
    if (!hasFirecrawlKey()) {
      return (
        "FIRECRAWL_API_KEY is not set in bob.env. " +
        "Copy bob.env.example to bob.env and fill in your Firecrawl API key. " +
        "Get a key at https://firecrawl.dev"
      );
    }
    return (
      "FIRECRAWL_API_KEY appears invalid or expired. " +
      "Please update the key in bob.env or get a fresh one at https://firecrawl.dev"
    );
  }

  // Missing key — key not set in environment
  if (
    lower.includes("missing api key") ||
    lower.includes("no api key") ||
    lower.includes("api key required") ||
    lower.includes("firecrawl_api_key") ||
    lower.includes("api key is missing") ||
    lower.includes("api key not found")
  ) {
    if (!hasFirecrawlKey()) {
      return (
        "FIRECRAWL_API_KEY is not set. " +
        "Copy bob.env.example to bob.env and fill in your Firecrawl API key. " +
        "Get a key at https://firecrawl.dev"
      );
    }
    // Key is set but still missing — likely a different issue
    return (
      "Firecrawl reports API key is missing despite FIRECRAWL_API_KEY being set. " +
      "Verify the key in bob.env is correct. If the CLI supports keyless mode, " +
      "it may be using cached credentials. Production should set FIRECRAWL_API_KEY explicitly."
    );
  }

  // Rate limit
  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return (
      "Firecrawl rate limit reached. " +
      "Wait before retrying or upgrade your Firecrawl plan at https://firecrawl.dev"
    );
  }

  // Generic error — return the output without leaking anything sensitive
  return output || `Firecrawl error: ${message}`;
}

async function runFirecrawl(args: string): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(`firecrawl ${args}`, {
      timeout: 60_000,
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env, HOME: process.env.HOME },
    });
    return stdout || stderr;
  } catch (e: unknown) {
    // Firecrawl exits non-zero on some successful operations — return output anyway
    const err = e as {
      stdout?: string;
      stderr?: string;
      message?: string;
      code?: string;
    };
    if (err.stdout) {
      return formatFirecrawlError(
        err.stderr || "",
        err.stdout,
        err.message || "",
      );
    }
    const classified = formatFirecrawlError(
      err.stderr || "",
      "",
      err.message || "",
    );
    return classified;
  }
}

export const firecrawlSearchTool = tool({
  description:
    "Search the web using Firecrawl. Returns structured, LLM-optimized results.",
  args: {
    query: tool.schema.string().describe("Search query"),
    limit: tool.schema.number().optional().describe("Max results (default 5)"),
  },
  async execute(args) {
    const limit = args.limit ?? 5;
    return runFirecrawl(`search '${shellEscape(args.query)}' --limit ${limit}`);
  },
});

export const firecrawlScrapeTool = tool({
  description: "Scrape a single URL and return clean markdown content.",
  args: {
    url: tool.schema.string().describe("URL to scrape"),
    format: tool.schema
      .string()
      .optional()
      .describe("Output format: markdown, html, text (default markdown)"),
  },
  async execute(args) {
    const fmt = args.format ?? "markdown";
    return runFirecrawl(`scrape '${shellEscape(args.url)}' --format ${fmt}`);
  },
});

export const firecrawlMapTool = tool({
  description: "Map a website — discover all URLs on a domain.",
  args: {
    url: tool.schema.string().describe("URL to map"),
    limit: tool.schema.number().optional().describe("Max URLs (default 100)"),
  },
  async execute(args) {
    const limit = args.limit ?? 100;
    return runFirecrawl(`map '${shellEscape(args.url)}' --limit ${limit}`);
  },
});
