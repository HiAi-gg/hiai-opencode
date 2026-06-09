import { z } from "zod";

export const AgentBrowserNavigateArgs = z.object({
  url: z.string().describe("URL to navigate to"),
});

export type AgentBrowserNavigateArgs = z.infer<typeof AgentBrowserNavigateArgs>;

export const AgentBrowserSnapshotArgs = z.object({
  interactive: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether to include interactive elements"),
  compact: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether to use compact output format"),
  selector: z
    .string()
    .optional()
    .describe("CSS selector to scope the snapshot"),
  depth: z
    .number()
    .optional()
    .describe("Maximum depth to traverse in the DOM tree"),
  json: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether to return output as JSON"),
});

export type AgentBrowserSnapshotArgs = z.infer<typeof AgentBrowserSnapshotArgs>;

export const AgentBrowserClickArgs = z.object({
  target: z.string().describe("Target element (e.g., @e2 or CSS selector)"),
  button: z
    .enum(["left", "right", "middle"])
    .optional()
    .default("left")
    .describe("Mouse button to use"),
  newTab: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether to open in a new tab"),
});

export type AgentBrowserClickArgs = z.infer<typeof AgentBrowserClickArgs>;

export const AgentBrowserFillArgs = z.object({
  target: z
    .string()
    .describe("Target input element (e.g., @e2 or CSS selector)"),
  text: z.string().describe("Text to fill into the field"),
});

export type AgentBrowserFillArgs = z.infer<typeof AgentBrowserFillArgs>;

export const AgentBrowserTypeArgs = z.object({
  target: z.string().describe("Target element to type into"),
  text: z.string().describe("Text to type"),
  slowly: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether to type one character at a time"),
});

export type AgentBrowserTypeArgs = z.infer<typeof AgentBrowserTypeArgs>;

export const AgentBrowserScreenshotArgs = z.object({
  filename: z
    .string()
    .optional()
    .describe("Output filename for the screenshot"),
  fullPage: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether to capture the full scrollable page"),
  annotate: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether to add annotations to the screenshot"),
});

export type AgentBrowserScreenshotArgs = z.infer<
  typeof AgentBrowserScreenshotArgs
>;

export const AgentBrowserEvalArgs = z.object({
  code: z
    .string()
    .describe("JavaScript code to evaluate in the browser context"),
});

export type AgentBrowserEvalArgs = z.infer<typeof AgentBrowserEvalArgs>;

export const AgentBrowserWaitArgs = z.object({
  condition: z
    .string()
    .describe(
      'Wait condition: ms number, --load networkidle, --text "abc", or --url "**/path"',
    ),
});

export type AgentBrowserWaitArgs = z.infer<typeof AgentBrowserWaitArgs>;

export const AgentBrowserCloseArgs = z.object({
  all: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether to close all tabs and browser"),
});

export type AgentBrowserCloseArgs = z.infer<typeof AgentBrowserCloseArgs>;

export const AgentBrowserConsoleArgs = z.object({
  json: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether to return output as JSON"),
  clear: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether to clear the console after reading"),
});

export type AgentBrowserConsoleArgs = z.infer<typeof AgentBrowserConsoleArgs>;

export const AgentBrowserSelectArgs = z.object({
  target: z.string().describe("Target dropdown element"),
  value: z.string().describe("Value to select"),
});

export type AgentBrowserSelectArgs = z.infer<typeof AgentBrowserSelectArgs>;

export const AgentBrowserHoverArgs = z.object({
  target: z.string().describe("Target element to hover over"),
});

export type AgentBrowserHoverArgs = z.infer<typeof AgentBrowserHoverArgs>;

export const AgentBrowserPressArgs = z.object({
  key: z.string().describe('Key to press (e.g., "Enter", "Tab", "Control+a")'),
});

export type AgentBrowserPressArgs = z.infer<typeof AgentBrowserPressArgs>;

export const AgentBrowserUploadArgs = z.object({
  target: z.string().describe("Target file input element"),
  files: z.array(z.string()).describe("Array of absolute file paths to upload"),
});

export type AgentBrowserUploadArgs = z.infer<typeof AgentBrowserUploadArgs>;

export const AgentBrowserBatchArgs = z.object({
  commands: z
    .array(z.string())
    .describe(
      'Array of full command strings (e.g., "open https://example.com")',
    ),
  bail: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether to stop on first error"),
});

export type AgentBrowserBatchArgs = z.infer<typeof AgentBrowserBatchArgs>;
