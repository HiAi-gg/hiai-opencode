// @ts-nocheck Zod v3/v4 compat - agent-browser uses v3 Zod schemas, plugin uses v4
import {
  tool,
  type ToolDefinition,
  type PluginInput,
} from "@opencode-ai/plugin";
import type { z } from "zod";
import {
  AgentBrowserNavigateArgs,
  AgentBrowserSnapshotArgs,
  AgentBrowserClickArgs,
  AgentBrowserFillArgs,
  AgentBrowserTypeArgs,
  AgentBrowserScreenshotArgs,
  AgentBrowserEvalArgs,
  AgentBrowserWaitArgs,
  AgentBrowserCloseArgs,
  AgentBrowserConsoleArgs,
  AgentBrowserSelectArgs,
  AgentBrowserHoverArgs,
  AgentBrowserPressArgs,
  AgentBrowserBatchArgs,
} from "./types";

type AgentBrowserArgs = z.infer<typeof AgentBrowserNavigateArgs>;

function shellEscape(str: string): string {
  return str.replace(/["\\$]/g, (c) => `\\${c}`);
}

function makeToolErrorHandler(toolName: string) {
  return (error: unknown): string => {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("agent-browser: command not found")) {
      return `agent-browser is not installed or not in PATH. Install it with: npm i -g agent-browser && agent-browser install`;
    }
    return `Error in ${toolName}: ${message}`;
  };
}

export function createAgentBrowserTool(ctx: PluginInput): ToolDefinition[] {
  const $ = ctx.$;

  return [
    tool({
      name: "agent_browser_navigate",
      description: "Navigate to a URL in the browser",
      // @ts-expect-error Zod v3/v4 compat - agent-browser schemas use v3 Zod, plugin uses v4 Zod
      args: AgentBrowserNavigateArgs.shape,
      execute: async (args: AgentBrowserArgs) => {
        try {
          const output = await $(
            `agent-browser open "${shellEscape(args.url)}"`,
          ).text();
          return output;
        } catch (e) {
          return makeToolErrorHandler("agent_browser_navigate")(e);
        }
      },
    }),

    tool({
      name: "agent_browser_snapshot",
      description: "Capture an accessibility snapshot of the current page",
      args: AgentBrowserSnapshotArgs.shape,
      execute: async (args: z.infer<typeof AgentBrowserSnapshotArgs>) => {
        try {
          let cmd = "agent-browser snapshot -i --json";
          if (args.interactive !== undefined && !args.interactive)
            cmd += " --no-interactive";
          if (args.compact !== undefined && !args.compact)
            cmd += " --no-compact";
          if (args.selector)
            cmd += ` --selector "${shellEscape(args.selector)}"`;
          if (args.depth !== undefined) cmd += ` --depth ${args.depth}`;
          const output = await $(cmd).text();
          return output;
        } catch (e) {
          return makeToolErrorHandler("agent_browser_snapshot")(e);
        }
      },
    }),

    tool({
      name: "agent_browser_click",
      description: "Click an element on the page",
      args: AgentBrowserClickArgs.shape,
      execute: async (args: z.infer<typeof AgentBrowserClickArgs>) => {
        try {
          let cmd = `agent-browser click "${shellEscape(args.target)}"`;
          if (args.button && args.button !== "left")
            cmd += ` --button ${args.button}`;
          if (args.newTab) cmd += " --new-tab";
          const output = await $(cmd).text();
          return output;
        } catch (e) {
          return makeToolErrorHandler("agent_browser_click")(e);
        }
      },
    }),

    tool({
      name: "agent_browser_fill",
      description: "Fill a form field with text",
      args: AgentBrowserFillArgs.shape,
      execute: async (args: z.infer<typeof AgentBrowserFillArgs>) => {
        try {
          const cmd = `agent-browser fill "${shellEscape(args.target)}" "${shellEscape(args.text)}"`;
          const output = await $(cmd).text();
          return output;
        } catch (e) {
          return makeToolErrorHandler("agent_browser_fill")(e);
        }
      },
    }),

    tool({
      name: "agent_browser_type",
      description:
        "Type text into an element, optionally one character at a time",
      args: AgentBrowserTypeArgs.shape,
      execute: async (args: z.infer<typeof AgentBrowserTypeArgs>) => {
        try {
          let cmd = `agent-browser type "${shellEscape(args.target)}" "${shellEscape(args.text)}"`;
          if (args.slowly) cmd += " --slowly";
          const output = await $(cmd).text();
          return output;
        } catch (e) {
          return makeToolErrorHandler("agent_browser_type")(e);
        }
      },
    }),

    tool({
      name: "agent_browser_screenshot",
      description: "Take a screenshot of the current page",
      args: AgentBrowserScreenshotArgs.shape,
      execute: async (args: z.infer<typeof AgentBrowserScreenshotArgs>) => {
        try {
          let cmd = "agent-browser screenshot";
          if (args.filename) cmd += ` "${shellEscape(args.filename)}"`;
          if (args.fullPage) cmd += " --full-page";
          if (args.annotate) cmd += " --annotate";
          const output = await $(cmd).text();
          return output;
        } catch (e) {
          return makeToolErrorHandler("agent_browser_screenshot")(e);
        }
      },
    }),

    tool({
      name: "agent_browser_eval",
      description: "Evaluate JavaScript code in the browser context",
      args: AgentBrowserEvalArgs.shape,
      execute: async (args: z.infer<typeof AgentBrowserEvalArgs>) => {
        try {
          const cmd = `agent-browser eval "${shellEscape(args.code)}"`;
          const output = await $(cmd).text();
          return output;
        } catch (e) {
          return makeToolErrorHandler("agent_browser_eval")(e);
        }
      },
    }),

    tool({
      name: "agent_browser_wait",
      description: "Wait for a condition to be met",
      args: AgentBrowserWaitArgs.shape,
      execute: async (args: z.infer<typeof AgentBrowserWaitArgs>) => {
        try {
          const cmd = `agent-browser wait "${shellEscape(args.condition)}"`;
          const output = await $(cmd).text();
          return output;
        } catch (e) {
          return makeToolErrorHandler("agent_browser_wait")(e);
        }
      },
    }),

    tool({
      name: "agent_browser_close",
      description: "Close the browser or a specific tab",
      args: AgentBrowserCloseArgs.shape,
      execute: async (args: z.infer<typeof AgentBrowserCloseArgs>) => {
        try {
          let cmd = "agent-browser close";
          if (args.all) cmd += " --all";
          const output = await $(cmd).text();
          return output;
        } catch (e) {
          return makeToolErrorHandler("agent_browser_close")(e);
        }
      },
    }),

    tool({
      name: "agent_browser_console",
      description: "Read console messages from the browser",
      args: AgentBrowserConsoleArgs.shape,
      execute: async (args: z.infer<typeof AgentBrowserConsoleArgs>) => {
        try {
          let cmd = "agent-browser console --json";
          if (!args.json) cmd = "agent-browser console";
          if (args.clear) cmd += " --clear";
          const output = await $(cmd).text();
          return output;
        } catch (e) {
          return makeToolErrorHandler("agent_browser_console")(e);
        }
      },
    }),

    tool({
      name: "agent_browser_select",
      description: "Select an option in a dropdown element",
      args: AgentBrowserSelectArgs.shape,
      execute: async (args: z.infer<typeof AgentBrowserSelectArgs>) => {
        try {
          const cmd = `agent-browser select "${shellEscape(args.target)}" "${shellEscape(args.value)}"`;
          const output = await $(cmd).text();
          return output;
        } catch (e) {
          return makeToolErrorHandler("agent_browser_select")(e);
        }
      },
    }),

    tool({
      name: "agent_browser_hover",
      description: "Hover over an element",
      args: AgentBrowserHoverArgs.shape,
      execute: async (args: z.infer<typeof AgentBrowserHoverArgs>) => {
        try {
          const cmd = `agent-browser hover "${shellEscape(args.target)}"`;
          const output = await $(cmd).text();
          return output;
        } catch (e) {
          return makeToolErrorHandler("agent_browser_hover")(e);
        }
      },
    }),

    tool({
      name: "agent_browser_press",
      description: "Press a keyboard key",
      args: AgentBrowserPressArgs.shape,
      execute: async (args: z.infer<typeof AgentBrowserPressArgs>) => {
        try {
          const cmd = `agent-browser press "${shellEscape(args.key)}"`;
          const output = await $(cmd).text();
          return output;
        } catch (e) {
          return makeToolErrorHandler("agent_browser_press")(e);
        }
      },
    }),

    tool({
      name: "agent_browser_batch",
      description: "Execute a batch of agent-browser commands sequentially",
      args: AgentBrowserBatchArgs.shape,
      execute: async (args: z.infer<typeof AgentBrowserBatchArgs>) => {
        try {
          const escapedCommands = args.commands
            .map((c: string) => shellEscape(c))
            .join(" ");
          let cmd = `agent-browser batch ${escapedCommands}`;
          if (args.bail) cmd += " --bail";
          const output = await $(cmd).text();
          return output;
        } catch (e) {
          return makeToolErrorHandler("agent_browser_batch")(e);
        }
      },
    }),
  ];
}
